#!/usr/bin/env tsx
/**
 * RLS Test Harness (authenticated tenant checks)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !serviceKey) {
  console.log('Skipping RLS tests - Supabase credentials not available');
  process.exit(0);
}

if (!anonKey) {
  console.log('Missing anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) for tenant auth tests');
  process.exit(1);
}

const TEST_USER_PASSWORD = process.env.RLS_TEST_PASSWORD || 'TestPassword!123';
const ORGS = [
  { id: 'test-org-a', name: 'Test Company A' },
  { id: 'test-org-b', name: 'Test Company B' },
];

const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  },
});

function orgEmail(orgId: string) {
  return `${orgId}@jobeye.test`;
}

export async function getTenantClient({ url, anonKey, email, password }: { url: string; anonKey: string; email: string; password: string; }) {
  const baseClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await baseClient.auth
    .signUp({
      email,
      password,
      options: {
        data: {
          company_id: email.split('@')[0] ?? null,
        },
      },
    })
    .catch(() => {});

  const { data, error } = await baseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.session?.access_token) {
    throw new Error(`tenant sign-in failed for ${email}: ${error?.message ?? 'unknown error'}`);
  }

  const companyId = email.split('@')[0] ?? null;

  await baseClient.auth
    .updateUser({
      data: {
        company_id: companyId,
      },
    })
    .catch(() => {});

  const accessToken = data.session.access_token;
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
    },
  });
}

async function runRLSTests() {
  console.log('Running RLS Multi-Tenant Isolation Tests');
  console.log(`Connected to: ${supabaseUrl}`);

  try {
    console.log('\nSeeding multi-tenant test data...');
    const seedSQL = readFileSync(join(process.cwd(), 'test/rls/seed-multi-tenant.sql'), 'utf-8');
    const { error: seedError } = await serviceClient.rpc('exec_sql', { sql: seedSQL });
    if (seedError) {
      console.error('Failed to seed test data:', seedError);
      process.exit(1);
    }
    console.log('Test data seeded successfully');


    for (const org of ORGS) {
      console.log(`\nTesting as organization ${org.name} (${org.id})...`);
      await testOrgIsolation(org.id, org.name);
    }

    console.log('\nCleaning up test data...');
    await cleanup();

    console.log('\nAll RLS tests passed! Multi-tenant isolation is working correctly.');
  } catch (error) {
    console.error('RLS test suite failed:', error);
    process.exit(1);
  }
}

async function testOrgIsolation(orgId: string, orgName: string) {
  const email = orgEmail(orgId);
  const tenantClient = await getTenantClient({
    url: supabaseUrl,
    anonKey,
    email,
    password: TEST_USER_PASSWORD,
  });
  const otherOrg = ORGS.find((o) => o.id !== orgId)!;

  try {
    const companies = await tenantClient
      .from('companies')
      .select('id')
      .eq('id', orgId);
    if (companies.error) throw companies.error;
    const ownCompanyCount = companies.data?.length ?? 0;
    if (ownCompanyCount === 0) {
      throw new Error(`Expected company row for ${orgId}, found none`);
    }

    const crossCompanies = await tenantClient
      .from('companies')
      .select('id')
      .eq('id', otherOrg.id);
    if (crossCompanies.error) throw crossCompanies.error;
    if (crossCompanies.data && crossCompanies.data.length > 0) {
      throw new Error(`RLS breach: ${orgId} can see company ${otherOrg.id}`);
    }

    const ownCustomers = await tenantClient
      .from('customers')
      .select('id, company_id')
      .eq('company_id', orgId);
    if (ownCustomers.error) throw ownCustomers.error;
    if (!ownCustomers.data || ownCustomers.data.length === 0) {
      throw new Error(`Expected customers for ${orgId}, found none`);
    }

    const crossCustomers = await tenantClient
      .from('customers')
      .select('id')
      .eq('company_id', otherOrg.id);
    if (crossCustomers.error) throw crossCustomers.error;
    if (crossCustomers.data && crossCustomers.data.length > 0) {
      throw new Error(`RLS breach: ${orgId} can see customers for ${otherOrg.id}`);
    }

    const ownSessions = await tenantClient
      .from('voice_sessions')
      .select('id, company_id')
      .eq('company_id', orgId);
    if (ownSessions.error) throw ownSessions.error;
    if (!ownSessions.data || ownSessions.data.length === 0) {
      throw new Error(`Expected voice sessions for ${orgId}, found none`);
    }

    const crossSessions = await tenantClient
      .from('voice_sessions')
      .select('id')
      .eq('company_id', otherOrg.id);
    if (crossSessions.error) throw crossSessions.error;
    if (crossSessions.data && crossSessions.data.length > 0) {
      throw new Error(`RLS breach: ${orgId} can see voice sessions for ${otherOrg.id}`);
    }

    const ownMedia = await tenantClient
      .from('media_assets')
      .select('id, company_id')
      .eq('company_id', orgId);
    if (ownMedia.error) throw ownMedia.error;
    if (!ownMedia.data || ownMedia.data.length === 0) {
      throw new Error(`Expected media assets for ${orgId}, found none`);
    }

    const crossMedia = await tenantClient
      .from('media_assets')
      .select('id')
      .eq('company_id', otherOrg.id);
    if (crossMedia.error) throw crossMedia.error;
    if (crossMedia.data && crossMedia.data.length > 0) {
      throw new Error(`RLS breach: ${orgId} can see media assets for ${otherOrg.id}`);
    }

    const crossAttempt = await tenantClient
      .from('customers')
      .select('id')
      .eq('id', otherOrg.id === 'test-org-a' ? 'test-cust-a1' : 'test-cust-b1');
    if (crossAttempt.error && crossAttempt.error.code !== '42501') {
      throw crossAttempt.error;
    }
    if (crossAttempt.data && crossAttempt.data.length > 0) {
      throw new Error('RLS breach: cross-org direct access succeeded');
    }

    console.log(`  Companies visible: ${ownCompanyCount}`);
    console.log(`  Customers found for ${orgName}: ${ownCustomers.data?.length ?? 0}`);
    console.log(`  Cross-org customers visible: ${crossCustomers.data?.length ?? 0}`);
    console.log(`  Voice sessions for ${orgName}: ${ownSessions.data?.length ?? 0}`);
    console.log(`  Cross-org voice sessions visible: ${crossSessions.data?.length ?? 0}`);
    console.log(`  Media assets for ${orgName}: ${ownMedia.data?.length ?? 0}`);
    console.log(`  Cross-org media assets visible: ${crossMedia.data?.length ?? 0}`);
    console.log('  Cross-org direct access blocked as expected');
  } finally {
    await tenantClient.auth.signOut();
  }
}

async function cleanup() {
  const { error: customerCleanup } = await serviceClient
    .from('customers')
    .delete()
    .like('customer_number', 'TEST-%');
  if (customerCleanup) {
    console.warn(`  Customer cleanup warning: ${customerCleanup.message}`);
  } else {
    console.log('  Test customers cleaned up');
  }

  for (const table of ['voice_sessions', 'media_assets', 'companies']) {
    if (table === 'media_assets') {
      const { error } = await serviceClient
        .from('media_assets')
        .delete()
        .in('company_id', ORGS.map(o => o.id));
      if (error) {
        console.warn(`  Cleanup note for ${table}: ${error.message}`);
      } else {
        console.log(`  Test ${table} cleaned up`);
      }
    } else {
      const { error } = await serviceClient
        .from(table)
        .delete()
        .like('id', 'test-%');
      if (error) {
        console.warn(`  Cleanup note for ${table}: ${error.message}`);
      } else {
        console.log(`  Test ${table} cleaned up`);
      }
    }
  }
}

if (require.main === module) {
  runRLSTests().catch(console.error);
}

export { runRLSTests };

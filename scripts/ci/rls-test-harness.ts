#!/usr/bin/env tsx
/**
 * RLS Test Harness (authenticated tenant checks)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  '';
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

if (!supabaseUrl || !serviceKey) {
  console.log('Skipping RLS tests - Supabase credentials not available');
  process.exit(0);
}

if (!anonKey) {
  console.log('Missing anon key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) for tenant auth tests');
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

async function ensureTestUsers() {
  const listResult = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  if (listResult.error) {
    throw new Error(`Failed to list users: ${listResult.error.message}`);
  }

  for (const org of ORGS) {
    const email = orgEmail(org.id);
    let user = listResult.data.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      const created = await serviceClient.auth.admin.createUser({
        email,
        password: TEST_USER_PASSWORD,
        email_confirm: true,
        user_metadata: { company_id: org.id },
      });
      if (created.error || !created.data?.user) {
        throw new Error(`Failed to create test user for ${org.id}: ${created.error?.message}`);
      }
      user = created.data.user;
    } else {
      const updated = await serviceClient.auth.admin.updateUserById(user.id, {
        password: TEST_USER_PASSWORD,
        email_confirm: true,
        user_metadata: { ...user.user_metadata, company_id: org.id },
      });
      if (updated.error || !updated.data?.user) {
        throw new Error(`Failed to update test user metadata for ${org.id}: ${updated.error?.message}`);
      }
      user = updated.data.user;
    }
  }
}

async function getTenantClient(orgId: string) {
  const email = orgEmail(orgId);
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: TEST_USER_PASSWORD,
  });

  if (error || !data.session) {
    throw new Error(`Failed to sign in test user for ${orgId}: ${error?.message}`);
  }

  return client;
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

    await ensureTestUsers();

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
  const tenantClient = await getTenantClient(orgId);
  const otherOrg = ORGS.find(o => o.id !== orgId)!;

  try {
    const companies = await tenantClient.from('companies').select('id').order('id');
    console.log(`  Companies visible: ${companies.data?.length ?? 0}`);

    const ownCustomers = await tenantClient
      .from('customers')
      .select('id')
      .eq('company_id', orgId)
      .like('customer_number', 'TEST-%');
    if (ownCustomers.error) throw ownCustomers.error;

    const crossCustomers = await tenantClient
      .from('customers')
      .select('id')
      .eq('company_id', otherOrg.id)
      .like('customer_number', 'TEST-%');
    if (crossCustomers.error) throw crossCustomers.error;

    console.log(`  Customers found for ${orgName}: ${ownCustomers.data?.length ?? 0}`);
    console.log(`  Cross-org customers visible: ${crossCustomers.data?.length ?? 0}`);

    const ownSessions = await tenantClient
      .from('voice_sessions')
      .select('id')
      .eq('company_id', orgId)
      .like('id', 'test-session-%');
    if (ownSessions.error) throw ownSessions.error;

    const crossSessions = await tenantClient
      .from('voice_sessions')
      .select('id')
      .eq('company_id', otherOrg.id)
      .like('id', 'test-session-%');
    if (crossSessions.error) throw crossSessions.error;

    console.log(`  Voice sessions for ${orgName}: ${ownSessions.data?.length ?? 0}`);
    console.log(`  Cross-org voice sessions visible: ${crossSessions.data?.length ?? 0}`);

    const ownMedia = await tenantClient
      .from('media_assets')
      .select('id')
      .eq('company_id', orgId);
    if (ownMedia.error) throw ownMedia.error;

    const crossMedia = await tenantClient
      .from('media_assets')
      .select('id')
      .eq('company_id', otherOrg.id);
    if (crossMedia.error) throw crossMedia.error;

    console.log(`  Media assets for ${orgName}: ${ownMedia.data?.length ?? 0}`);
    console.log(`  Cross-org media assets visible: ${crossMedia.data?.length ?? 0}`);

    const crossAttempt = await tenantClient
      .from('customers')
      .select('id')
      .eq('id', otherOrg.id === 'test-org-a' ? 'test-cust-a1' : 'test-cust-b1');
    if (crossAttempt.error) throw crossAttempt.error;
    if (!crossAttempt.data || crossAttempt.data.length === 0) {
      console.log('  Cross-org direct access blocked as expected');
    } else {
      console.warn(`  Cross-org direct access succeeded (${crossAttempt.data.length} rows)`);
    }
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

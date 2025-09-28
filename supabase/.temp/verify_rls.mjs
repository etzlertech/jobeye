import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';
const TEST_PASSWORD = process.env.RLS_TEST_PASSWORD || 'TestPassword!123';
const EMAIL = 'test-org-a@jobeye.test';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing Supabase URL or anon key for verification.');
  process.exit(1);
}

const OUT_DIR = join(process.cwd(), 'supabase', '.temp');
mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const baseClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const companyId = EMAIL.split('@')[0] ?? null;

  await baseClient.auth
    .signUp({
      email: EMAIL,
      password: TEST_PASSWORD,
      options: {
        data: {
          company_id: companyId,
        },
      },
    })
    .catch(() => {});

  const signIn = await baseClient.auth.signInWithPassword({
    email: EMAIL,
    password: TEST_PASSWORD,
  });
  if (signIn.error || !signIn.data?.session?.access_token) {
    console.error('Failed to sign in tenant user:', signIn.error?.message);
    await baseClient.auth.signOut().catch(() => {});
    process.exit(1);
  }

  await baseClient.auth
    .updateUser({
      data: {
        company_id: companyId,
      },
    })
    .catch(() => {});

  const accessToken = signIn.data.session.access_token;
  const tenantClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: ANON_KEY,
      },
    },
  });

  const companiesResult = { data: [], error: null };
  const customersResult = { data: [], error: null };
  const mediaResult = { data: [], error: null };

  let fatalError = null;

  try {
    const companies = await tenantClient.from('companies').select('id').eq('id', companyId);
    if (companies.error) {
      companiesResult.error = companies.error.message ?? String(companies.error);
    } else {
      companiesResult.data = companies.data ?? [];
    }

    const customers = await tenantClient
      .from('customers')
      .select('id, company_id, customer_number')
      .eq('company_id', companyId);
    if (customers.error) {
      customersResult.error = customers.error.message ?? String(customers.error);
    } else {
      customersResult.data = customers.data ?? [];
    }

    const media = await tenantClient
      .from('media_assets')
      .select('id, company_id, asset_type')
      .eq('company_id', companyId);
    if (media.error) {
      mediaResult.error = media.error.message ?? String(media.error);
    } else {
      mediaResult.data = media.data ?? [];
    }
  } catch (err) {
    fatalError = err instanceof Error ? err : new Error(String(err));
    if (!companiesResult.error) {
      companiesResult.error = fatalError.message;
    }
    if (!customersResult.error) {
      customersResult.error = fatalError.message;
    }
    if (!mediaResult.error) {
      mediaResult.error = fatalError.message;
    }
  } finally {
    writeFileSync(join(OUT_DIR, 'companies_rls_check.txt'), JSON.stringify(companiesResult, null, 2));
    writeFileSync(join(OUT_DIR, 'customers_rls_check.txt'), JSON.stringify(customersResult, null, 2));
    writeFileSync(join(OUT_DIR, 'media_rls_check.txt'), JSON.stringify(mediaResult, null, 2));

    await tenantClient.auth.signOut().catch(() => {});
    await baseClient.auth.signOut().catch(() => {});
  }

  if (fatalError) {
    console.error('Verification encountered an error:', fatalError.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import * as Pg from 'pg';
import 'dotenv/config';

const cn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!cn) {
  console.error('Missing SUPABASE_DB_URL (or DATABASE_URL).');
  process.exit(1);
}

const SEED_COMPANY_ID = process.env.TEST_COMPANY_ID || '00000000-0000-4000-a000-000000000003';

type Check = { table: string; required: string[] };

const checks: Check[] = [
  { table: 'kits', required: ['company_id', 'kit_code', 'name'] },
  { table: 'kit_items', required: ['company_id', 'kit_id', 'item_type', 'quantity', 'unit', 'is_required'] }
];

async function main() {
  const client = new Pg.Client({ connectionString: cn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const check of checks) {
      const exists = await client.query(
        "select 1 from information_schema.tables where table_schema='public' and table_name=$1",
        [check.table]
      );
      if (exists.rows.length === 0) {
        console.error(`Table missing: ${check.table}`);
        process.exit(1);
      }
    }

    for (const check of checks) {
      const columnResult = await client.query(
        "select column_name from information_schema.columns where table_schema='public' and table_name=$1",
        [check.table]
      );
      const columns = columnResult.rows.map((row) => row.column_name);
      for (const required of check.required) {
        if (!columns.includes(required)) {
          console.error(`Column missing on ${check.table}: ${required}`);
          process.exit(1);
        }
      }
    }

    const rlsResult = await client.query(
      "select c.relname, c.relrowsecurity, c.relforcerowsecurity " +
        "from pg_class c " +
        "join information_schema.tables t on t.table_name=c.relname and t.table_schema='public' " +
        "where t.table_name in ('kits','kit_items','kit_variants')"
    );
    for (const row of rlsResult.rows) {
      if (row.relrowsecurity !== true || row.relforcerowsecurity !== true) {
        console.error(`RLS not enabled/forced on ${row.relname}`);
        process.exit(1);
      }
    }

    const policyResult = await client.query(
      "select tablename, policyname, qual, with_check from pg_policies " +
        "where schemaname='public' and tablename in ('kits','kit_items','kit_variants')"
    );

    const hasTenantPolicy = (table: string) => {
      return policyResult.rows.some((policy) => {
        if (policy.tablename !== table) { return false; }
        const payload = `${policy.qual || ''} ${policy.with_check || ''}`;
        return payload.indexOf('request.jwt.claims') !== -1 && payload.indexOf('company_id') !== -1;
      });
    };

    const hasServiceRolePolicy = (table: string) => {
      return policyResult.rows.some((policy) => {
        if (policy.tablename !== table) { return false; }
        const payload = `${policy.qual || ''} ${policy.with_check || ''}`;
        return payload.indexOf('auth.role()') !== -1 && payload.indexOf('service_role') !== -1;
      });
    };

    for (const table of ['kits', 'kit_items']) {
      if (!hasTenantPolicy(table)) {
        console.error(`Missing tenant policy for ${table}`);
        process.exit(1);
      }
      if (!hasServiceRolePolicy(table)) {
        console.error(`Missing service_role bypass policy for ${table}`);
        process.exit(1);
      }
    }

    const seedCheck = await client.query(
      'select 1 from public.kits where company_id=$1 limit 1',
      [SEED_COMPANY_ID]
    );
    if (seedCheck.rows.length === 0) {
      console.error('Seed data not found for SEED_COMPANY_ID');
      process.exit(1);
    }

    console.log('Preflight 003 passed');
  } catch (error) {
    console.error('Preflight 003 failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Preflight 003 failed:', error);
  process.exit(1);
});

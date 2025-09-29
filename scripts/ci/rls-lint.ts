import { Client } from 'pg';

const TABLES = ['companies', 'customers', 'media_assets', 'voice_sessions', 'vendors', 'vendor_aliases', 'vendor_locations', 'inventory_images', 'ocr_jobs', 'ocr_documents', 'ocr_line_items', 'ocr_note_entities'];

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL environment variable is required for rls-lint.');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

(async () => {
  await client.connect();

  const tableStatusRes = await client.query(
    `SELECT relname AS table_name, relrowsecurity, relforcerowsecurity
     FROM pg_class
     WHERE relname = ANY($1::text[])`
  , [TABLES]);

  const statusMap = new Map<string, { row: boolean; force: boolean }>();
  for (const row of tableStatusRes.rows) {
    statusMap.set(row.table_name, {
      row: row.relrowsecurity,
      force: row.relforcerowsecurity,
    });
  }

  const missingRls = TABLES.filter((table) => !statusMap.get(table)?.row);
  const missingForce = TABLES.filter((table) => !statusMap.get(table)?.force);

  const policiesRes = await client.query(
    `SELECT rel.relname AS table_name,
            pol.polname,
            rol.rolname,
            pol.polcmd,
            pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
            pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
     FROM pg_policy pol
     JOIN pg_class rel ON rel.oid = pol.polrelid
     JOIN pg_roles rol ON rol.oid = ANY(pol.polroles)
     WHERE rel.relname = ANY($1::text[])`
  , [TABLES]);

  const policiesByTable = new Map<string, { authenticated: boolean; service: boolean; policies: any[] }>();
  for (const table of TABLES) {
    policiesByTable.set(table, { authenticated: false, service: false, policies: [] });
  }

  for (const row of policiesRes.rows) {
    const entry = policiesByTable.get(row.table_name);
    if (!entry) continue;
    entry.policies.push(row);
    if (row.rolname === 'authenticated') entry.authenticated = true;
    if (row.rolname === 'service_role') entry.service = true;
  }

  const failures: string[] = [];
  if (missingRls.length > 0) {
    failures.push(`Tables missing row level security: ${missingRls.join(', ')}`);
  }
  if (missingForce.length > 0) {
    failures.push(`Tables missing FORCE RLS: ${missingForce.join(', ')}`);
  }

  for (const table of TABLES) {
    const entry = policiesByTable.get(table);
    if (!entry) continue;
    if (!entry.authenticated) {
      failures.push(`${table}: missing authenticated policy`);
    }
    if (!entry.service) {
      failures.push(`${table}: missing service_role policy`);
    }
  }

  console.log('RLS Policy Summary');
  console.log('-------------------');
  for (const table of TABLES) {
    const status = statusMap.get(table);
    const entry = policiesByTable.get(table);
    console.log(`${table} -> RLS=${status?.row ? 'on' : 'off'}, FORCE=${status?.force ? 'on' : 'off'}`);
    entry?.policies.forEach((row) => {
      console.log(`  policy ${row.polname} [${row.rolname}] cmd=${row.polcmd}`);
    });
  }

  await client.end();

  if (failures.length > 0) {
    console.error('\nRLS lint failures:');
    failures.forEach((f) => console.error(` - ${f}`));
    process.exit(1);
  }

  console.log('\nRLS lint passed.');
})();

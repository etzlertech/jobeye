import { Client } from 'pg';

type PolicyRow = {
  table_name: string;
  polname: string;
  polcmd: string;
  rolname: string | null;
  using_expr: string | null;
  check_expr: string | null;
};

const TABLES = [
  'companies',
  'customers',
  'media_assets',
  'voice_sessions',
  'vendors',
  'vendor_aliases',
  'vendor_locations',
  'inventory_images',
  'ocr_jobs',
  'ocr_documents',
  'ocr_line_items',
  'ocr_note_entities',
  'kits',
  'kit_items',
  'kit_variants',
  'kit_assignments',
  'kit_override_logs'
];

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL environment variable is required for rls-lint.');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const tenantMatch = (expr: string | null) => {
  if (!expr) return false;
  return expr.includes('request.jwt.claims') && expr.includes('company_id');
};

const serviceRoleMatch = (row: PolicyRow) => {
  if (row.rolname === 'service_role') {
    return true;
  }
  return (row.using_expr && row.using_expr.includes("auth.role()") && row.using_expr.includes("service_role")) ||
    (row.check_expr && row.check_expr.includes("auth.role()") && row.check_expr.includes("service_role"));
};

(async () => {
  await client.connect();

  const tableStatusRes = await client.query<{ table_name: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    `SELECT relname AS table_name, relrowsecurity, relforcerowsecurity
     FROM pg_class
     WHERE relname = ANY($1::text[])`,
    [TABLES]
  );

  const statusMap = new Map<string, { row: boolean; force: boolean }>();
  for (const row of tableStatusRes.rows) {
    statusMap.set(row.table_name, {
      row: row.relrowsecurity,
      force: row.relforcerowsecurity,
    });
  }

  const missingRls = TABLES.filter((table) => !statusMap.get(table)?.row);
  const missingForce = TABLES.filter((table) => !statusMap.get(table)?.force);

  const policiesRes = await client.query<PolicyRow>(
    `SELECT rel.relname AS table_name,
            pol.polname,
            pol.polcmd,
            rol.rolname,
            pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
            pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
     FROM pg_policy pol
     JOIN pg_class rel ON rel.oid = pol.polrelid
     LEFT JOIN pg_roles rol ON rol.oid = ANY(pol.polroles)
     WHERE rel.relname = ANY($1::text[])`,
    [TABLES]
  );

  const policiesByTable = new Map<string, { tenant: boolean; service: boolean; policies: PolicyRow[] }>();
  for (const table of TABLES) {
    policiesByTable.set(table, { tenant: false, service: false, policies: [] });
  }

  for (const row of policiesRes.rows) {
    const entry = policiesByTable.get(row.table_name);
    if (!entry) continue;
    entry.policies.push(row);
    if (!entry.tenant && (tenantMatch(row.using_expr) || tenantMatch(row.check_expr) || row.rolname === 'authenticated')) {
      entry.tenant = true;
    }
    if (!entry.service && serviceRoleMatch(row)) {
      entry.service = true;
    }
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
    if (!entry.tenant) {
      failures.push(`${table}: missing tenant company_id policy`);
    }
    if (!entry.service) {
      failures.push(`${table}: missing service_role bypass`);
    }
  }

  console.log('RLS Policy Summary');
  console.log('-------------------');
  for (const table of TABLES) {
    const status = statusMap.get(table);
    const entry = policiesByTable.get(table);
    console.log(`${table} -> RLS=${status?.row ? 'on' : 'off'}, FORCE=${status?.force ? 'on' : 'off'}`);
    entry?.policies.forEach((row) => {
      const usingExpr = row.using_expr ?? '<none>';
      const checkExpr = row.check_expr ?? '<none>';
      const roleLabel = row.rolname ?? 'public';
      console.log(`  policy ${row.polname} role=${roleLabel} cmd=${row.polcmd} using=${usingExpr} check=${checkExpr}`);
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

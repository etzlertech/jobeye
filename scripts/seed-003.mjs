import { Client } from 'pg';
import 'dotenv/config';

const cn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!cn) {
  console.error('Missing SUPABASE_DB_URL (or DATABASE_URL).');
  process.exit(1);
}

const SEED_COMPANY_ID = process.env.TEST_COMPANY_ID || '00000000-0000-4000-a000-000000000003';
const SEED_TENANT_ID = process.env.TEST_TENANT_ID || '00000000-0000-4000-a000-0000000000aa';
const SEED_COMPANY_NAME = process.env.TEST_COMPANY_NAME || 'Seed Org A';
const SEED_COMPANY_DOMAIN = process.env.TEST_COMPANY_DOMAIN || 'seed-003.test-org-a.local';
const SEED_NAMESPACE = 'seed-003';

const SEED_COMPANY = {
  id: SEED_COMPANY_ID,
  tenant_id: SEED_TENANT_ID,
  name: SEED_COMPANY_NAME,
  domain: SEED_COMPANY_DOMAIN,
  is_active: true
};

const KITS = [
  {
    kit_code: 'K-TOOLS',
    name: 'Essential Tools Kit',
    is_active: true,
    metadata: { template: 'tools', seed: SEED_NAMESPACE },
    items: [
      { seedKey: 'tool-set',     item_type: 'tool',     quantity: 1, unit: 'set',   is_required: true,  metadata: { label: 'Multi-tool set' } },
      { seedKey: 'safety-cones', item_type: 'equipment',quantity: 4, unit: 'units', is_required: false, metadata: { label: 'Safety cones' } },
      { seedKey: 'ice-melt',     item_type: 'material', quantity: 2, unit: 'bags',  is_required: true,  metadata: { label: 'Ice melt 50lb' } }
    ],
    variants: [
      { seedKey: 'winter', variant_code: 'WINTER', name: 'Winter Ready',  is_default: true,  metadata: { notes: 'Includes cold weather gear.' } },
      { seedKey: 'storm',  variant_code: 'STORM',  name: 'Storm Response', is_default: false, metadata: { notes: 'Adds tarps and pumps.' } }
    ]
  },
  {
    kit_code: 'K-STARTER',
    name: 'Starter Site Kit',
    is_active: true,
    metadata: { template: 'starter', seed: SEED_NAMESPACE },
    items: [
      { seedKey: 'welcome-pack', item_type: 'material', quantity: 1, unit: 'pack', is_required: true,  metadata: { label: 'Customer welcome pack' } },
      { seedKey: 'cleanup-rags', item_type: 'material', quantity: 5, unit: 'pcs',  is_required: false, metadata: { label: 'Cleanup rags' } }
    ],
    variants: []
  }
];

function ensureBoolean(value) {
  return value ? true : false;
}

function withSeedMetadata(base, seedKey) {
  const merged = Object.assign({}, base || {});
  merged.seed_key = seedKey;
  merged.seed = SEED_NAMESPACE;
  return merged;
}

async function tableExists(client, table) {
  const q = "select 1 from information_schema.tables where table_schema='public' and table_name=$1 limit 1";
  const r = await client.query(q, [table]);
  return r.rows.length > 0;
}

async function ensureTables(client) {
  const required = ['companies', 'kits', 'kit_items'];
  for (const t of required) {
    if (!(await tableExists(client, t))) {
      console.error('Required table missing: ' + t + '. Did you run migrations?');
      process.exit(1);
    }
  }
}

async function ensureCompany(client, company) {
  const sql = [
    'insert into public.companies (id, tenant_id, name, domain, is_active)',
    'values ($1, $2, $3, $4, $5)',
    'on conflict (id) do update',
    '  set tenant_id = excluded.tenant_id,',
    '      name = excluded.name,',
    '      domain = excluded.domain,',
    '      is_active = excluded.is_active,',
    '      updated_at = now()'
  ].join(' ');
  const params = [company.id, company.tenant_id, company.name, company.domain, ensureBoolean(company.is_active)];
  await client.query(sql, params);
}

async function upsertKit(client, companyId, kit) {
  const sql = [
    'insert into public.kits (id, company_id, kit_code, name, is_active, metadata)',
    'values (gen_random_uuid(), $1, $2, $3, $4, $5)',
    'on conflict (company_id, kit_code) do update',
    '  set name = excluded.name,',
    '      is_active = excluded.is_active,',
    "      metadata = coalesce(public.kits.metadata, '{}'::jsonb) || excluded.metadata",
    'returning id'
  ].join(' ');
  const params = [companyId, kit.kit_code, kit.name, ensureBoolean(kit.is_active), kit.metadata || {}];
  const r = await client.query(sql, params);
  return r.rows[0].id;
}

async function upsertKitItem(client, companyId, kitId, item) {
  const seedKey = String(item.seedKey);
  const findSql = "select id from public.kit_items where company_id=$1 and kit_id=$2 and (metadata->>'seed_key')=$3 limit 1";
  const existing = await client.query(findSql, [companyId, kitId, seedKey]);
  const metadata = withSeedMetadata(item.metadata, seedKey);
  if (existing.rowCount > 0) {
    const updateSql = [
      'update public.kit_items',
      '   set item_type=$1, quantity=$2, unit=$3, is_required=$4, metadata=$5, updated_at=now()',
      ' where id=$6'
    ].join(' ');
    await client.query(updateSql, [item.item_type, item.quantity, item.unit, ensureBoolean(item.is_required), metadata, existing.rows[0].id]);
    return existing.rows[0].id;
  }
  const insertSql = [
    'insert into public.kit_items (id, company_id, kit_id, item_type, quantity, unit, is_required, metadata)',
    'values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)',
    'returning id'
  ].join(' ');
  const params = [companyId, kitId, item.item_type, item.quantity, item.unit, ensureBoolean(item.is_required), metadata];
  const r = await client.query(insertSql, params);
  return r.rows[0].id;
}

async function upsertVariant(client, companyId, kitId, variant) {
  const hasVariants = await tableExists(client, 'kit_variants');
  if (!hasVariants) {
    return null;
  }
  const seedKey = String(variant.seedKey);
  const findSql = "select id from public.kit_variants where company_id=$1 and kit_id=$2 and (metadata->>'seed_key')=$3 limit 1";
  const existing = await client.query(findSql, [companyId, kitId, seedKey]);
  const metadata = withSeedMetadata(variant.metadata, seedKey);
  if (existing.rowCount > 0) {
    const updateSql = [
      'update public.kit_variants',
      '   set variant_code=$1, name=$2, is_default=$3, metadata=$4, updated_at=now()',
      ' where id=$5',
      ' returning id'
    ].join(' ');
    const r = await client.query(updateSql, [variant.variant_code, variant.name, ensureBoolean(variant.is_default), metadata, existing.rows[0].id]);
    return r.rows[0].id;
  }
  const insertSql = [
    'insert into public.kit_variants (id, company_id, kit_id, variant_code, name, is_default, metadata)',
    'values (gen_random_uuid(), $1, $2, $3, $4, $5, $6)',
    'returning id'
  ].join(' ');
  const r = await client.query(insertSql, [companyId, kitId, variant.variant_code, variant.name, ensureBoolean(variant.is_default), metadata]);
  return r.rows[0].id;
}

async function upsertAssignment(client, companyId, kitId, variantId) {
  const hasAssignments = await tableExists(client, 'kit_assignments');
  if (!hasAssignments) {
    return;
  }
  const sql = [
    'insert into public.kit_assignments (id, company_id, kit_id, variant_id, external_ref, notes, metadata)',
    'values (gen_random_uuid(), $1, $2, $3, $4, $5, $6)',
    'on conflict (company_id, external_ref) do update set',
    '  kit_id = excluded.kit_id,',
    '  variant_id = excluded.variant_id,',
    '  notes = excluded.notes,',
    "  metadata = coalesce(public.kit_assignments.metadata, '{}'::jsonb) || excluded.metadata,",
    '  updated_at = now()'
  ].join(' ');
  const params = [companyId, kitId, variantId, 'DEMO-ASSIGN-001', 'Demo assignment for Scheduling Kits MVF seed', { seed: SEED_NAMESPACE }];
  await client.query(sql, params);
}

async function countRows(client, table, companyId) {
  if (!(await tableExists(client, table))) {
    return { table: table, count: '(table missing)' };
  }
  let sql;
  switch (table) {
    case 'kits':
      sql = 'select count(*)::int as c from public.kits where company_id=$1';
      break;
    case 'kit_items':
      sql = 'select count(*)::int as c from public.kit_items where company_id=$1';
      break;
    case 'kit_variants':
      sql = 'select count(*)::int as c from public.kit_variants where company_id=$1';
      break;
    case 'kit_assignments':
      sql = 'select count(*)::int as c from public.kit_assignments where company_id=$1';
      break;
    case 'kit_override_logs':
      sql = 'select count(*)::int as c from public.kit_override_logs where company_id=$1';
      break;
    default:
      sql = null;
  }
  if (!sql) {
    return { table: table, count: '?' };
  }
  const r = await client.query(sql, [companyId]);
  return { table: table, count: r.rows[0].c };
}

async function main() {
  const client = new Client({ connectionString: cn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ company_id: SEED_COMPANY_ID, role: 'service_role' })]);
    await ensureTables(client);
    await client.query('begin');
    await ensureCompany(client, SEED_COMPANY);
    for (const kit of KITS) {
      const kitId = await upsertKit(client, SEED_COMPANY_ID, kit);
      for (const item of kit.items) {
        await upsertKitItem(client, SEED_COMPANY_ID, kitId, item);
      }
      let defaultVariantId = null;
      for (const variant of kit.variants) {
        const variantId = await upsertVariant(client, SEED_COMPANY_ID, kitId, variant);
        if (variant && ensureBoolean(variant.is_default)) {
          defaultVariantId = variantId;
        }
      }
      if (kit.kit_code === 'K-TOOLS') {
        await upsertAssignment(client, SEED_COMPANY_ID, kitId, defaultVariantId);
      }
    }
    await client.query('commit');
    const tables = ['kits', 'kit_items', 'kit_variants', 'kit_assignments', 'kit_override_logs'];
    for (const t of tables) {
      const info = await countRows(client, t, SEED_COMPANY_ID);
      console.log(info.table + ': ' + info.count);
    }
    console.log('Seed complete for company_id ' + SEED_COMPANY_ID);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

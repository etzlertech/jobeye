#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkDualColumns() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking tables with BOTH tenant_id and company_id...\n');

  const tables = ['containers', 'media_assets', 'inventory_items', 'vision_cost_records', 'kits', 'kit_overrides'];

  for (const table of tables) {
    console.log(`\n📋 ${table}:`);

    // Try to select both columns
    const { data, error } = await client
      .from(table)
      .select('id, tenant_id, company_id')
      .limit(3);

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
      continue;
    }

    if (!data || data.length === 0) {
      console.log(`  ℹ️  Table is empty`);
      continue;
    }

    console.log(`  ✅ ${data.length} rows found`);

    // Check if values match
    for (const row of data) {
      const match = row.tenant_id === row.company_id;
      const status = match ? '✅ MATCH' : '❌ MISMATCH';
      console.log(`    ${status}: tenant_id=${row.tenant_id}, company_id=${row.company_id}`);
    }
  }
}

checkDualColumns().catch(console.error);
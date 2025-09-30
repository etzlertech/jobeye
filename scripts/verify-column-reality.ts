#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyColumnReality() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Verifying Column Reality with Actual Data Queries...\n');

  const tables = ['jobs', 'containers', 'kits', 'kit_items'];

  for (const table of tables) {
    console.log(`\n📋 ${table}:`);

    try {
      // Try to select both columns with actual data
      const { data, error } = await client
        .from(table)
        .select('id, tenant_id, company_id')
        .limit(1);

      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
        console.log(`  Code: ${error.code}`);
      } else if (data && data.length > 0) {
        const row = data[0];
        console.log(`  ✅ Query succeeded`);
        console.log(`  tenant_id: ${row.tenant_id !== undefined ? 'EXISTS' : 'MISSING'} = ${row.tenant_id}`);
        console.log(`  company_id: ${row.company_id !== undefined ? 'EXISTS' : 'MISSING'} = ${row.company_id}`);
      } else {
        console.log(`  ℹ️  Table empty`);
      }
    } catch (e: any) {
      console.log(`  ⚠️  Exception: ${e.message}`);
    }
  }
}

verifyColumnReality().catch(console.error);
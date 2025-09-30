#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyColumns() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Verifying Dual Column Reality...\n');

  // Check tables with actual data
  const tablesToCheck = ['jobs', 'customers', 'kits', 'kit_items', 'properties'];

  for (const table of tablesToCheck) {
    console.log(`\n📋 ${table}:`);

    try {
      // Try to select both columns
      const { data, error } = await client
        .from(table)
        .select('id, tenant_id, company_id')
        .limit(2);

      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
        console.log(`  Details: ${JSON.stringify(error, null, 2)}`);
        continue;
      }

      if (!data || data.length === 0) {
        console.log(`  ℹ️  Empty table`);
        continue;
      }

      console.log(`  ✅ Retrieved ${data.length} rows`);

      for (const row of data) {
        const tenantId = row.tenant_id;
        const companyId = row.company_id;

        if (tenantId && companyId) {
          const match = tenantId === companyId;
          console.log(`    Row ${row.id}:`);
          console.log(`      tenant_id:  ${tenantId}`);
          console.log(`      company_id: ${companyId}`);
          console.log(`      Match: ${match ? '✅ YES' : '❌ NO - DIFFERENT VALUES!'}`);
        } else {
          console.log(`    Row ${row.id}: tenant_id=${tenantId}, company_id=${companyId}`);
        }
      }
    } catch (err: any) {
      console.log(`  ⚠️  ${err.message}`);
    }
  }
}

verifyColumns().catch(console.error);
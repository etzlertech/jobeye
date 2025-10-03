#!/usr/bin/env npx tsx
/**
 * Fix RLS policies for unified inventory tables
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function fixPolicies() {
  console.log('🔧 Fixing RLS policies for unified inventory tables...\n');

  // Drop existing policies if any
  const dropStatements = [
    `DROP POLICY IF EXISTS "items_tenant_isolation" ON items;`,
    `DROP POLICY IF EXISTS "items_admin_access" ON items;`,
    `DROP POLICY IF EXISTS "transactions_tenant_isolation" ON item_transactions;`,
    `DROP POLICY IF EXISTS "transactions_admin_access" ON item_transactions;`
  ];

  for (const sql of dropStatements) {
    console.log(`Dropping old policy: ${sql.substring(0, 50)}...`);
    const { error } = await client.rpc('exec_sql', { sql });
    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Success`);
    }
  }

  // Create simplified policies without user_roles dependency
  const createStatements = [
    // Items policies
    `CREATE POLICY "items_tenant_isolation" ON items
     FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')::uuid);`,
    
    `CREATE POLICY "items_service_role" ON items
     FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');`,
    
    // Transactions policies
    `CREATE POLICY "transactions_tenant_isolation" ON item_transactions
     FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')::uuid);`,
    
    `CREATE POLICY "transactions_service_role" ON item_transactions
     FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');`
  ];

  console.log('\n📝 Creating new policies...\n');

  for (const sql of createStatements) {
    console.log(`Creating policy: ${sql.substring(0, 60)}...`);
    const { error } = await client.rpc('exec_sql', { sql });
    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Success`);
    }
  }

  // Verify the policies
  console.log('\n🔍 Verifying policies...');
  
  const { data: policies } = await client.rpc('exec_sql', {
    sql: `
      SELECT schemaname, tablename, policyname 
      FROM pg_policies 
      WHERE tablename IN ('items', 'item_transactions')
      ORDER BY tablename, policyname;
    `
  });

  if (policies && policies.length > 0) {
    console.log('\n✅ Active policies:');
    policies.forEach((p: any) => console.log(`   - ${p.tablename}.${p.policyname}`));
  }

  console.log('\n✅ Policy fixes completed!');
}

fixPolicies().catch(console.error);
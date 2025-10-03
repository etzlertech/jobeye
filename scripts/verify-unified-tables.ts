#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function verifyUnifiedTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Verifying unified inventory tables...\n');

  try {
    // Try to query items table
    console.log('1. Testing "items" table:');
    try {
      const { data, error, count } = await client
        .from('items')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ Table does not exist or error: ${error.message}`);
      } else {
        console.log(`   ✅ Table exists`);
        console.log(`   📊 Row count: ${count || 0}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err}`);
    }

    // Try to query item_transactions table
    console.log('\n2. Testing "item_transactions" table:');
    try {
      const { data, error, count } = await client
        .from('item_transactions')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ Table does not exist or error: ${error.message}`);
      } else {
        console.log(`   ✅ Table exists`);
        console.log(`   📊 Row count: ${count || 0}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err}`);
    }

    // Check container_assignments table (should still exist)
    console.log('\n3. Testing "container_assignments" table:');
    try {
      const { data, error, count } = await client
        .from('container_assignments')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ Table does not exist or error: ${error.message}`);
      } else {
        console.log(`   ✅ Table exists`);
        console.log(`   📊 Row count: ${count || 0}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err}`);
    }

    // Check containers table (should still exist)
    console.log('\n4. Testing "containers" table:');
    try {
      const { data, error, count } = await client
        .from('containers')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ Table does not exist or error: ${error.message}`);
      } else {
        console.log(`   ✅ Table exists`);
        console.log(`   📊 Row count: ${count || 0}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err}`);
    }

    // Check old tables that should be migrated eventually
    console.log('\n5. Checking legacy tables (to be migrated):');
    const legacyTables = ['equipment', 'inventory_items', 'tools', 'materials'];
    
    for (const tableName of legacyTables) {
      try {
        const { error, count } = await client
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`   - ${tableName}: Does not exist ✓`);
        } else {
          console.log(`   - ${tableName}: Still exists (${count || 0} rows)`);
        }
      } catch (err) {
        console.log(`   - ${tableName}: Error checking`);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  console.log('\n✅ Verification complete!');
}

verifyUnifiedTables().catch(console.error);
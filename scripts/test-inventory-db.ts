#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testInventoryDatabase() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Testing JobEye Inventory Database Setup...\n');

  // Test 1: Check if items table exists
  console.log('📊 Checking items table...');
  const { data: itemsData, error: itemsError } = await client
    .from('items')
    .select('*')
    .limit(1);

  if (itemsError) {
    if (itemsError.code === '42P01') {
      console.log('❌ items table does not exist');
      console.log('   Run migration: 20251003_create_unified_inventory_schema.sql');
    } else {
      console.log('❌ Error accessing items table:', itemsError.message);
    }
  } else {
    console.log('✅ items table exists');
    console.log('   Sample data:', itemsData);
  }

  // Test 2: Check if item_transactions table exists
  console.log('\n📊 Checking item_transactions table...');
  const { data: transData, error: transError } = await client
    .from('item_transactions')
    .select('*')
    .limit(1);

  if (transError) {
    if (transError.code === '42P01') {
      console.log('❌ item_transactions table does not exist');
      console.log('   Run migration: 20251003_create_unified_inventory_schema.sql');
    } else {
      console.log('❌ Error accessing item_transactions table:', transError.message);
    }
  } else {
    console.log('✅ item_transactions table exists');
    console.log('   Sample data:', transData);
  }

  // Test 3: Try to create a test item
  console.log('\n🧪 Testing item creation...');
  const testItem = {
    tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e', // Demo tenant
    item_type: 'equipment',
    category: 'lawn_care',
    tracking_mode: 'individual',
    name: 'Test Mower ' + Date.now(),
    description: 'Test mower for inventory system',
    status: 'active',
    current_quantity: 1,
    unit_of_measure: 'each'
  };

  const { data: createdItem, error: createError } = await client
    .from('items')
    .insert(testItem)
    .select()
    .single();

  if (createError) {
    console.log('❌ Failed to create test item:', createError.message);
    if (createError.code === '42P01') {
      console.log('   The items table needs to be created first');
    }
  } else {
    console.log('✅ Successfully created test item:', createdItem);

    // Test 4: Create a transaction for the item
    console.log('\n🧪 Testing transaction creation...');
    const testTransaction = {
      tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
      transaction_type: 'check_in',
      item_id: createdItem.id,
      quantity: 1,
      notes: 'Initial check-in'
    };

    const { data: createdTrans, error: transCreateError } = await client
      .from('item_transactions')
      .insert(testTransaction)
      .select()
      .single();

    if (transCreateError) {
      console.log('❌ Failed to create transaction:', transCreateError.message);
    } else {
      console.log('✅ Successfully created transaction:', createdTrans);
    }

    // Test 5: Query the item with its transactions
    console.log('\n🔍 Testing item retrieval...');
    const { data: retrievedItem, error: retrieveError } = await client
      .from('items')
      .select('*')
      .eq('id', createdItem.id)
      .single();

    if (retrieveError) {
      console.log('❌ Failed to retrieve item:', retrieveError.message);
    } else {
      console.log('✅ Successfully retrieved item:', retrievedItem);
    }
  }

  // Test 6: Check RLS policies
  console.log('\n🔒 Checking RLS policies...');
  const { data: rlsData, error: rlsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename IN ('items', 'item_transactions')
      ORDER BY tablename, policyname;
    `
  });

  if (rlsError) {
    console.log('⚠️  Could not check RLS policies (exec_sql function may not exist)');
  } else {
    console.log('✅ RLS policies found:', rlsData);
  }

  console.log('\n📋 Summary:');
  console.log('- Items table:', itemsError ? '❌ Not ready' : '✅ Ready');
  console.log('- Transactions table:', transError ? '❌ Not ready' : '✅ Ready');
  console.log('- CRUD operations:', createError ? '❌ Not working' : '✅ Working');
  
  if (itemsError || transError) {
    console.log('\n⚠️  Action Required:');
    console.log('Run the migration to create inventory tables:');
    console.log('npx tsx scripts/apply-inventory-migration.ts');
  }
}

testInventoryDatabase().catch(console.error);
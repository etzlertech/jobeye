#!/usr/bin/env npx tsx
/**
 * Verify the unified inventory schema was created correctly
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function verifySchema() {
  console.log('🔍 Verifying unified inventory schema...\n');

  // 1. Check if tables exist
  console.log('📋 Checking table existence:');
  const { data: tables } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('items', 'item_transactions', 'container_assignments', 'containers')
      ORDER BY table_name;
    `
  });

  if (tables) {
    console.log('✅ Found tables:');
    tables.forEach((t: any) => console.log(`   - ${t.table_name}`));
  }

  // 2. Check items table structure
  console.log('\n📋 Items table structure:');
  const { data: itemsCols } = await client.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'items'
      ORDER BY ordinal_position
      LIMIT 10;
    `
  });

  if (itemsCols && itemsCols.length > 0) {
    console.log('✅ Key columns:');
    itemsCols.forEach((c: any) => console.log(`   - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
  }

  // 3. Check indexes
  console.log('\n📋 Indexes on items table:');
  const { data: indexes } = await client.rpc('exec_sql', {
    sql: `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'items'
      AND schemaname = 'public';
    `
  });

  if (indexes && indexes.length > 0) {
    console.log(`✅ Found ${indexes.length} indexes`);
    indexes.forEach((i: any) => console.log(`   - ${i.indexname}`));
  }

  // 4. Check RLS policies
  console.log('\n📋 RLS Policies:');
  const { data: policies } = await client.rpc('exec_sql', {
    sql: `
      SELECT tablename, policyname, cmd, qual
      FROM pg_policies
      WHERE tablename IN ('items', 'item_transactions')
      ORDER BY tablename, policyname;
    `
  });

  if (policies && policies.length > 0) {
    console.log('✅ Active policies:');
    policies.forEach((p: any) => console.log(`   - ${p.tablename}.${p.policyname} (${p.cmd})`));
  }

  // 5. Test insert capability
  console.log('\n📋 Testing insert capability:');
  const testItem = {
    tenant_id: '00000000-0000-0000-0000-000000000000',
    item_type: 'tool',
    category: 'test',
    tracking_mode: 'individual',
    name: 'Test Item',
    status: 'active'
  };

  const { data: inserted, error: insertError } = await client
    .from('items')
    .insert(testItem)
    .select()
    .single();

  if (insertError) {
    console.log(`⚠️  Insert test failed: ${insertError.message}`);
  } else {
    console.log('✅ Insert test successful');
    
    // Clean up test data
    await client.from('items').delete().eq('id', inserted.id);
  }

  // 6. Check for legacy tables
  console.log('\n📋 Legacy tables (to be migrated):');
  const { data: legacyTables } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('equipment', 'inventory_items', 'tools', 'materials')
      ORDER BY table_name;
    `
  });

  if (legacyTables && legacyTables.length > 0) {
    console.log('⚠️  Legacy tables still present (expected):');
    legacyTables.forEach((t: any) => console.log(`   - ${t.table_name}`));
  } else {
    console.log('✅ No legacy tables found');
  }

  console.log('\n✅ Verification complete!');
}

verifySchema().catch(console.error);
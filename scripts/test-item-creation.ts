#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testItemCreation() {
  console.log('🧪 Testing minimal item creation...\n');

  // Test 1: Absolute minimum
  const minimal = {
    tenant_id: '00000000-0000-0000-0000-000000000000',
    item_type: 'material',
    name: 'Test Material',
    tracking_mode: 'quantity',
    current_quantity: 0,
    unit_of_measure: 'each'
  };

  console.log('Attempting minimal insert:', minimal);
  
  const { data: item1, error: error1 } = await client
    .from('items')
    .insert(minimal)
    .select()
    .single();

  if (error1) {
    console.error('❌ Minimal insert failed:', error1);
  } else {
    console.log('✅ Success! Created item:', item1);
    // Clean up
    await client.from('items').delete().eq('id', item1.id);
  }

  // Test 2: Check enums
  console.log('\n📋 Checking valid enum values...');
  
  // Try different item types
  const types = ['equipment', 'material', 'tool', 'consumable'];
  for (const type of types) {
    const test = { ...minimal, item_type: type, name: `Test ${type}` };
    const { error } = await client.from('items').insert(test);
    console.log(`  ${type}: ${error ? '❌' : '✅'}`);
    if (!error) {
      await client.from('items').delete().eq('name', test.name);
    }
  }

  // Try different tracking modes
  console.log('\n📊 Checking tracking modes...');
  const modes = ['individual', 'quantity', 'batch'];
  for (const mode of modes) {
    const test = { ...minimal, tracking_mode: mode, name: `Test ${mode}` };
    const { error } = await client.from('items').insert(test);
    console.log(`  ${mode}: ${error ? '❌' : '✅'}`);
    if (!error) {
      await client.from('items').delete().eq('name', test.name);
    }
  }
}

testItemCreation().catch(console.error);
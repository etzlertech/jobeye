#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Verifying Vision Tables\n');
  console.log('='.repeat(60));

  // Check vision_detected_items
  const { error: detectedError } = await client
    .from('vision_detected_items')
    .select('*')
    .limit(0);

  console.log('\n📦 vision_detected_items:');
  if (detectedError) {
    console.log('   ❌ NOT ACCESSIBLE');
    console.log('   Error:', detectedError.message);
  } else {
    console.log('   ✅ EXISTS and accessible');
    
    // Try to insert a test row
    const testInsert = await client
      .from('vision_detected_items')
      .insert({})
      .select();
    
    const columns = testInsert.error?.message?.match(/column "([^"]+)"/g)?.map(m => m.replace(/column "|"/g, '')) || [];
    console.log('   📋 Required columns:', columns.slice(0, 5).join(', ') + '...');
  }

  // Check vision_cost_records
  const { error: costError } = await client
    .from('vision_cost_records')
    .select('*')
    .limit(0);

  console.log('\n📦 vision_cost_records:');
  if (costError) {
    console.log('   ❌ NOT ACCESSIBLE');
    console.log('   Error:', costError.message);
  } else {
    console.log('   ✅ EXISTS and accessible');
    
    // Try to insert a test row
    const testInsert = await client
      .from('vision_cost_records')
      .insert({})
      .select();
    
    const columns = testInsert.error?.message?.match(/column "([^"]+)"/g)?.map(m => m.replace(/column "|"/g, '')) || [];
    console.log('   📋 Required columns:', columns.slice(0, 5).join(', ') + '...');
  }

  // Check get_daily_vision_costs function
  console.log('\n⚙️  get_daily_vision_costs function:');
  const { data: funcData, error: funcError } = await client.rpc('get_daily_vision_costs', {
    p_company_id: '00000000-0000-0000-0000-000000000001',
    p_date: '2025-09-30'
  });

  if (funcError) {
    console.log('   ❌ NOT WORKING');
    console.log('   Error:', funcError.message);
  } else {
    console.log('   ✅ WORKING');
    console.log('   Test result:', funcData);
  }

  console.log('\n' + '='.repeat(60));
  
  if (!detectedError && !costError && !funcError) {
    console.log('\n🎉 SUCCESS! All vision tables and functions ready\n');
    return true;
  } else {
    console.log('\n❌ Some tables or functions are not ready\n');
    return false;
  }
}

verifyTables().catch(console.error);

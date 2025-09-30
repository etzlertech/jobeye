#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkMissingTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking for vision tables that should exist...\n');

  // Check vision_detected_items
  const { error: detectedError } = await client
    .from('vision_detected_items')
    .select('count')
    .limit(0);

  if (detectedError) {
    console.log('❌ vision_detected_items: MISSING');
    console.log(`   Error: ${detectedError.message}`);
    console.log('   📄 Migration exists: supabase/migrations/040_vision_detected_items.sql');
    console.log('   🔧 Action: This migration needs to be applied to live database\n');
  } else {
    console.log('✅ vision_detected_items: EXISTS\n');
  }

  // Check vision_cost_records
  const { error: costError } = await client
    .from('vision_cost_records')
    .select('count')
    .limit(0);

  if (costError) {
    console.log('❌ vision_cost_records: MISSING');
    console.log(`   Error: ${costError.message}`);
    console.log('   📄 Migration exists: supabase/migrations/041_vision_cost_records.sql');
    console.log('   🔧 Action: This migration needs to be applied to live database\n');
  } else {
    console.log('✅ vision_cost_records: EXISTS\n');
  }

  // Check for any other references to these tables in code
  console.log('📊 Impact Analysis:\n');
  console.log('Files depending on vision_detected_items:');
  console.log('  - src/domains/vision/repositories/detected-item.repository.ts');
  console.log('  - Multiple vision E2E tests');
  
  console.log('\nFiles depending on vision_cost_records:');
  console.log('  - src/domains/vision/repositories/cost-record.repository.ts');
  console.log('  - Vision cost tracking service');
  console.log('  - Multiple vision E2E tests');

  console.log('\n⚠️  These missing tables explain the 26 failing vision E2E tests!');
}

checkMissingTables().catch(console.error);

#!/usr/bin/env npx tsx
/**
 * Apply Missing Vision Migrations
 *
 * Purpose: Apply vision_detected_items and vision_cost_records migrations to live database
 *
 * Background:
 * - Migration files exist in supabase/migrations/
 * - Tables do NOT exist in live database
 * - Traditional migration methods don't work with hosted Supabase
 * - Must use exec_sql RPC method (proven working pattern)
 *
 * Impact:
 * - Will fix 26 failing vision E2E tests
 * - Will enable cost tracking functionality
 * - Will enable detailed YOLO detection storage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

async function applyVisionMigrations() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Applying Missing Vision Migrations\n');
  console.log('='.repeat(60));

  // Check if tables already exist
  console.log('\n📋 Pre-flight checks...\n');

  const { error: detectedError } = await client
    .from('vision_detected_items')
    .select('count')
    .limit(0);

  const { error: costError } = await client
    .from('vision_cost_records')
    .select('count')
    .limit(0);

  if (!detectedError && !costError) {
    console.log('✅ Both tables already exist!');
    console.log('   vision_detected_items: EXISTS');
    console.log('   vision_cost_records: EXISTS');
    console.log('\nNo migrations needed. Exiting.');
    return;
  }

  // Apply Migration 1: vision_detected_items
  if (detectedError) {
    console.log('📦 Migration 1: vision_detected_items');
    console.log('   Status: Table does not exist');
    console.log('   Action: Creating table...\n');

    const migration1Path = path.join(
      process.cwd(),
      'supabase/migrations/040_vision_detected_items.sql'
    );

    const migration1Sql = fs.readFileSync(migration1Path, 'utf-8');

    const { error: migration1Error } = await client.rpc('exec_sql', {
      sql: migration1Sql,
    });

    if (migration1Error) {
      console.error('❌ Failed to apply migration 040_vision_detected_items:');
      console.error('   Error:', migration1Error.message);
      console.error('   Details:', migration1Error);
      process.exit(1);
    }

    console.log('✅ Migration 040_vision_detected_items applied successfully!\n');
  } else {
    console.log('✅ vision_detected_items already exists, skipping\n');
  }

  // Apply Migration 2: vision_cost_records
  if (costError) {
    console.log('📦 Migration 2: vision_cost_records');
    console.log('   Status: Table does not exist');
    console.log('   Action: Creating table...\n');

    const migration2Path = path.join(
      process.cwd(),
      'supabase/migrations/041_vision_cost_records.sql'
    );

    const migration2Sql = fs.readFileSync(migration2Path, 'utf-8');

    const { error: migration2Error } = await client.rpc('exec_sql', {
      sql: migration2Sql,
    });

    if (migration2Error) {
      console.error('❌ Failed to apply migration 041_vision_cost_records:');
      console.error('   Error:', migration2Error.message);
      console.error('   Details:', migration2Error);
      process.exit(1);
    }

    console.log('✅ Migration 041_vision_cost_records applied successfully!\n');
  } else {
    console.log('✅ vision_cost_records already exists, skipping\n');
  }

  // Verify tables were created
  console.log('🔍 Post-migration verification...\n');

  const { error: verifyDetected } = await client
    .from('vision_detected_items')
    .select('count')
    .limit(0);

  const { error: verifyCost } = await client
    .from('vision_cost_records')
    .select('count')
    .limit(0);

  if (verifyDetected) {
    console.error('❌ Verification failed: vision_detected_items still not accessible');
    console.error('   Error:', verifyDetected.message);
    process.exit(1);
  }

  if (verifyCost) {
    console.error('❌ Verification failed: vision_cost_records still not accessible');
    console.error('   Error:', verifyCost.message);
    process.exit(1);
  }

  console.log('✅ vision_detected_items: VERIFIED');
  console.log('✅ vision_cost_records: VERIFIED');

  console.log('\n' + '='.repeat(60));
  console.log('🎉 SUCCESS! All vision migrations applied\n');
  console.log('📊 Impact:');
  console.log('   - vision_detected_items table created');
  console.log('   - vision_cost_records table created');
  console.log('   - get_daily_vision_costs() function created');
  console.log('   - Indexes created for performance');
  console.log('   - ~26 E2E tests should now pass\n');
  console.log('🔧 Next Steps:');
  console.log('   1. Run E2E tests: npm test -- vision');
  console.log('   2. Verify cost tracking: Check vision_cost_records table');
  console.log('   3. Verify detection storage: Check vision_detected_items table\n');
}

applyVisionMigrations().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
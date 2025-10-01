#!/usr/bin/env npx tsx
/**
 * T000: Database Precheck for Feature 006
 * Simplified direct query approach
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function precheck() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 T000: Database Precheck - Feature 001/007 Schema\n');

  const tables = [
    { name: 'vision_verifications', desc: 'Feature 001 base table' },
    { name: 'vision_detected_items', desc: 'Feature 001 detected objects' },
    { name: 'vision_cost_records', desc: 'Feature 001 cost tracking' }
  ];

  let allExist = true;

  for (const { name, desc } of tables) {
    const { error } = await client.from(name).select('id').limit(1);

    if (error) {
      console.log(`❌ ${name}: MISSING (${error.message})`);
      allExist = false;
    } else {
      console.log(`✅ ${name}: EXISTS (${desc})`);
    }
  }

  console.log('\nOFFLINE QUEUE:');
  console.log('ℹ️  Feature 007 offline_queue is client-side IndexedDB');
  console.log('   (verify in browser DevTools → Application → IndexedDB)\n');

  if (allExist) {
    console.log('✅ T000 PASSED: All required tables exist');
    console.log('📝 Constitution Rule 1 satisfied\n');
    console.log('▶️  Safe to proceed with implementation\n');
    process.exit(0);
  } else {
    console.error('❌ T000 FAILED: Missing required tables');
    console.error('⚠️  Cannot proceed - apply migrations first\n');
    process.exit(1);
  }
}

precheck();

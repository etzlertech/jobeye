#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  console.log('🔍 Checking job_assignments table schema...\n');

  // Check if job_assignments table exists and what columns it has
  const { data, error } = await client
    .from('job_assignments')
    .select('*')
    .limit(1);

  if (error) {
    console.log('❌ job_assignments table error:', error.message);
  } else if (data && data.length > 0) {
    console.log('✅ job_assignments columns:', Object.keys(data[0]).join(', '));
    console.log('\nSample record:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️  job_assignments table is empty');
  }

  // Try alternate names
  console.log('\n🔍 Checking for job assignment records...');
  const { count } = await client
    .from('job_assignments')
    .select('*', { count: 'exact', head: true });

  console.log(`Total job assignments: ${count || 0}`);
}

checkSchema().catch(console.error);

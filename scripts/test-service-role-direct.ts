#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testDirect() {
  // Create service role client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('Testing direct queries with service role...\n');

  // Test jobs query
  console.log('1. Testing jobs query:');
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, title, status')
    .limit(3);

  if (jobsError) {
    console.log('❌ Error:', jobsError);
  } else {
    console.log(`✅ Success: ${jobs?.length || 0} jobs found`);
  }

  // Test user_assignments
  console.log('\n2. Testing user_assignments:');
  const { data: assignments, error: assignError } = await supabase
    .from('user_assignments')
    .select('*')
    .limit(3);

  if (assignError) {
    console.log('❌ Error:', assignError);
  } else {
    console.log(`✅ Success: ${assignments?.length || 0} assignments found`);
  }
}

testDirect().catch(console.error);

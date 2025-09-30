#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkRLSStatus() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking RLS status and testing queries...\n');

  // Test 1: Query jobs with service role (should work - bypasses RLS)
  console.log('1. Testing jobs query with SERVICE ROLE KEY:');
  const { data: jobsService, error: jobsServiceError } = await supabase
    .from('jobs')
    .select('id, title, status, assigned_to')
    .limit(5);

  if (jobsServiceError) {
    console.log('❌ Service role error:', jobsServiceError.message);
  } else {
    console.log(`✅ Service role works: ${jobsService?.length || 0} jobs found`);
  }

  // Test 2: Check if users_extended table exists and is accessible
  console.log('\n2. Testing users_extended access:');
  const { data: users, error: usersError } = await supabase
    .from('users_extended')
    .select('id')
    .limit(1);

  if (usersError) {
    console.log('❌ users_extended error:', usersError.message);
  } else {
    console.log(`✅ users_extended accessible: ${users?.length || 0} users found`);
  }

  // Test 3: Try the problematic query pattern with service role
  console.log('\n3. Testing jobs query with assigned_to filter:');
  const { data: assignedJobs, error: assignedError } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'assigned')
    .limit(5);

  if (assignedError) {
    console.log('❌ Assigned jobs error:', assignedError.message);
  } else {
    console.log(`✅ Query works: ${assignedJobs?.length || 0} assigned jobs`);
  }

  console.log('\n🔍 Conclusion:');
  if (jobsServiceError && jobsServiceError.message.includes('recursion')) {
    console.log('⚠️  RLS recursion occurs even with SERVICE ROLE - severe policy issue');
  } else if (jobsServiceError) {
    console.log('⚠️  Different error with service role:', jobsServiceError.message);
  } else {
    console.log('✅ Service role bypasses the issue - RLS is the problem');
    console.log('💡 Solution: Use service role key in E2E tests');
  }
}

checkRLSStatus().catch(console.error);

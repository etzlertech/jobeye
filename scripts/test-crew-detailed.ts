#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testCrewQueries() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in as crew user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'crew@tophand.tech',
    password: 'demo123'
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  console.log('✅ Authenticated as:', authData.user.email);
  console.log('User ID:', authData.user.id);
  console.log('App Metadata:', JSON.stringify(authData.user.app_metadata, null, 2));
  console.log('');

  const today = new Date().toISOString().split('T')[0];
  const userId = authData.user.id;
  const tenantId = authData.user.app_metadata.tenant_id;

  console.log('Today:', today);
  console.log('Tenant ID:', tenantId);
  console.log('');

  // Test direct job query
  console.log('Test 0: Direct jobs query for one job...');
  const { data: jobTest, error: jobTestError } = await supabase
    .from('jobs')
    .select('id, status, scheduled_start, tenant_id')
    .eq('id', '8e870dd1-459d-433f-aef7-630bb3f92aac')
    .single();

  if (jobTestError) {
    console.error('❌ Direct job query error:', jobTestError);
  } else {
    console.log('✅ Direct job query success:', jobTest);
  }
  console.log('');

  // Test 1: Just job_assignments
  console.log('Test 1: Just job_assignments (no joins)...');
  const { data: test1Data, error: test1Error } = await supabase
    .from('job_assignments')
    .select('*')
    .eq('user_id', userId);

  if (test1Error) {
    console.error('❌ Test 1 error:', test1Error);
  } else {
    console.log('✅ Test 1 success:', test1Data?.length || 0, 'assignments');
  }
  console.log('');

  // Test 2: job_assignments with jobs join
  console.log('Test 2: job_assignments + jobs join (NO date filter)...');
  const { data: test2Data, error: test2Error } = await supabase
    .from('job_assignments')
    .select('job_id, jobs(id, status, scheduled_start, tenant_id)')
    .eq('user_id', userId)
    .limit(3);

  if (test2Error) {
    console.error('❌ Test 2 error:', test2Error);
  } else {
    console.log('✅ Test 2 success:', test2Data?.length || 0, 'assignments with jobs');
    console.log(JSON.stringify(test2Data, null, 2));
  }
  console.log('');

  // Test query similar to /api/crew/dashboard/stats
  console.log('Testing job_assignments query (dashboard/stats style)...');
  const { data: statsData, error: statsError } = await supabase
    .from('job_assignments')
    .select('job_id, jobs(status, scheduled_start)')
    .eq('user_id', userId)
    .gte('jobs.scheduled_start', today)
    .lt('jobs.scheduled_start', `${today}T23:59:59`);

  if (statsError) {
    console.error('❌ Stats query error:', {
      code: statsError.code,
      message: statsError.message,
      details: statsError.details,
      hint: statsError.hint
    });
  } else {
    console.log('✅ Stats query success:', statsData?.length || 0, 'assignments found');
    console.log(JSON.stringify(statsData, null, 2));
  }

  console.log('');

  // Test query similar to /api/crew/jobs/today
  console.log('Testing full job query (jobs/today style)...');
  const { data: jobsData, error: jobsError } = await supabase
    .from('job_assignments')
    .select(`
      job_id,
      assigned_at,
      jobs (
        id,
        scheduled_start,
        status,
        description,
        voice_notes,
        customers (id, name),
        properties (id, address)
      )
    `)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .gte('jobs.scheduled_start', today)
    .lt('jobs.scheduled_start', `${today}T23:59:59`);

  if (jobsError) {
    console.error('❌ Jobs query error:', {
      code: jobsError.code,
      message: jobsError.message,
      details: jobsError.details,
      hint: jobsError.hint
    });
  } else {
    console.log('✅ Jobs query success:', jobsData?.length || 0, 'jobs found');
    console.log(JSON.stringify(jobsData, null, 2));
  }
}

testCrewQueries();

#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkJobsSchema() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📊 Checking jobs table schema...\n');

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .limit(1);
  
  if (jobs && jobs[0]) {
    console.log('JOBS table columns:', Object.keys(jobs[0]).join(', '));
  } else {
    console.log('No jobs found, creating sample to see schema...');
    // Try to describe via error
    const { error } = await supabase
      .from('jobs')
      .select('id, job_type, post_job_verification_id, notes')
      .limit(1);
    console.log('Query error:', error);
  }
}

checkJobsSchema().catch(console.error);

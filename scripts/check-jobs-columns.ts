#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkColumns() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  // Get a sample job to see actual columns
  const { data: job, error } = await client
    .from('jobs')
    .select('*')
    .limit(1)
    .single();

  if (job) {
    console.log('Actual jobs table columns:');
    Object.keys(job).forEach(key => {
      console.log(`  - ${key}: ${typeof job[key]} = ${JSON.stringify(job[key])}`);
    });
  } else {
    console.log('No jobs found or error:', error);
  }
}

checkColumns().catch(console.error);
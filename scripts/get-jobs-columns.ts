#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getJobsColumns() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📊 Querying information_schema for jobs table...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'jobs'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Result:', data);
  }
}

getJobsColumns().catch(console.error);

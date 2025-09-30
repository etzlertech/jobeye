#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testJobsInsert() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📊 Testing jobs table insert to discover schema...\n');

  // Try minimal insert
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      company_id: 'company-e2e-test',
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.log('Error (expected - helps us see required fields):', error.message);
  } else if (data) {
    console.log('SUCCESS! Jobs table columns:', Object.keys(data).join(', '));
  }
}

testJobsInsert().catch(console.error);

#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function debugJobsTable() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking jobs table...\n');

  // 1. Get column info
  const { data: columns, error: columnsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'jobs' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `
  });

  if (columnsError) {
    console.error('❌ Error getting columns:', columnsError);
  } else {
    console.log('📋 Jobs table columns:');
    columns?.forEach((col: any) => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
  }

  // 2. Check if customer_id is nullable
  const customerCol = columns?.find((c: any) => c.column_name === 'customer_id');
  console.log('\n❓ customer_id nullable?', customerCol?.is_nullable);

  // 3. Get enum values
  const { data: priorities } = await client.rpc('exec_sql', {
    sql: `SELECT unnest(enum_range(NULL::job_priority)) AS value;`
  });
  console.log('\n📌 Valid priorities:', priorities?.map((p: any) => p.value));

  const { data: statuses } = await client.rpc('exec_sql', {
    sql: `SELECT unnest(enum_range(NULL::job_status)) AS value;`
  });
  console.log('📊 Valid statuses:', statuses?.map((s: any) => s.value));

  // 4. Try a minimal insert
  console.log('\n🧪 Testing minimal job creation...');
  
  const testJob = {
    tenant_id: '00000000-0000-0000-0000-000000000000',
    job_number: `TEST-${Date.now()}`,
    title: 'Test Job',
    status: 'scheduled',
    priority: 'normal'
  };

  console.log('Inserting:', testJob);

  const { data: job, error: insertError } = await client
    .from('jobs')
    .insert(testJob)
    .select()
    .single();

  if (insertError) {
    console.error('\n❌ Insert failed:', insertError);
    
    // Try with customer_id = null explicitly
    console.log('\n🔄 Retrying with explicit customer_id: null...');
    const testJob2 = { ...testJob, customer_id: null };
    
    const { data: job2, error: error2 } = await client
      .from('jobs')
      .insert(testJob2)
      .select()
      .single();
    
    if (error2) {
      console.error('❌ Still failed:', error2);
    } else {
      console.log('✅ Success with null customer_id:', job2);
      // Clean up
      await client.from('jobs').delete().eq('id', job2.id);
    }
  } else {
    console.log('✅ Job created:', job);
    // Clean up
    await client.from('jobs').delete().eq('id', job.id);
  }

  // 5. Check existing jobs
  const { data: existing } = await client
    .from('jobs')
    .select('id, job_number, customer_id, status')
    .limit(3);
  
  console.log('\n📄 Sample existing jobs:');
  console.table(existing);
}

debugJobsTable().catch(console.error);
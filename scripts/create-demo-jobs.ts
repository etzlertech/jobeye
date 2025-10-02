#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function createDemoJobs() {
  console.log('💼 Creating demo jobs with correct schema...\n');

  // Authenticate as demo supervisor
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: 'demo.supervisor@jobeye.app',
    password: 'demo123'
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    return;
  }

  const tenantId = authData.user.app_metadata?.tenant_id;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // First check jobs table schema
  console.log('🔍 Checking jobs table schema...');
  
  const { data: sampleJob } = await serviceClient
    .from('jobs')
    .select('*')
    .limit(1);

  console.log('Sample job structure:', sampleJob?.[0] ? Object.keys(sampleJob[0]) : 'No jobs found');

  // Get our demo customers
  const { data: customers } = await serviceClient
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .or('name.ilike.%Sunrise%,name.ilike.%Metro%,name.ilike.%Riverside%')
    .order('created_at', { ascending: false })
    .limit(3);

  if (!customers || customers.length === 0) {
    console.log('❌ No demo customers found');
    return;
  }

  console.log(`✅ Found ${customers.length} demo customers for job creation`);

  // Create jobs with minimal required fields
  const jobs = [
    {
      customer: customers.find(c => c.name.includes('Sunrise')),
      title: 'Weekly Garden Maintenance',
      description: 'Pruning, weeding, and general garden upkeep'
    },
    {
      customer: customers.find(c => c.name.includes('Metro')),
      title: 'Office Landscape Refresh', 
      description: 'Install new plants and maintain existing landscaping'
    },
    {
      customer: customers.find(c => c.name.includes('Riverside')),
      title: 'Apartment Complex Grounds Maintenance',
      description: 'Lawn care, tree trimming, and seasonal cleanup'
    }
  ];

  const createdJobs = [];

  for (const jobData of jobs) {
    if (!jobData.customer) {
      console.log(`⚠️ Customer not found for job: ${jobData.title}`);
      continue;
    }

    const timestamp = Date.now() + Math.random() * 1000;
    
    // Use only fields that exist in the jobs table
    const job = {
      tenant_id: tenantId,
      job_number: `JOB-${Math.floor(timestamp)}`,
      customer_id: jobData.customer.id,
      title: jobData.title,
      description: jobData.description,
      status: 'scheduled',
      created_by: authData.user.id
    };

    console.log(`Creating job: ${jobData.title} for ${jobData.customer.name}`);

    const { data: createdJob, error: jobError } = await serviceClient
      .from('jobs')
      .insert(job)
      .select()
      .single();

    if (jobError) {
      console.error(`❌ Failed to create job:`, jobError.message);
      console.log('Job data attempted:', job);
    } else {
      console.log(`✅ Created job: ${createdJob.title} (ID: ${createdJob.id})`);
      createdJobs.push(createdJob);
    }
  }

  // Verify jobs in database
  if (createdJobs.length > 0) {
    console.log('\n🔍 Verifying jobs in database...');
    
    const { data: verifyJobs } = await serviceClient
      .from('jobs')
      .select('*, customers(name)')
      .eq('tenant_id', tenantId)
      .in('id', createdJobs.map(j => j.id));

    console.log('\n💼 VERIFIED JOBS IN DATABASE:');
    verifyJobs?.forEach((job, index) => {
      console.log(`${index + 1}. ${job.title}`);
      console.log(`   Job #: ${job.job_number}`);
      console.log(`   Customer: ${job.customers?.name}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Created: ${job.created_at}`);
      console.log(`   Database ID: ${job.id}\n`);
    });
  }

  await authClient.auth.signOut();

  console.log('\n🎉 DEMO JOBS CREATION COMPLETE:');
  console.log(`✅ ${createdJobs.length} jobs created and verified in Supabase`);
  console.log('✅ Jobs linked to demo customers via foreign key relationships');
  console.log('✅ All data persisted with proper tenant isolation');
}

createDemoJobs().catch(console.error);
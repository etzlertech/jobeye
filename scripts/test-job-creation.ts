#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testJobCreation() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  const demoTenantId = '00000000-0000-0000-0000-000000000000';

  console.log('🧪 Testing job creation...\n');

  try {
    // Get a customer
    const { data: customers } = await client
      .from('customers')
      .select('id, name')
      .eq('tenant_id', demoTenantId)
      .limit(1);
    
    if (!customers || customers.length === 0) {
      console.error('No customers found!');
      return;
    }

    const customerId = customers[0].id;
    console.log(`Using customer: ${customers[0].name} (${customerId})`);

    // Get a property for this customer
    const { data: properties } = await client
      .from('properties')
      .select('id, name')
      .eq('tenant_id', demoTenantId)
      .eq('customer_id', customerId)
      .limit(1);
    
    const propertyId = properties?.[0]?.id || null;
    if (propertyId) {
      console.log(`Using property: ${properties[0].name} (${propertyId})`);
    }

    // Create a job with minimal fields
    const tomorrow = new Date(Date.now() + 86400000);
    const jobData = {
      tenant_id: demoTenantId,
      job_number: `JOB-${Date.now()}`,
      customer_id: customerId,
      property_id: propertyId,
      title: 'Test Job ' + Date.now(),
      status: 'scheduled',
      priority: 'low',
      scheduled_start: tomorrow.toISOString()
    };

    console.log('\nCreating job with data:', JSON.stringify(jobData, null, 2));

    const { data: job, error } = await client
      .from('jobs')
      .insert(jobData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating job:', error);
      console.error('Full error:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ Job created successfully!');
      console.log('Job ID:', job.id);
      console.log('Job Number:', job.job_number);
    }

    // Try the repository pattern
    console.log('\n🧪 Testing via repository pattern...');
    const { JobsRepository } = await import('@/domains/jobs/repositories/jobs.repository');
    const repo = new JobsRepository(client);
    
    const repoJob = await repo.create({
      tenant_id: demoTenantId,
      customer_id: customerId,
      property_id: propertyId,
      title: 'Test Job via Repo ' + Date.now(),
      status: 'scheduled',
      priority: 'low',
      scheduled_start: tomorrow.toISOString()
    });

    if (repoJob) {
      console.log('✅ Repository creation successful!');
      console.log('Job ID:', repoJob.id);
    } else {
      console.log('❌ Repository creation failed');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testJobCreation().catch(console.error);
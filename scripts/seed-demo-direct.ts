#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

async function seedDemo() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const demoTenantId = '00000000-0000-0000-0000-000000000000';

  console.log('🌱 Direct seeding demo data...\n');

  try {
    // First create a customer
    console.log('Creating demo customer...');
    const { data: customer, error: customerError } = await client
      .from('customers')
      .insert({
        id: 'demo-customer-direct',
        tenant_id: demoTenantId,
        name: 'Demo Customer',
        email: 'demo@example.com',
        phone: '555-0123',
        status: 'active'
      })
      .select()
      .single();

    if (customerError) {
      // Check if it already exists
      const { data: existing } = await client
        .from('customers')
        .select('*')
        .eq('tenant_id', demoTenantId)
        .limit(1)
        .single();
      
      if (existing) {
        console.log('Using existing customer:', existing.id);
        
        // Try to create a job with existing customer
        console.log('\nCreating demo job...');
        const { data: job, error: jobError } = await client
          .from('jobs')
          .insert({
            tenant_id: demoTenantId,
            title: 'Demo Job from Script',
            description: 'Created directly via TypeScript',
            customer_id: existing.id,
            status: 'scheduled',
            priority: 'medium',
            scheduled_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            created_by: 'script'
          })
          .select()
          .single();

        if (jobError) {
          console.error('Job creation error:', jobError);
          console.error('Full error details:', JSON.stringify(jobError, null, 2));
        } else {
          console.log('✅ Created job:', job.id);
        }
      } else {
        console.error('Customer creation failed:', customerError);
        console.error('Full error details:', JSON.stringify(customerError, null, 2));
      }
    } else {
      console.log('✅ Created customer:', customer.id);
      
      // Create a job
      console.log('\nCreating demo job...');
      const { data: job, error: jobError } = await client
        .from('jobs')
        .insert({
          tenant_id: demoTenantId,
          title: 'Demo Job from Script',
          description: 'Created directly via TypeScript',
          customer_id: customer.id,
          status: 'scheduled',
          priority: 'medium',
          scheduled_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          created_by: 'script'
        })
        .select()
        .single();

      if (jobError) {
        console.error('Job creation error:', jobError);
        console.error('Full error details:', JSON.stringify(jobError, null, 2));
      } else {
        console.log('✅ Created job:', job.id);
      }
    }

    // List all jobs to verify
    console.log('\n📋 Listing all jobs...');
    const { data: allJobs, error: listError } = await client
      .from('jobs')
      .select('id, title, customer_id, status')
      .eq('tenant_id', demoTenantId);

    if (listError) {
      console.error('Error listing jobs:', listError);
    } else {
      console.log(`Found ${allJobs?.length || 0} jobs:`);
      allJobs?.forEach(j => console.log(`  - ${j.id}: ${j.title} (${j.status})`));
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

seedDemo().catch(console.error);
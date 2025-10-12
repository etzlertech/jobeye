#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function seedDemoData() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🌱 Seeding demo data...\n');

  const demoTenantId = '00000000-0000-0000-0000-000000000000';

  try {
    // First, check if we already have demo data
    const { data: existingCustomers, error: checkError } = await client
      .from('customers')
      .select('id')
      .eq('tenant_id', demoTenantId)
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking existing data:', checkError);
      return;
    }

    if (existingCustomers && existingCustomers.length > 0) {
      console.log('ℹ️  Demo data already exists, skipping seed');
      
      // Just list what we have
      const { data: customers } = await client
        .from('customers')
        .select('*')
        .eq('tenant_id', demoTenantId);
      
      console.log(`\n📋 Existing demo customers: ${customers?.length || 0}`);
      customers?.forEach(c => console.log(`  - ${c.id}: ${c.name}`));
      
      const { data: properties } = await client
        .from('properties')
        .select('*')
        .eq('tenant_id', demoTenantId);
      
      console.log(`\n🏠 Existing demo properties: ${properties?.length || 0}`);
      properties?.forEach(p => console.log(`  - ${p.id}: ${p.address}`));
      
      return;
    }

    // Create demo customers
    console.log('👥 Creating demo customers...');
    const { data: customers, error: customerError } = await client
      .from('customers')
      .insert([
        {
          id: 'demo-customer-1',
          tenant_id: demoTenantId,
          name: 'John Smith',
          email: 'john@example.com',
          phone: '555-0101',
          address: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          status: 'active'
        },
        {
          id: 'demo-customer-2',
          tenant_id: demoTenantId,
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-0102',
          address: '456 Oak Ave',
          city: 'Springfield',
          state: 'IL',
          zip: '62702',
          status: 'active'
        },
        {
          id: 'demo-customer-3',
          tenant_id: demoTenantId,
          name: 'Bob Johnson',
          email: 'bob@example.com',
          phone: '555-0103',
          address: '789 Pine Rd',
          city: 'Springfield',
          state: 'IL',
          zip: '62703',
          status: 'active'
        }
      ])
      .select();

    if (customerError) {
      console.error('❌ Error creating customers:', customerError);
      return;
    }

    console.log(`✅ Created ${customers.length} demo customers`);

    // Create demo properties
    console.log('\n🏠 Creating demo properties...');
    const { data: properties, error: propertyError } = await client
      .from('properties')
      .insert([
        {
          id: 'demo-property-1',
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-1',
          address: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          lot_size_sq_ft: 8000,
          property_type: 'residential',
          service_day: 'Monday'
        },
        {
          id: 'demo-property-2',
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-2',
          address: '456 Oak Ave',
          city: 'Springfield',
          state: 'IL',
          zip: '62702',
          lot_size_sq_ft: 10000,
          property_type: 'residential',
          service_day: 'Tuesday'
        },
        {
          id: 'demo-property-3',
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-3',
          address: '789 Pine Rd',
          city: 'Springfield',
          state: 'IL',
          zip: '62703',
          lot_size_sq_ft: 12000,
          property_type: 'commercial',
          service_day: 'Wednesday'
        },
        {
          id: 'demo-property-4',
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-1',
          address: '321 Elm St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          lot_size_sq_ft: 6000,
          property_type: 'residential',
          service_day: 'Monday'
        }
      ])
      .select();

    if (propertyError) {
      console.error('❌ Error creating properties:', propertyError);
      return;
    }

    console.log(`✅ Created ${properties.length} demo properties`);

    // Create a demo job
    console.log('\n💼 Creating demo job...');
    const { data: jobs, error: jobError } = await client
      .from('jobs')
      .insert([
        {
          tenant_id: demoTenantId,
          job_number: 'JOB-2025-001',
          title: 'Weekly Lawn Service',
          description: 'Regular weekly lawn mowing and trimming',
          customer_id: 'demo-customer-1',
          property_id: 'demo-property-1',
          status: 'scheduled',
          priority: 'medium',
          scheduled_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          estimated_duration_hours: 2,
          created_by: 'demo-user'
        }
      ])
      .select();

    if (jobError) {
      console.error('❌ Error creating job:', jobError);
      console.error('Job error details:', JSON.stringify(jobError, null, 2));
      return;
    }

    console.log(`✅ Created ${jobs.length} demo job`);
    console.log('\n🎉 Demo data seeding complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

seedDemoData().catch(console.error);
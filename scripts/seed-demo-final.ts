#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function seedDemo() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  const demoTenantId = '00000000-0000-0000-0000-000000000000';

  console.log('🌱 Seeding demo data...\n');

  try {
    // Create demo customers
    console.log('👥 Creating demo customers...');
    const { data: customers, error: customerError } = await client
      .from('customers')
      .insert([
        {
          id: 'demo-customer-1',
          tenant_id: demoTenantId,
          customer_number: 'CUST-001',
          name: 'John Smith',
          email: 'john@example.com',
          phone: '555-0101',
          billing_address: {
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zip: '62701'
          },
          is_active: true,
          created_by: demoTenantId
        },
        {
          id: 'demo-customer-2',
          tenant_id: demoTenantId,
          customer_number: 'CUST-002',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-0102',
          billing_address: {
            street: '456 Oak Ave',
            city: 'Springfield',
            state: 'IL',
            zip: '62702'
          },
          is_active: true,
          created_by: demoTenantId
        },
        {
          id: 'demo-customer-3',
          tenant_id: demoTenantId,
          customer_number: 'CUST-003',
          name: 'Bob Johnson',
          email: 'bob@example.com',
          phone: '555-0103',
          billing_address: {
            street: '789 Pine Rd',
            city: 'Springfield',
            state: 'IL',
            zip: '62703'
          },
          is_active: true,
          created_by: demoTenantId
        }
      ])
      .select();

    if (customerError) {
      console.error('❌ Error creating customers:', customerError);
      // Check if customers already exist
      const { data: existing } = await client
        .from('customers')
        .select('id, name')
        .eq('tenant_id', demoTenantId);
      
      if (existing && existing.length > 0) {
        console.log('ℹ️  Using existing customers:', existing.map(c => c.name).join(', '));
      } else {
        return;
      }
    } else {
      console.log(`✅ Created ${customers.length} demo customers`);
    }

    // Create demo properties
    console.log('\n🏠 Creating demo properties...');
    const { data: properties, error: propertyError } = await client
      .from('properties')
      .insert([
        {
          id: 'demo-property-1',
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-1',
          name: 'Smith Residence',
          address: {
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zip: '62701'
          },
          property_type: 'residential',
          size_sqft: 8000,
          is_active: true
        },
        {
          id: 'demo-property-2',
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-2',
          name: 'Doe Property',
          address: {
            street: '456 Oak Ave',
            city: 'Springfield',
            state: 'IL',
            zip: '62702'
          },
          property_type: 'residential',
          size_sqft: 10000,
          is_active: true
        },
        {
          id: 'demo-property-3',
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-3',
          name: 'Johnson Commercial',
          address: {
            street: '789 Pine Rd',
            city: 'Springfield',
            state: 'IL',
            zip: '62703'
          },
          property_type: 'commercial',
          size_sqft: 15000,
          is_active: true
        }
      ])
      .select();

    if (propertyError) {
      console.error('❌ Error creating properties:', propertyError);
      // Check if properties already exist
      const { data: existing } = await client
        .from('properties')
        .select('id, name')
        .eq('tenant_id', demoTenantId);
      
      if (existing && existing.length > 0) {
        console.log('ℹ️  Using existing properties:', existing.map(p => p.name).join(', '));
      }
    } else {
      console.log(`✅ Created ${properties.length} demo properties`);
    }

    // Create demo jobs
    console.log('\n💼 Creating demo jobs...');
    const tomorrow = new Date(Date.now() + 86400000);
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    
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
          scheduled_start: tomorrow.toISOString(),
          scheduled_end: new Date(tomorrow.getTime() + 2 * 3600000).toISOString(), // 2 hours later
          estimated_duration_minutes: 120,
          created_by: demoTenantId
        },
        {
          tenant_id: demoTenantId,
          job_number: 'JOB-2025-002',
          title: 'Spring Cleanup',
          description: 'Full property spring cleanup and prep',
          customer_id: 'demo-customer-2',
          property_id: 'demo-property-2',
          status: 'scheduled',
          priority: 'high',
          scheduled_start: tomorrow.toISOString(),
          scheduled_end: new Date(tomorrow.getTime() + 4 * 3600000).toISOString(), // 4 hours later
          estimated_duration_minutes: 240,
          created_by: demoTenantId
        },
        {
          tenant_id: demoTenantId,
          job_number: 'JOB-2025-003',
          title: 'Commercial Maintenance',
          description: 'Monthly commercial property maintenance',
          customer_id: 'demo-customer-3',
          property_id: 'demo-property-3',
          status: 'draft',
          priority: 'low',
          scheduled_start: nextWeek.toISOString(),
          scheduled_end: new Date(nextWeek.getTime() + 3 * 3600000).toISOString(), // 3 hours later
          estimated_duration_minutes: 180,
          created_by: demoTenantId
        }
      ])
      .select();

    if (jobError) {
      console.error('❌ Error creating jobs:', jobError);
      console.error('Full error details:', JSON.stringify(jobError, null, 2));
    } else {
      console.log(`✅ Created ${jobs.length} demo jobs`);
    }

    // List all demo data
    console.log('\n📋 Demo data summary:');
    
    const { count: custCount } = await client
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', demoTenantId);
    
    const { count: propCount } = await client
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', demoTenantId);
    
    const { count: jobCount } = await client
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', demoTenantId);

    console.log(`  - Customers: ${custCount || 0}`);
    console.log(`  - Properties: ${propCount || 0}`);
    console.log(`  - Jobs: ${jobCount || 0}`);
    
    console.log('\n🎉 Demo data seeding complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

seedDemo().catch(console.error);
#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function seedDemo() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  const demoTenantId = '00000000-0000-0000-0000-000000000000';

  console.log('🌱 Seeding demo data with proper UUIDs...\n');

  try {
    // Generate UUIDs for properties
    const propId1 = randomUUID();
    const propId2 = randomUUID();
    const propId3 = randomUUID();

    // Create properties with UUID IDs
    console.log('🏠 Creating demo properties...');
    const { data: properties, error: propertyError } = await client
      .from('properties')
      .insert([
        {
          id: propId1,
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-1',
          property_number: 'PROP-001',
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
          id: propId2,
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-2',
          property_number: 'PROP-002',
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
          id: propId3,
          tenant_id: demoTenantId,
          customer_id: 'demo-customer-3',
          property_number: 'PROP-003',
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
      
      // If properties exist, fetch them
      const { data: existing } = await client
        .from('properties')
        .select('id, name, customer_id')
        .eq('tenant_id', demoTenantId);
      
      if (existing && existing.length > 0) {
        console.log('ℹ️  Using existing properties:', existing.map(p => p.name).join(', '));
        // Use first property for job creation
        const firstProp = existing[0];
        await createJobsWithProperty(client, demoTenantId, firstProp.customer_id, firstProp.id);
      }
    } else {
      console.log(`✅ Created ${properties.length} demo properties`);
      
      // Create jobs with the new properties
      await createJobsWithProperty(client, demoTenantId, 'demo-customer-1', propId1);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function createJobsWithProperty(client: any, tenantId: string, customerId: string, propertyId: string) {
  console.log('\n💼 Creating demo jobs...');
  
  // First, let's check what priority values are valid by attempting different values
  const priorityValues = ['low', 'normal', 'high', 'urgent', 'LOW', 'NORMAL', 'HIGH'];
  let validPriority = 'low'; // default
  
  for (const priority of priorityValues) {
    const { error } = await client
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        job_number: 'TEST-PRIORITY',
        title: 'Test Priority',
        customer_id: customerId,
        property_id: propertyId,
        status: 'draft',
        priority: priority
      });
    
    if (!error) {
      validPriority = priority;
      console.log(`✅ Valid priority value found: ${priority}`);
      // Delete test job
      await client.from('jobs').delete().eq('job_number', 'TEST-PRIORITY');
      break;
    }
  }
  
  const tomorrow = new Date(Date.now() + 86400000);
  const nextWeek = new Date(Date.now() + 7 * 86400000);
  
  const { data: jobs, error: jobError } = await client
    .from('jobs')
    .insert([
      {
        tenant_id: tenantId,
        job_number: `JOB-${Date.now()}-1`,
        title: 'Weekly Lawn Service',
        description: 'Regular weekly lawn mowing and trimming',
        customer_id: customerId,
        property_id: propertyId,
        status: 'scheduled',
        priority: validPriority,
        scheduled_start: tomorrow.toISOString(),
        scheduled_end: new Date(tomorrow.getTime() + 2 * 3600000).toISOString(),
        estimated_duration_minutes: 120
      }
    ])
    .select();

  if (jobError) {
    console.error('❌ Error creating jobs:', jobError);
    console.error('Full error details:', JSON.stringify(jobError, null, 2));
  } else {
    console.log(`✅ Created ${jobs.length} demo job(s)`);
  }

  // Summary
  console.log('\n📋 Final summary:');
  
  const { count: custCount } = await client
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  
  const { count: propCount } = await client
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  
  const { count: jobCount } = await client
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  console.log(`  - Customers: ${custCount || 0}`);
  console.log(`  - Properties: ${propCount || 0}`);
  console.log(`  - Jobs: ${jobCount || 0}`);
  
  console.log('\n🎉 Demo data seeding complete!');
}

seedDemo().catch(console.error);
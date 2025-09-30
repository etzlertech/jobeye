#!/usr/bin/env npx tsx
/**
 * E2E Test Data Seeder
 * Populates database with test data for E2E test suites
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000099';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_PROPERTY_ID = '00000000-0000-0000-0000-000000000010';
const TEST_CUSTOMER_ID = '00000000-0000-0000-0000-000000000020';

interface SeedResult {
  table: string;
  created: number;
  skipped: number;
  errors: string[];
}

const results: SeedResult[] = [];

function logResult(table: string, created: number, skipped: number = 0, errors: string[] = []) {
  results.push({ table, created, skipped, errors });
  const icon = errors.length > 0 ? '⚠️' : created > 0 ? '✅' : '⏭️';
  console.log(`${icon} ${table}: ${created} created, ${skipped} skipped${errors.length > 0 ? `, ${errors.length} errors` : ''}`);
  if (errors.length > 0) {
    errors.forEach(err => console.log(`   └─ ${err}`));
  }
}

async function seedProperties() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n🏠 Seeding Properties...\n');

  const properties = [
    {
      id: TEST_PROPERTY_ID,
      tenant_id: TEST_TENANT_ID,
      customer_id: TEST_CUSTOMER_ID,
      property_number: 'PROP-E2E-001',
      name: 'E2E Test Property - Residential',
      property_type: 'residential',
      address: '123 Test Lane, Atlanta, GA 30301',
      size_sqft: 8000,
      lot_size_acres: 0.18,
      access_notes: 'Front gate code: 1234',
      is_active: true
    },
    {
      id: '00000000-0000-0000-0000-000000000011',
      tenant_id: TEST_TENANT_ID,
      customer_id: '00000000-0000-0000-0000-000000000021',
      property_number: 'PROP-E2E-002',
      name: 'E2E Test Property - Commercial',
      property_type: 'commercial',
      address: '456 Business Blvd, Atlanta, GA 30302',
      size_sqft: 25000,
      lot_size_acres: 0.57,
      access_notes: 'Rear entrance, business hours only',
      is_active: true
    }
  ];

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const property of properties) {
    try {
      const { error } = await client
        .from('properties')
        .upsert(property, { onConflict: 'id' });

      if (error) {
        errors.push(`Property ${property.name}: ${error.message}`);
      } else {
        created++;
      }
    } catch (e: any) {
      errors.push(`Property ${property.name}: ${e.message}`);
    }
  }

  logResult('properties', created, skipped, errors);
}

async function seedCustomers() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n👥 Seeding Customers...\n');

  const customers = [
    {
      id: TEST_CUSTOMER_ID,
      tenant_id: TEST_TENANT_ID,
      customer_number: 'CUST-E2E-001',
      name: 'E2E Test Customer',
      email: 'customer@e2etest.com',
      phone: '555-0100',
      mobile_phone: '555-0101',
      billing_address: '123 Test Lane, Atlanta, GA 30301',
      service_address: '123 Test Lane, Atlanta, GA 30301',
      is_active: true,
      created_by: TEST_USER_ID
    },
    {
      id: '00000000-0000-0000-0000-000000000021',
      tenant_id: TEST_TENANT_ID,
      customer_number: 'CUST-E2E-002',
      name: 'E2E Commercial Customer',
      email: 'commercial@e2etest.com',
      phone: '555-0200',
      mobile_phone: '555-0201',
      billing_address: '456 Business Blvd, Atlanta, GA 30302',
      service_address: '456 Business Blvd, Atlanta, GA 30302',
      is_active: true,
      created_by: TEST_USER_ID
    }
  ];

  let created = 0;
  const errors: string[] = [];

  for (const customer of customers) {
    try {
      const { error } = await client
        .from('customers')
        .upsert(customer, { onConflict: 'id' });

      if (error) {
        errors.push(`Customer ${customer.name}: ${error.message}`);
      } else {
        created++;
      }
    } catch (e: any) {
      errors.push(`Customer ${customer.name}: ${e.message}`);
    }
  }

  logResult('customers', created, 0, errors);
}

async function seedJobs() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n💼 Seeding Jobs...\n');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const jobs = [
    {
      id: '00000000-0000-0000-0000-000000000030',
      tenant_id: TEST_TENANT_ID,
      job_number: 'E2E-JOB-001',
      title: 'E2E Lawn Maintenance',
      property_id: TEST_PROPERTY_ID,
      customer_id: TEST_CUSTOMER_ID,
      assigned_to: TEST_USER_ID,
      status: 'scheduled',
      scheduled_start: today.toISOString(),
      scheduled_end: new Date(today.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
      description: 'E2E Test Job - Lawn maintenance',
      priority: 'medium',
      estimated_duration: 240
    },
    {
      id: '00000000-0000-0000-0000-000000000031',
      tenant_id: TEST_TENANT_ID,
      job_number: 'E2E-JOB-002',
      title: 'E2E Irrigation Installation',
      property_id: TEST_PROPERTY_ID,
      customer_id: TEST_CUSTOMER_ID,
      assigned_to: TEST_USER_ID,
      status: 'scheduled',
      scheduled_start: tomorrow.toISOString(),
      scheduled_end: new Date(tomorrow.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      description: 'E2E Test Job - Irrigation installation',
      priority: 'high',
      estimated_duration: 360
    },
    {
      id: '00000000-0000-0000-0000-000000000032',
      tenant_id: TEST_TENANT_ID,
      job_number: 'E2E-JOB-003',
      title: 'E2E Commercial Maintenance',
      property_id: '00000000-0000-0000-0000-000000000011',
      customer_id: '00000000-0000-0000-0000-000000000021',
      assigned_to: TEST_USER_ID,
      status: 'in_progress',
      scheduled_start: new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString(), // Started 2 hours ago
      scheduled_end: new Date(today.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      description: 'E2E Test Job - Commercial property maintenance',
      priority: 'medium',
      estimated_duration: 240
    }
  ];

  let created = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    try {
      const { error } = await client
        .from('jobs')
        .upsert(job, { onConflict: 'id' });

      if (error) {
        errors.push(`Job ${job.job_number}: ${error.message}`);
      } else {
        created++;
      }
    } catch (e: any) {
      errors.push(`Job ${job.job_number}: ${e.message}`);
    }
  }

  logResult('jobs', created, 0, errors);
}

async function seedKits() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n🧰 Seeding Kits...\n');

  const kits = [
    {
      id: '00000000-0000-0000-0000-000000000040',
      tenant_id: TEST_TENANT_ID,
      kit_code: 'E2E-KIT-MAINT',
      name: 'E2E Maintenance Kit',
      description: 'Standard maintenance equipment for E2E tests',
      is_active: true
    },
    {
      id: '00000000-0000-0000-0000-000000000041',
      tenant_id: TEST_TENANT_ID,
      kit_code: 'E2E-KIT-INSTALL',
      name: 'E2E Installation Kit',
      description: 'Installation equipment for E2E tests',
      is_active: true
    }
  ];

  let created = 0;
  const errors: string[] = [];

  for (const kit of kits) {
    try {
      const { error } = await client
        .from('kits')
        .upsert(kit, { onConflict: 'id' });

      if (error) {
        errors.push(`Kit ${kit.kit_code}: ${error.message}`);
      } else {
        created++;
      }
    } catch (e: any) {
      errors.push(`Kit ${kit.kit_code}: ${e.message}`);
    }
  }

  logResult('kits', created, 0, errors);
}

async function seedKitItems() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n🔧 Seeding Kit Items...\n');

  const kitItems = [
    // Maintenance kit items
    {
      id: '00000000-0000-0000-0000-000000000050',
      tenant_id: TEST_TENANT_ID,
      kit_id: '00000000-0000-0000-0000-000000000040',
      item_type: 'mower',
      quantity: 1,
      unit: 'unit',
      is_required: true
    },
    {
      id: '00000000-0000-0000-0000-000000000051',
      tenant_id: TEST_TENANT_ID,
      kit_id: '00000000-0000-0000-0000-000000000040',
      item_type: 'trimmer',
      quantity: 1,
      unit: 'unit',
      is_required: true
    },
    {
      id: '00000000-0000-0000-0000-000000000052',
      tenant_id: TEST_TENANT_ID,
      kit_id: '00000000-0000-0000-0000-000000000040',
      item_type: 'blower',
      quantity: 1,
      unit: 'unit',
      is_required: true
    },
    {
      id: '00000000-0000-0000-0000-000000000053',
      tenant_id: TEST_TENANT_ID,
      kit_id: '00000000-0000-0000-0000-000000000040',
      item_type: 'safety_glasses',
      quantity: 1,
      unit: 'unit',
      is_required: true
    },
    // Installation kit items
    {
      id: '00000000-0000-0000-0000-000000000054',
      tenant_id: TEST_TENANT_ID,
      kit_id: '00000000-0000-0000-0000-000000000041',
      item_type: 'shovel',
      quantity: 2,
      unit: 'unit',
      is_required: true
    },
    {
      id: '00000000-0000-0000-0000-000000000055',
      tenant_id: TEST_TENANT_ID,
      kit_id: '00000000-0000-0000-0000-000000000041',
      item_type: 'pipe_cutter',
      quantity: 1,
      unit: 'unit',
      is_required: true
    }
  ];

  let created = 0;
  const errors: string[] = [];

  for (const item of kitItems) {
    try {
      const { error } = await client
        .from('kit_items')
        .upsert(item, { onConflict: 'id' });

      if (error) {
        errors.push(`Kit item ${item.item_name}: ${error.message}`);
      } else {
        created++;
      }
    } catch (e: any) {
      errors.push(`Kit item ${item.item_name}: ${e.message}`);
    }
  }

  logResult('kit_items', created, 0, errors);
}

async function seedEquipment() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n⚙️ Seeding Equipment...\n');

  const equipment = [
    {
      id: '00000000-0000-0000-0000-000000000060',
      tenant_id: TEST_TENANT_ID,
      name: 'E2E Test Mower #1',
      type: 'mower',
      serial_number: 'E2E-MOWER-001',
      status: 'available',
      purchase_date: '2024-01-01',
      is_active: true
    },
    {
      id: '00000000-0000-0000-0000-000000000061',
      tenant_id: TEST_TENANT_ID,
      name: 'E2E Test Trimmer #1',
      type: 'trimmer',
      serial_number: 'E2E-TRIM-001',
      status: 'available',
      purchase_date: '2024-01-01',
      is_active: true
    },
    {
      id: '00000000-0000-0000-0000-000000000062',
      tenant_id: TEST_TENANT_ID,
      name: 'E2E Test Blower #1',
      type: 'blower',
      serial_number: 'E2E-BLOW-001',
      status: 'available',
      purchase_date: '2024-01-01',
      is_active: true
    }
  ];

  let created = 0;
  const errors: string[] = [];

  for (const item of equipment) {
    try {
      const { error } = await client
        .from('equipment')
        .upsert(item, { onConflict: 'id' });

      if (error) {
        errors.push(`Equipment ${item.name}: ${error.message}`);
      } else {
        created++;
      }
    } catch (e: any) {
      errors.push(`Equipment ${item.name}: ${e.message}`);
    }
  }

  logResult('equipment', created, 0, errors);
}

async function generateReport() {
  console.log('\n\n📊 SEED REPORT\n');
  console.log('═'.repeat(60));

  const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`\nTotal Records Created: ${totalCreated}`);
  console.log(`Total Records Skipped: ${totalSkipped}`);
  console.log(`Total Errors: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log('\n⚠️  ERRORS OCCURRED:\n');
    results.filter(r => r.errors.length > 0).forEach(r => {
      console.log(`  ${r.table}:`);
      r.errors.forEach(err => console.log(`    - ${err}`));
    });
  }

  console.log('\n✅ Test data seeding complete!\n');
  console.log('Test Tenant ID:', TEST_TENANT_ID);
  console.log('Test User ID:', TEST_USER_ID);
  console.log('Test Property ID:', TEST_PROPERTY_ID);
  console.log('Test Customer ID:', TEST_CUSTOMER_ID);
  console.log('\nYou can now run E2E tests:\n');
  console.log('  npm run test -- --testPathPattern="e2e.test.ts"\n');

  if (totalErrors > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log('🌱 E2E Test Data Seeder\n');
  console.log('Populating database with test data for E2E workflows\n');

  // Order matters: customers before properties (foreign key)
  await seedCustomers();
  await seedProperties();
  await seedJobs();
  await seedKits();
  await seedKitItems();
  await seedEquipment();
  await generateReport();
}

main().catch(console.error);
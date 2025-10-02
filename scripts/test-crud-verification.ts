#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyCustomerCrud() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking customers table...\n');

  // Query all customers to see current state
  const { data: customers, error } = await client
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error querying customers:', error);
    process.exit(1);
  }

  console.log(`📊 Total customers found: ${customers.length}\n`);

  customers.forEach((customer, index) => {
    console.log(`${index + 1}. ${customer.name}`);
    console.log(`   Email: ${customer.email}`);
    console.log(`   Phone: ${customer.phone || 'N/A'}`);
    console.log(`   Created: ${customer.created_at}`);
    console.log(`   ID: ${customer.id}\n`);
  });

  // Look specifically for our test customer
  const testCustomer = customers.find(c => 
    c.name === 'Railway Test Customer' || 
    c.email === 'railway.test@example.com'
  );

  if (testCustomer) {
    console.log('✅ Railway Test Customer found in database!');
    console.log('   This confirms CREATE operation worked.');
  } else {
    console.log('❌ Railway Test Customer NOT found in database.');
    console.log('   This suggests CREATE operation failed or UI issue.');
  }

  // Also check the schema to understand the table structure
  console.log('\n🏗️ Checking customers table schema...');
  const { data: schema, error: schemaError } = await client.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      ORDER BY ordinal_position;
    `
  });

  if (schemaError) {
    console.error('❌ Error checking schema:', schemaError);
  } else {
    console.log('Schema columns:');
    schema.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
  }
}

verifyCustomerCrud().catch(console.error);
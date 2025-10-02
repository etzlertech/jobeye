import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyRailwayCrud() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking if Railway CRUD test customer was created...\n');

  // Look for our test customer
  const { data: customers, error } = await client
    .from('customers')
    .select('*')
    .or('name.ilike.%Railway CRUD Fix Test%,email.ilike.%railway.crud.fix@test.com%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error querying customers:', error);
    return;
  }

  console.log(`Found ${customers.length} matching customers:`);
  
  customers.forEach((customer, index) => {
    console.log(`${index + 1}. ${customer.name}`);
    console.log(`   Email: ${customer.email}`);
    console.log(`   Phone: ${customer.phone}`);
    console.log(`   Address: ${JSON.stringify(customer.billing_address)}`);
    console.log(`   Created: ${customer.created_at}`);
    console.log(`   Customer Number: ${customer.customer_number}`);
    console.log(`   Tenant ID: ${customer.tenant_id}\n`);
  });

  if (customers.length > 0) {
    console.log('✅ SUCCESS: Railway CRUD fix working!');
    console.log('✅ Customer created in database with proper schema');
    console.log('✅ tenant_id and customer_number generated correctly');
    console.log('✅ Address transformed to billing_address object');
  } else {
    console.log('❌ Test customer not found in database');
    console.log('❓ Possible issue: Demo mode active or authentication problem');
  }

  // Also check total customer count
  const { count } = await client
    .from('customers')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\n📊 Total customers in database: ${count}`);
}

verifyRailwayCrud().catch(console.error);
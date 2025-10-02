import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkCustomersSchema() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking customers table schema...\n');

  // Get the first customer to see the actual structure
  const { data: sampleCustomer, error } = await client
    .from('customers')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error getting sample:', error);
  } else {
    console.log('✅ Sample customer structure:');
    console.log(JSON.stringify(sampleCustomer[0], null, 2));
  }

  // Try creating with correct fields
  console.log('\n🧪 Testing with correct schema...');
  
  const testCustomer = {
    name: 'Direct API Test Customer',
    email: 'direct.api@test.com',
    phone: '(555) 999-9999'
    // Remove 'address' field since it doesn't exist
  };

  const { data: createResult, error: createError } = await client
    .from('customers')
    .insert(testCustomer)
    .select();

  if (createError) {
    console.error('❌ Create still failed:', createError);
  } else {
    console.log('✅ Create successful with correct schema!');
    console.log('Created:', createResult);
  }
}

checkCustomersSchema().catch(console.error);
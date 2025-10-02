import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testDirectCrud() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🧪 Testing direct CRUD operations...\n');

  // Test direct customer creation
  const testCustomer = {
    name: 'Direct API Test Customer',
    email: 'direct.api@test.com',
    phone: '(555) 999-9999',
    address: '123 API Test Street'
  };

  console.log('Creating customer:', testCustomer);

  const { data: createResult, error: createError } = await client
    .from('customers')
    .insert(testCustomer)
    .select();

  if (createError) {
    console.error('❌ Direct create failed:', createError);
  } else {
    console.log('✅ Direct create successful!');
    console.log('Created customer:', createResult);
    
    // Now verify it exists by reading it back
    const { data: readResult, error: readError } = await client
      .from('customers')
      .select('*')
      .eq('email', 'direct.api@test.com');

    if (readError) {
      console.error('❌ Read verification failed:', readError);
    } else {
      console.log('✅ Read verification successful:', readResult);
    }
  }
}

testDirectCrud().catch(console.error);
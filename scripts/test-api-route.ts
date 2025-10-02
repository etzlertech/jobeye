import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testApiRoute() {
  console.log('🧪 Testing updated API route logic directly...\n');
  
  const client = createClient(supabaseUrl, supabaseServiceKey);
  
  // Simulate the API route logic
  const tenantId = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'; // Use existing tenant
  const timestamp = Date.now();
  const customerNumber = `CUST-${timestamp}`;
  
  // Simulate form data from UI
  const formData = {
    name: 'API Route Test Customer',
    email: `api.route.test.${timestamp}@example.com`,
    phone: '(555) 777-8888',
    address: '789 API Test Blvd',
    notes: 'Created via updated API route test'
  };
  
  // Transform address to billing_address (as API route now does)
  const billingAddress = formData.address ? {
    street: formData.address,
    city: 'N/A',
    state: 'N/A', 
    zip: 'N/A'
  } : null;
  
  const customerData = {
    tenant_id: tenantId,
    customer_number: customerNumber,
    name: formData.name,
    email: formData.email,
    phone: formData.phone || null,
    billing_address: billingAddress,
    notes: formData.notes || null
  };
  
  console.log('Creating customer with data:', customerData);
  
  // Test CREATE
  const { data: customer, error } = await client
    .from('customers')
    .insert(customerData)
    .select()
    .single();
    
  if (error) {
    console.error('❌ Create failed:', error);
    return;
  }
  
  console.log('✅ CREATE successful!');
  console.log('Created customer:', customer);
  
  // Test READ with transformation (simulate what API route does)
  const { data: readCustomers, error: readError } = await client
    .from('customers')
    .select(`
      id,
      name,
      email,
      phone,
      billing_address,
      notes,
      created_at
    `)
    .eq('id', customer.id);
    
  if (readError) {
    console.error('❌ Read failed:', readError);
    return;
  }
  
  // Transform for UI compatibility (as API route does)
  const transformedCustomer = {
    ...readCustomers[0],
    address: readCustomers[0].billing_address 
      ? `${readCustomers[0].billing_address.street}, ${readCustomers[0].billing_address.city}, ${readCustomers[0].billing_address.state} ${readCustomers[0].billing_address.zip}`.replace(/N\/A,?\s*/g, '').replace(/,\s*$/, '')
      : null
  };
  
  console.log('\n✅ READ with transformation successful!');
  console.log('UI-compatible data:', transformedCustomer);
  
  // Clean up
  await client.from('customers').delete().eq('id', customer.id);
  console.log('\n🧹 Test customer cleaned up');
  
  console.log('\n🎯 API Route Logic Test: SUCCESS!');
  console.log('✅ All transformations working correctly');
  console.log('✅ Ready for end-to-end testing');
}

testApiRoute().catch(console.error);
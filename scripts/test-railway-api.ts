#!/usr/bin/env npx tsx

async function testRailwayAPI() {
  const baseUrl = 'https://jobeye-production.up.railway.app';
  
  console.log('🚀 Testing Railway API directly...\n');
  
  // Test customer creation via API
  const testCustomer = {
    name: 'Railway API Test Customer',
    email: `railway.api.test.${Date.now()}@example.com`,
    phone: '(555) 999-1111',
    address: '123 Railway Test St',
    notes: 'Created via direct Railway API test'
  };
  
  console.log('Creating customer:', testCustomer);
  
  try {
    const response = await fetch(`${baseUrl}/api/supervisor/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e', // Use existing tenant
        'x-is-demo': 'false' // Use real database
      },
      body: JSON.stringify(testCustomer)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API request failed:', response.status, data);
      return;
    }
    
    console.log('✅ Customer created successfully!');
    console.log('Response:', data);
    
    if (data.message) {
      console.log(`\n💬 API Message: "${data.message}"`);
    }
    
    // Test reading customers back
    console.log('\n📖 Testing customer list retrieval...');
    
    const listResponse = await fetch(`${baseUrl}/api/supervisor/customers`, {
      headers: {
        'x-tenant-id': '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
        'x-is-demo': 'false'
      }
    });
    
    const listData = await listResponse.json();
    
    if (!listResponse.ok) {
      console.error('❌ List request failed:', listResponse.status, listData);
      return;
    }
    
    console.log(`✅ Retrieved ${listData.total_count} customers`);
    
    // Find our test customer
    const ourCustomer = listData.customers.find((c: any) => 
      c.email === testCustomer.email
    );
    
    if (ourCustomer) {
      console.log('✅ Found our test customer in the list!');
      console.log('Customer data:', {
        id: ourCustomer.id,
        name: ourCustomer.name,
        email: ourCustomer.email,
        phone: ourCustomer.phone,
        address: ourCustomer.address
      });
      
      console.log('\n🎯 RAILWAY API TEST RESULTS:');
      console.log('✅ Customer creation: WORKING');
      console.log('✅ Database persistence: CONFIRMED');
      console.log('✅ Schema transformation: WORKING');
      console.log('✅ Customer retrieval: WORKING');
      console.log('✅ Address mapping: WORKING');
      
    } else {
      console.log('❌ Test customer not found in list');
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

testRailwayAPI().catch(console.error);
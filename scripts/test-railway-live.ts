#!/usr/bin/env npx tsx

async function testRailwayLive() {
  console.log('🚂 Testing Railway Live Deployment\n');

  // Test the debug endpoint
  console.log('1️⃣ Checking debug endpoint...');
  const debugResponse = await fetch('https://jobeye-production.up.railway.app/api/debug/auth');
  const debugData = await debugResponse.json();
  console.log('Debug response:', JSON.stringify(debugData, null, 2));

  // Test the demo-crud endpoint
  console.log('\n2️⃣ Testing demo-crud endpoint...');
  const crudResponse = await fetch('https://jobeye-production.up.railway.app/api/demo-crud');
  if (crudResponse.ok) {
    const crudData = await crudResponse.json();
    console.log('CRUD Success:', crudData.success);
    console.log('Database URL:', crudData.databaseInfo?.url);
    console.log('Total customers:', crudData.operations?.read?.totalCustomers);
  } else {
    console.log('CRUD Error:', crudResponse.status, await crudResponse.text());
  }

  // Test customer API directly
  console.log('\n3️⃣ Testing customer API with demo flag...');
  const customerResponse = await fetch('https://jobeye-production.up.railway.app/api/supervisor/customers?demo=true');
  if (customerResponse.ok) {
    const customerData = await customerResponse.json();
    console.log('Customer API Success!');
    console.log('Total customers:', customerData.total_count);
    console.log('First customer:', customerData.customers?.[0]?.name);
  } else {
    console.log('Customer API Error:', customerResponse.status);
  }
}

testRailwayLive().catch(console.error);
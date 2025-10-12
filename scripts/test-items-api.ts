#!/usr/bin/env npx tsx
import fetch from 'node-fetch';

const BASE_URL = 'https://jobeye-production.up.railway.app';
// const BASE_URL = 'http://localhost:3000'; // For local testing

async function testDebugEndpoint() {
  console.log('🧪 Testing Items Debug Endpoint...\n');

  // Test GET
  console.log('1️⃣ Testing GET /api/debug/items');
  try {
    const getResponse = await fetch(`${BASE_URL}/api/debug/items`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    const getData = await getResponse.json();
    console.log('Status:', getResponse.status);
    console.log('Response:', JSON.stringify(getData, null, 2));
  } catch (error) {
    console.error('GET Error:', error);
  }

  console.log('\n2️⃣ Testing POST /api/debug/items');
  try {
    const postResponse = await fetch(`${BASE_URL}/api/debug/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Lawn Mower',
        item_type: 'equipment',
        category: 'lawn-care',
        tracking_mode: 'individual',
        current_quantity: 1,
        unit_of_measure: 'each',
        description: 'Test from API script'
      })
    });
    const postData = await postResponse.json();
    console.log('Status:', postResponse.status);
    console.log('Response:', JSON.stringify(postData, null, 2));
  } catch (error) {
    console.error('POST Error:', error);
  }
}

async function testItemsAPI() {
  console.log('\n\n🎯 Testing Items API...\n');

  // Test GET items
  console.log('3️⃣ Testing GET /api/supervisor/items');
  try {
    const response = await fetch(`${BASE_URL}/api/supervisor/items`, {
      headers: {
        'Accept': 'application/json',
        'x-tenant-id': '00000000-0000-0000-0000-000000000000'
      }
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }

  // Test POST item
  console.log('\n4️⃣ Testing POST /api/supervisor/items');
  try {
    const response = await fetch(`${BASE_URL}/api/supervisor/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-tenant-id': '00000000-0000-0000-0000-000000000000'
      },
      body: JSON.stringify({
        item_type: 'material',
        category: 'lawn-care',
        name: 'Grass Seed',
        tracking_mode: 'quantity',
        current_quantity: 25,
        unit_of_measure: 'pound',
        min_quantity: 10,
        reorder_point: 15,
        description: 'Premium grass seed mix'
      })
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    // If successful, test GET single item
    if (response.status === 201 && data.item?.id) {
      console.log('\n5️⃣ Testing GET /api/supervisor/items/[id]');
      const getOne = await fetch(`${BASE_URL}/api/supervisor/items/${data.item.id}`, {
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': '00000000-0000-0000-0000-000000000000'
        }
      });
      const oneData = await getOne.json();
      console.log('Status:', getOne.status);
      console.log('Response:', JSON.stringify(oneData, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run tests
(async () => {
  await testDebugEndpoint();
  await testItemsAPI();
})();
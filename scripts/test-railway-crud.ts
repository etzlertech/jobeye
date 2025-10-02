#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

// Use exact Railway environment variables
const supabaseUrl = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnand3cWt4a2ZjYXBhc3Z3YSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM3MDM1MDQ1LCJleHAiOjIwNTI2MTEwNDV9.oDCDf6Ys3-LCaI1oI8-W4P3h0rA7M-V0xQwMbYf-fXE';

async function testRailwayCRUD() {
  console.log('🚂 Testing Railway CRUD Operations...\n');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Test 1: Simple query to check connection
  console.log('1️⃣ Testing basic database query...');
  const { data: customers, error: queryError } = await supabase
    .from('customers')
    .select('customer_id, customer_name')
    .limit(5);

  if (queryError) {
    console.error('❌ Query failed:', queryError);
    
    // Check if it's an auth issue
    if (queryError.message.includes('JWT')) {
      console.log('\n🔍 Checking JWT details...');
      const [header, payload] = supabaseAnonKey.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      console.log('JWT ref:', decodedPayload.ref);
      console.log('URL ref:', supabaseUrl.match(/https:\/\/(\w+)\.supabase/)?.[1]);
      console.log('Match:', decodedPayload.ref === supabaseUrl.match(/https:\/\/(\w+)\.supabase/)?.[1]);
    }
  } else {
    console.log('✅ Query successful!');
    console.log(`Found ${customers?.length || 0} customers`);
  }

  // Test 2: Check auth status
  console.log('\n2️⃣ Testing authentication status...');
  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session:', session ? 'Active' : 'None');

  // Test 3: Direct REST API call
  console.log('\n3️⃣ Testing direct REST API...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/customers?limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    
    console.log('REST API Status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error:', errorText);
    } else {
      const data = await response.json();
      console.log('✅ REST API works!', data.length, 'customers found');
    }
  } catch (err) {
    console.error('❌ REST API failed:', err);
  }

  console.log('\n📊 Summary:');
  console.log('- Supabase URL:', supabaseUrl);
  console.log('- Key length:', supabaseAnonKey.length);
  console.log('- Key preview:', supabaseAnonKey.substring(0, 50) + '...');
}

testRailwayCRUD().catch(console.error);
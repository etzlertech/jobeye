#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load local env to get service key
dotenv.config({ path: '.env.local' });

// Use Railway's Supabase URL but local service key
const RAILWAY_URL = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const LOCAL_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function connectToRailwaySupabase() {
  console.log('🔍 Attempting to connect to Railway Supabase with local service key...\n');
  
  const supabase = createClient(RAILWAY_URL, LOCAL_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Test connection
  console.log('📊 Testing database connection...');
  const { data: customers, error } = await supabase
    .from('customers')
    .select('customer_id, customer_name')
    .limit(5);

  if (error) {
    console.error('❌ Connection failed:', error);
    
    // Try to understand the key mismatch
    console.log('\n🔑 Key Analysis:');
    console.log('- Railway URL project:', RAILWAY_URL.match(/https:\/\/(\w+)\./)?.[1]);
    console.log('- Local service key length:', LOCAL_SERVICE_KEY?.length);
    
    // Decode the JWT to see project ref
    if (LOCAL_SERVICE_KEY) {
      try {
        const [header, payload] = LOCAL_SERVICE_KEY.split('.');
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
        console.log('- Local service key project ref:', decoded.ref);
        console.log('- Key role:', decoded.role);
      } catch (e) {
        console.log('- Could not decode service key');
      }
    }
  } else {
    console.log('✅ Connection successful!');
    console.log(`Found ${customers?.length || 0} customers`);
    
    if (customers && customers.length > 0) {
      console.log('\nCustomer list:');
      customers.forEach(c => {
        console.log(`- ${c.customer_name} (${c.customer_id})`);
      });
    }
  }
}

connectToRailwaySupabase().catch(console.error);
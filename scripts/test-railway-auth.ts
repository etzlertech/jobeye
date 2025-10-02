#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

// Railway's Supabase configuration from environment
const RAILWAY_SUPABASE_URL = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const RAILWAY_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function testRailwayAuth() {
  console.log('🚂 Testing Railway Supabase Authentication...\n');
  
  const client = createClient(RAILWAY_SUPABASE_URL, RAILWAY_SUPABASE_ANON_KEY);

  // Try to sign in with demo credentials
  console.log('🔐 Attempting to sign in with demo.supervisor@jobeye.app...');
  const { data, error } = await client.auth.signInWithPassword({
    email: 'demo.supervisor@jobeye.app',
    password: 'demo123'
  });

  if (error) {
    console.log('❌ Sign in failed:', error.message);
    
    // Try to check if we can query the database at all
    console.log('\n🔍 Testing database connection...');
    const { data: tenants, error: dbError } = await client
      .from('tenants')
      .select('count')
      .limit(1);

    if (dbError) {
      console.log('❌ Database query failed:', dbError);
    } else {
      console.log('✅ Database connection successful');
    }
  } else {
    console.log('✅ Sign in successful!');
    console.log('👤 User:', data.user?.email);
    console.log('🏢 Role:', data.user?.app_metadata?.role || data.user?.user_metadata?.role);
  }

  // Check if we can access public endpoints
  console.log('\n🌐 Testing public API access...');
  try {
    const response = await fetch('https://jobeye-production.up.railway.app/api/health');
    const healthData = await response.text();
    console.log('✅ Health check:', healthData);
  } catch (err) {
    console.log('❌ Health check failed:', err);
  }
}

testRailwayAuth().catch(console.error);
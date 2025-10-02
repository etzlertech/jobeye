#!/usr/bin/env npx tsx

import fetch from 'node-fetch';

// Parse Supabase URL to get project ref
const RAILWAY_SUPABASE_URL = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const projectRef = 'rtwigjwqufozqfwozpvo';

async function validateRailwaySupabase() {
  console.log('🚂 Validating Railway Supabase Configuration...\n');
  
  console.log('📍 Supabase Project Reference:', projectRef);
  console.log('🌐 Supabase URL:', RAILWAY_SUPABASE_URL);
  
  // The keys in Railway environment seem incorrect
  // The project ref in the key (rtwigjwwqkxkfcapasvwa) doesn't match the URL (rtwigjwqufozqfwozpvo)
  console.log('\n⚠️  Issue Detected:');
  console.log('The Supabase keys have project ref "rtwigjwwqkxkfcapasvwa"');
  console.log('But the URL has project ref "rtwigjwqufozqfwozpvo"');
  console.log('These should match!\n');
  
  console.log('🔧 Solution:');
  console.log('The Railway environment variables need to be updated with matching keys.');
  console.log('Either:');
  console.log('1. Update NEXT_PUBLIC_SUPABASE_URL to use rtwigjwwqkxkfcapasvwa');
  console.log('2. Or get new keys for rtwigjwqufozqfwozpvo project');
  
  // Test if the URL is accessible
  console.log('\n🧪 Testing Supabase URL accessibility...');
  try {
    const response = await fetch(`${RAILWAY_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD'
    });
    console.log('Response status:', response.status);
    if (response.status === 401) {
      console.log('✅ Supabase endpoint is reachable (401 is expected without auth)');
    }
  } catch (err) {
    console.log('❌ Failed to reach Supabase:', err);
  }
}

validateRailwaySupabase().catch(console.error);
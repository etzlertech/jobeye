#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

dotenv.config({ path: envPath });

console.log('🔍 Checking Local .env.local Keys\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL
const urlRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
console.log(`URL Project Ref: ${urlRef}`);

// Decode keys
if (anonKey) {
  try {
    const [, payload] = anonKey.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    console.log(`\nAnon Key Project Ref: ${decoded.ref}`);
    console.log(`Match: ${decoded.ref === urlRef ? '✅' : '❌'}`);
  } catch (e) {
    console.log('\nAnon Key: Could not decode');
  }
}

if (serviceKey) {
  try {
    const [, payload] = serviceKey.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    console.log(`\nService Key Project Ref: ${decoded.ref}`);
    console.log(`Match: ${decoded.ref === urlRef ? '✅' : '❌'}`);
  } catch (e) {
    console.log('\nService Key: Could not decode');
  }
}

console.log('\n📊 Summary:');
console.log(`- URL points to: ${urlRef}`);
console.log(`- Keys configured: ${anonKey ? 'Yes' : 'No'}`);
console.log(`- URL in .env.local: ${supabaseUrl}`);
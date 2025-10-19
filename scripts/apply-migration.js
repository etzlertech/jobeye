#!/usr/bin/env node

/**
 * Script to apply task_definitions migration via Supabase API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Read migration SQL
const migrationPath = path.join(__dirname, '../supabase/migrations/20251019144445_create_task_definitions.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Supabase project details
const SUPABASE_PROJECT_REF = 'rtwigjwqufozqfwozpvo';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0';

// Try executing via Supabase's SQL endpoint
const options = {
  hostname: `${SUPABASE_PROJECT_REF}.supabase.co`,
  path: '/rest/v1/rpc/execute_sql',
  method: 'POST',
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
};

const data = JSON.stringify({
  query: migrationSQL
});

console.log('Attempting to execute migration via Supabase API...');
console.log(`SQL length: ${migrationSQL.length} characters`);

const req = https.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log(`Response status: ${res.statusCode}`);
    console.log('Response:', body);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('\n✅ Migration applied successfully!');
      process.exit(0);
    } else {
      console.error('\n❌ Migration failed');
      console.error('This method requires a custom RPC function.');
      console.error('\nPlease apply migration manually via:');
      console.error('1. Supabase Dashboard > SQL Editor');
      console.error('2. Copy contents of: supabase/migrations/20251019144445_create_task_definitions.sql');
      console.error('3. Execute the SQL');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Error executing migration:', error.message);
  process.exit(1);
});

req.write(data);
req.end();

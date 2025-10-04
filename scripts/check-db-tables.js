#!/usr/bin/env node

// Simple script to check database tables
const { createClient } = require('@supabase/supabase-js');

// Load environment variables manually
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('Checking actual database tables...\n');

  // Get all tables
  const { data: tables, error } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  });

  if (error) {
    console.error('Error fetching tables:', error);
    process.exit(1);
  }

  const tableNames = tables.map(t => t.table_name);
  console.log(`Total tables: ${tableNames.length}\n`);

  // Check for orphaned tables
  const orphanedTables = [
    'table_inventory',
    'migration_tracking',
    'background_filter_preferences',
    'offline_sync_queue',
    'service_history',
    'time_entries',
    'load_verifications',
    'route_stops',
    'routes'
  ];

  console.log('Checking for orphaned tables:');
  let foundOrphaned = 0;
  
  for (const table of orphanedTables) {
    if (tableNames.includes(table)) {
      console.log(`  ❌ ${table} - still exists`);
      foundOrphaned++;
    } else {
      console.log(`  ✅ ${table} - already removed`);
    }
  }

  console.log(`\nOrphaned tables found: ${foundOrphaned}`);
  console.log('Total tables in database:', tableNames.length);
  
  if (foundOrphaned === 0) {
    console.log('\n✅ All orphaned tables have already been removed!');
  } else {
    console.log(`\n⚠️  ${foundOrphaned} orphaned tables still need to be removed.`);
  }
}

checkTables().catch(console.error);
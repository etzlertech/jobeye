#!/usr/bin/env tsx
/*
 * Run database migrations for JobEye
 * This script applies migrations in order
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log('🚀 Running database migrations...\n');

  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Alphabetical order

  console.log(`Found ${migrationFiles.length} migration files:\n`);

  for (const file of migrationFiles) {
    console.log(`📄 Running: ${file}`);
    
    try {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      
      // Skip empty files
      if (!sql.trim()) {
        console.log('   ⏭️  Skipped (empty file)\n');
        continue;
      }

      // Execute the migration
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.error(`   ❌ Error: ${error.message}\n`);
        // Continue with other migrations instead of stopping
      } else {
        console.log('   ✅ Success\n');
      }
      
    } catch (error) {
      console.error(`   ❌ Error reading file: ${error}\n`);
    }
  }

  console.log('✨ Migration run complete!');
}

// Alternative: Direct SQL execution without RPC
async function runMigrationsDirect() {
  console.log('🚀 Running database migrations (direct mode)...\n');
  console.log('⚠️  Note: This requires manual execution in Supabase SQL Editor\n');

  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log('Copy and run these migrations in order:\n');

  for (const file of migrationFiles) {
    console.log(`-- Migration: ${file}`);
    console.log('-- ' + '='.repeat(60));
    
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(sql);
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Check which mode to run
const mode = process.argv[2];

if (mode === '--print') {
  runMigrationsDirect();
} else {
  console.log('💡 Tip: Use --print flag to output SQL for manual execution\n');
  runMigrations().catch(console.error);
}
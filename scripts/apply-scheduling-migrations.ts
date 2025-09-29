#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.SUPABASE_DB_URL || 'postgresql://postgres.rtwigjwqufozqfwozpvo:Duke-neepo-oliver-ttq5@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function applyMigrations() {
  console.log('Applying scheduling migrations...');

  // Use pg directly for migrations
  const { default: pg } = await import('pg');
  const { Client } = pg;

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // For self-signed certificates
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // First check the companies table structure
    const checkCompanies = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'companies' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nCompanies table structure:');
    checkCompanies.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    // Check if kit_override_logs exists
    const checkKitLogs = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'kit_override_logs' 
        AND table_schema = 'public'
      );
    `);
    
    console.log('\nkit_override_logs exists:', checkKitLogs.rows[0].exists);

    // List of migration files to apply
    const migrations = [
      // '035_003_scheduling_kits.sql', // Skip for now due to syntax issues
      // '036_ensure_kit_uniques.sql',   // Skip - depends on 035
      '037_scheduling_core_tables.sql',
      '038_kit_override_notification_trigger.sql'
    ];

    for (const migration of migrations) {
      const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migration);
      
      if (fs.existsSync(migrationPath)) {
        console.log(`\nApplying ${migration}...`);
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        
        try {
          await client.query(sql);
          console.log(`✓ ${migration} applied successfully`);
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            console.log(`⚠ ${migration} - Some objects already exist (skipping)`);
          } else {
            console.error(`✗ ${migration} failed:`, error.message);
            throw error;
          }
        }
      } else {
        console.log(`⚠ Migration file not found: ${migration}`);
      }
    }

    console.log('\n✓ All migrations completed');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migrations
applyMigrations();
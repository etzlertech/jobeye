#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.SUPABASE_DB_URL || 'postgresql://postgres.rtwigjwqufozqfwozpvo:Duke-neepo-oliver-ttq5@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function checkTableExists(client: any, tableName: string): Promise<boolean> {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = $1 
      AND table_schema = 'public'
    );
  `, [tableName]);
  
  return result.rows[0].exists;
}

async function applyMigrationsSafely() {
  console.log('Applying scheduling migrations safely...');

  // Use pg directly for migrations
  const { default: pg } = await import('pg');
  const { Client } = pg;

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check which tables already exist
    const tables = ['kits', 'kit_items', 'kit_variants', 'kit_assignments', 'kit_override_logs', 
                   'day_plans', 'schedule_events', 'crew_assignments', 'job_kits'];
    
    console.log('\nChecking existing tables:');
    for (const table of tables) {
      const exists = await checkTableExists(client, table);
      console.log(`  ${table}: ${exists ? '✓ exists' : '✗ does not exist'}`);
    }

    // List of migrations to apply
    const migrations = [
      {
        file: '035_003_scheduling_kits.sql',
        name: 'Scheduling Kits Tables',
        skipIfTablesExist: ['kits', 'kit_items', 'kit_variants', 'kit_assignments']
      },
      {
        file: '036_ensure_kit_uniques.sql',
        name: 'Kit Unique Constraints',
        skipIfTablesExist: []
      },
      {
        file: '037_scheduling_core_tables.sql',
        name: 'Scheduling Core Tables',
        skipIfTablesExist: ['day_plans', 'schedule_events']
      },
      {
        file: '038_kit_override_notification_trigger.sql',
        name: 'Kit Override Notification Trigger',
        skipIfTablesExist: []
      }
    ];

    for (const migration of migrations) {
      console.log(`\n=== ${migration.name} ===`);
      
      // Check if we should skip
      if (migration.skipIfTablesExist.length > 0) {
        const shouldSkip = await Promise.all(
          migration.skipIfTablesExist.map(t => checkTableExists(client, t))
        ).then(results => results.some(exists => exists));
        
        if (shouldSkip) {
          console.log(`⚠ Skipping ${migration.file} - some tables already exist`);
          continue;
        }
      }

      const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migration.file);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠ Migration file not found: ${migration.file}`);
        continue;
      }

      console.log(`Applying ${migration.file}...`);
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      
      // For kit_override_logs alterations, handle them specially
      if (migration.file === '037_scheduling_core_tables.sql' && await checkTableExists(client, 'kit_override_logs')) {
        console.log('  Special handling for existing kit_override_logs table...');
        
        // Extract just the ALTER TABLE statements for kit_override_logs
        const alterStatements = sql.match(/ALTER TABLE public\.kit_override_logs[\s\S]*?(?=\n\n|CREATE|ALTER TABLE (?!public\.kit_override_logs))/g);
        
        if (alterStatements) {
          for (const stmt of alterStatements) {
            try {
              await client.query(stmt);
              console.log('  ✓ Applied kit_override_logs alterations');
            } catch (err: any) {
              if (err.message.includes('already exists') || err.message.includes('does not exist')) {
                console.log('  ⚠ Some alterations already applied or not needed');
              } else {
                throw err;
              }
            }
          }
        }
        
        // Then apply the rest of the migration without the ALTER TABLE part
        const sqlWithoutAlter = sql.replace(/ALTER TABLE public\.kit_override_logs[\s\S]*?(?=\n\n|CREATE|ALTER TABLE (?!public\.kit_override_logs))/g, '');
        
        try {
          await client.query(sqlWithoutAlter);
          console.log(`✓ ${migration.file} applied successfully (partial)`);
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            console.log(`⚠ ${migration.file} - Some objects already exist`);
          } else {
            console.error(`✗ ${migration.file} failed:`, error.message);
            console.error('SQL that failed:', sqlWithoutAlter.substring(0, 200) + '...');
            throw error;
          }
        }
      } else {
        // Normal migration application
        try {
          await client.query(sql);
          console.log(`✓ ${migration.file} applied successfully`);
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            console.log(`⚠ ${migration.file} - Some objects already exist`);
          } else {
            console.error(`✗ ${migration.file} failed:`, error.message);
            console.error('SQL that failed:', sql.substring(0, 200) + '...');
            throw error;
          }
        }
      }
    }

    // Final check of what was created
    console.log('\n=== Final Table Status ===');
    for (const table of tables) {
      const exists = await checkTableExists(client, table);
      console.log(`  ${table}: ${exists ? '✓ exists' : '✗ does not exist'}`);
    }

    console.log('\n✓ Migration process completed');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migrations
applyMigrationsSafely();
#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

async function checkJobRelatedTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('🔍 Checking actual database schema for job and equipment related tables...\n');

  try {
    // Check all tables that might contain job equipment data
    const queries = [
      // Find all tables with 'job' or 'equipment' in the name
      {
        name: 'Tables with job/equipment in name',
        sql: `
          SELECT table_name, obj_description(pgc.oid, 'pg_class') as comment
          FROM information_schema.tables t
          JOIN pg_class pgc ON pgc.relname = t.table_name
          WHERE table_schema = 'public'
          AND (
            table_name LIKE '%job%' 
            OR table_name LIKE '%equipment%' 
            OR table_name LIKE '%kit%'
            OR table_name LIKE '%tool%'
            OR table_name LIKE '%item%'
            OR table_name LIKE '%checklist%'
            OR table_name LIKE '%load%'
            OR table_name LIKE '%inventory%'
          )
          ORDER BY table_name;
        `
      },
      // Check if job_equipment_requirements already exists
      {
        name: 'Check if job_equipment_requirements exists',
        sql: `
          SELECT COUNT(*) as exists
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'job_equipment_requirements';
        `
      },
      // Check job_templates structure
      {
        name: 'Job templates table structure',
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'job_templates'
          ORDER BY ordinal_position;
        `
      },
      // Check jobs table structure for equipment-related columns
      {
        name: 'Jobs table equipment-related columns',
        sql: `
          SELECT column_name, data_type, is_nullable, column_default,
                 col_description(pgc.oid, cols.ordinal_position) as comment
          FROM information_schema.columns cols
          JOIN pg_class pgc ON pgc.relname = cols.table_name
          WHERE table_schema = 'public' 
          AND table_name = 'jobs'
          AND (
            column_name LIKE '%equipment%'
            OR column_name LIKE '%kit%'
            OR column_name LIKE '%load%'
            OR column_name LIKE '%item%'
            OR column_name LIKE '%tool%'
          )
          ORDER BY ordinal_position;
        `
      },
      // Check for any template equipment tables
      {
        name: 'Job template equipment tables',
        sql: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND (
            table_name LIKE '%template%equipment%'
            OR table_name LIKE '%template%item%'
            OR table_name LIKE '%template%kit%'
          );
        `
      },
      // Check inventory/items tables
      {
        name: 'Inventory and items tables',
        sql: `
          SELECT table_name, obj_description(pgc.oid, 'pg_class') as comment
          FROM information_schema.tables t
          JOIN pg_class pgc ON pgc.relname = t.table_name
          WHERE table_schema = 'public'
          AND table_name IN (
            'inventory', 'inventory_items', 'items', 
            'equipment', 'equipment_items', 'tools'
          );
        `
      },
      // Look for JSON/JSONB columns that might store equipment lists
      {
        name: 'JSONB columns in job-related tables',
        sql: `
          SELECT table_name, column_name, 
                 col_description(pgc.oid, cols.ordinal_position) as comment
          FROM information_schema.columns cols
          JOIN pg_class pgc ON pgc.relname = cols.table_name
          WHERE table_schema = 'public'
          AND data_type = 'jsonb'
          AND table_name IN ('jobs', 'job_templates', 'job_executions')
          ORDER BY table_name, column_name;
        `
      },
      // Check detected_items table structure
      {
        name: 'Detected items table (vision verification)',
        sql: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'detected_items'
          ORDER BY ordinal_position
          LIMIT 10;
        `
      }
    ];

    // Execute all queries
    for (const query of queries) {
      console.log(`\n📊 ${query.name}:`);
      console.log('─'.repeat(60));
      
      const { data, error } = await client.rpc('exec_sql', { sql: query.sql });
      
      if (error) {
        console.error('❌ Error:', error.message);
      } else if (data && data.length > 0) {
        console.table(data);
      } else {
        console.log('No results found');
      }
    }

    // Check specific table counts
    console.log('\n📈 Table Record Counts:');
    console.log('─'.repeat(60));
    
    const countTables = ['jobs', 'job_templates', 'detected_items', 'job_equipment_requirements'];
    for (const tableName of countTables) {
      const { data, error } = await client.rpc('exec_sql', {
        sql: `SELECT COUNT(*) as count FROM ${tableName};`
      });
      
      if (!error && data && data.length > 0) {
        console.log(`${tableName}: ${data[0].count} records`);
      }
    }

  } catch (error) {
    console.error('\n❌ Failed to check database:', error);
    process.exit(1);
  }
}

// Run the check
checkJobRelatedTables().catch(console.error);
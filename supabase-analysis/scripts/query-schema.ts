#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function queryDatabaseSchema() {
  console.log('🔍 Querying Database Schema\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Query 1: Get all public tables using RPC
    console.log('📊 Fetching public tables...');
    const tablesQuery = `
      SELECT 
        t.table_name,
        obj_description(c.oid, 'pg_class') as description
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `;
    
    const { data: tablesData, error: tablesError } = await supabase.rpc('exec_sql', {
      sql: tablesQuery
    });
    
    if (tablesError) {
      console.error('❌ Failed to fetch tables:', tablesError);
      // Try alternative approach
      console.log('\n🔄 Trying alternative approach...');
      
      // List known tables from the CLAUDE.md
      const knownTables = [
        'companies', 'users', 'customers', 'properties', 'equipment', 
        'materials', 'jobs', 'job_templates', 'voice_sessions', 
        'voice_transcripts', 'detected_items', 'vision_verification_records',
        'vision_cost_records', 'detection_confidence_thresholds'
      ];
      
      console.log('Testing known tables:');
      for (const table of knownTables.slice(0, 5)) { // Test first 5
        const { error } = await supabase.from(table).select('*').limit(0);
        if (!error) {
          console.log(`  ✓ ${table} - accessible`);
        } else {
          console.log(`  ✗ ${table} - ${error.message}`);
        }
      }
    } else {
      console.log('✓ Found tables in public schema');
      console.log('Tables:', tablesData);
    }
    
    // Query 2: Get columns for a specific table
    console.log('\n📋 Fetching columns for companies table...');
    const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'companies'
      ORDER BY ordinal_position;
    `;
    
    const { data: columnsData, error: columnsError } = await supabase.rpc('exec_sql', {
      sql: columnsQuery
    });
    
    if (columnsError) {
      console.error('❌ Failed to fetch columns:', columnsError);
    } else {
      console.log('✓ Companies table structure:');
      console.log(columnsData);
    }
    
    // Query 3: Check for foreign keys
    console.log('\n🔗 Checking foreign key relationships...');
    const fkQuery = `
      SELECT
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name as to_table,
        ccu.column_name as to_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
      LIMIT 10;
    `;
    
    const { data: fkData, error: fkError } = await supabase.rpc('exec_sql', {
      sql: fkQuery
    });
    
    if (fkError) {
      console.error('❌ Failed to fetch foreign keys:', fkError);
    } else {
      console.log('✓ Sample foreign key relationships:');
      console.log(fkData);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

queryDatabaseSchema().catch(console.error);
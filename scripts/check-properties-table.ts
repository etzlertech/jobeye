#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkPropertiesTable() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  console.log('🔍 Checking properties table...\n');

  // Check if table exists
  const { data: tables, error: tablesError } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'properties'
    `
  });

  if (tablesError) {
    console.error('❌ Error checking tables:', tablesError);
    return;
  }

  if (!tables || tables.length === 0) {
    console.log('❌ Properties table does not exist!');
    
    // Check what tables do exist
    const { data: allTables } = await client.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    });
    
    console.log('\nAvailable tables:', allTables?.map(t => t.table_name));
    return;
  }

  console.log('✅ Properties table exists!');

  // Check columns
  const { data: columns, error: columnsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'properties'
      ORDER BY ordinal_position
    `
  });

  if (!columnsError && columns) {
    console.log('\nColumns in properties table:');
    columns.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
  }
}

checkPropertiesTable().catch(console.error);
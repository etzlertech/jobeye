#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkJobsTable() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking jobs table in production database...\n');

  try {
    // Check if jobs table exists
    const { data: tables, error: tableError } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'jobs');
    
    if (tableError) {
      console.error('❌ Error checking tables:', tableError);
      
      // Try a simpler query
      console.log('\nTrying direct jobs query...');
      const { data: jobs, error: jobsError } = await client
        .from('jobs')
        .select('count')
        .limit(1);
      
      if (jobsError) {
        console.error('❌ Jobs table error:', jobsError);
        console.log('\n⚠️  The jobs table might not exist or has permission issues');
      } else {
        console.log('✅ Jobs table exists and is accessible');
      }
      return;
    }
    
    console.log('Tables found:', tables);
    
    // List all tables to see what we have
    console.log('\n📋 Listing all public tables...');
    const { data: allTables, error: allError } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (!allError && allTables) {
      console.log(`Found ${allTables.length} tables:`);
      allTables.forEach(t => console.log(`  - ${t.table_name}`));
    }
    
    // Try to get columns if jobs table exists
    console.log('\n📊 Checking jobs table structure...');
    const { data: columns, error: colError } = await client
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'jobs')
      .order('ordinal_position');
    
    if (!colError && columns && columns.length > 0) {
      console.log('Jobs table columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ Could not retrieve jobs table columns');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkJobsTable().catch(console.error);
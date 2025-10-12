#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testPropertiesAPI() {
  const client = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🔍 Testing properties table access...\n');

  try {
    // Test 1: Check if properties table exists
    const { data, error } = await client
      .from('properties')
      .select('id, tenant_id')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing properties table:', error);
      
      // Try to get more info about the error
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('\n📋 Checking available tables...');
        
        // Query information schema
        const { data: tables, error: tablesError } = await client.rpc('exec_sql', {
          sql: `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%propert%'
            ORDER BY table_name;
          `
        });

        if (!tablesError && tables) {
          console.log('Property-related tables:', tables);
        }
      }
    } else {
      console.log('✅ Properties table exists and is accessible');
      console.log('Sample data:', data);
    }

    // Test 2: Check columns
    console.log('\n📊 Checking properties table columns...');
    const { data: columns, error: columnsError } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'properties'
        ORDER BY ordinal_position;
      `
    });

    if (!columnsError && columns) {
      console.log('Columns in properties table:');
      columns.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

    // Test 3: Check for address column structure
    console.log('\n🏠 Checking address column type...');
    const { data: addressCol, error: addressColError } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'properties'
        AND column_name = 'address';
      `
    });

    if (!addressColError && addressCol && addressCol.length > 0) {
      console.log('Address column details:', addressCol[0]);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testPropertiesAPI().catch(console.error);
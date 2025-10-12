#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testCustomersAPI() {
  const client = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🔍 Testing customers table access...\n');

  try {
    // Test 1: Check if customers table exists
    const { data, error } = await client
      .from('customers')
      .select('id, name, tenant_id')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing customers table:', error);
      
      // Try to get more info about the error
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('\n📋 Checking available tables...');
        
        // Query information schema
        const { data: tables, error: tablesError } = await client.rpc('exec_sql', {
          sql: `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%customer%'
            ORDER BY table_name;
          `
        });

        if (!tablesError && tables) {
          console.log('Customer-related tables:', tables);
        }
      }
    } else {
      console.log('✅ Customers table exists and is accessible');
      console.log('Sample data:', data);
    }

    // Test 2: Check columns
    console.log('\n📊 Checking customers table columns...');
    const { data: columns, error: columnsError } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'customers'
        ORDER BY ordinal_position;
      `
    });

    if (!columnsError && columns) {
      console.log('Columns in customers table:');
      columns.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testCustomersAPI().catch(console.error);
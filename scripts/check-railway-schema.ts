#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const RAILWAY_URL = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const LOCAL_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkRailwaySchema() {
  console.log('🔍 Checking Railway Supabase Schema...\n');
  
  const supabase = createClient(RAILWAY_URL, LOCAL_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Check if customers table exists
  console.log('📊 Checking customers table...');
  const { data: tableInfo, error: tableError } = await supabase
    .from('customers')
    .select('*')
    .limit(1);

  if (tableError) {
    console.log('❌ Error querying customers table:', tableError.message);
    
    // Try to get table structure from information_schema
    console.log('\n🔍 Checking information_schema...');
    const { data: columns, error: schemaError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'customers'
          ORDER BY ordinal_position;
        `
      });

    if (schemaError) {
      console.log('❌ Could not query information_schema:', schemaError);
    } else if (columns && columns.length > 0) {
      console.log('✅ Customers table columns:');
      columns.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    } else {
      console.log('⚠️  No customers table found in schema');
    }
  } else {
    console.log('✅ Customers table exists!');
    if (tableInfo && tableInfo.length > 0) {
      console.log('\nTable columns:', Object.keys(tableInfo[0]));
    }
  }

  // Check for demo tenant
  console.log('\n🏢 Checking for demo tenant...');
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('tenant_id', '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e')
    .single();

  if (tenantError) {
    console.log('❌ Error querying tenants:', tenantError.message);
  } else if (tenant) {
    console.log('✅ Demo tenant exists:', tenant.tenant_name);
  }

  // List all tables
  console.log('\n📋 Listing all tables in public schema...');
  const { data: tables, error: tablesError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
        LIMIT 20;
      `
    });

  if (tablesError) {
    console.log('❌ Could not list tables:', tablesError);
  } else if (tables) {
    console.log('Tables found:');
    tables.forEach((t: any) => console.log(`  - ${t.table_name}`));
  }
}

checkRailwaySchema().catch(console.error);
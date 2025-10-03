#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('   Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

async function checkUnifiedTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking for unified inventory tables...\n');

  try {
    // Check if items table exists
    console.log('1. Checking for "items" table:');
    const { data: itemsTable, error: itemsError } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          table_name,
          (SELECT COUNT(*) FROM items) as row_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'items'
      `
    });

    if (itemsError) {
      console.log('   ❌ Error checking items table:', itemsError.message);
    } else if (itemsTable && itemsTable.length > 0) {
      console.log('   ✅ Table exists');
      console.log(`   📊 Row count: ${itemsTable[0].row_count || 0}`);
    } else {
      console.log('   ❌ Table does not exist');
    }

    // Check if item_transactions table exists
    console.log('\n2. Checking for "item_transactions" table:');
    const { data: transactionsTable, error: transError } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          table_name,
          (SELECT COUNT(*) FROM item_transactions) as row_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'item_transactions'
      `
    });

    if (transError) {
      console.log('   ❌ Error checking item_transactions table:', transError.message);
    } else if (transactionsTable && transactionsTable.length > 0) {
      console.log('   ✅ Table exists');
      console.log(`   📊 Row count: ${transactionsTable[0].row_count || 0}`);
    } else {
      console.log('   ❌ Table does not exist');
    }

    // Check columns of items table if it exists
    if (itemsTable && itemsTable.length > 0) {
      console.log('\n3. Checking "items" table structure:');
      const { data: columns, error: colError } = await client.rpc('exec_sql', {
        sql: `
          SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'items'
          ORDER BY ordinal_position
        `
      });

      if (colError) {
        console.log('   ❌ Error checking columns:', colError.message);
      } else if (columns && columns.length > 0) {
        console.log('   ✅ Table columns:');
        columns.forEach((col: any) => {
          console.log(`      - ${col.column_name} (${col.data_type}${col.is_nullable === 'NO' ? ', NOT NULL' : ''})`);
        });
      }
    }

    // Check indexes
    console.log('\n4. Checking indexes on "items" table:');
    const { data: indexes, error: idxError } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'items'
      `
    });

    if (idxError) {
      console.log('   ❌ Error checking indexes:', idxError.message);
    } else if (indexes && indexes.length > 0) {
      console.log('   ✅ Indexes found:');
      indexes.forEach((idx: any) => {
        console.log(`      - ${idx.indexname}`);
      });
    } else {
      console.log('   ⚠️  No indexes found (table might not exist)');
    }

    // Check RLS policies
    console.log('\n5. Checking RLS policies on "items" table:');
    const { data: policies, error: polError } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          policyname,
          cmd,
          permissive
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'items'
      `
    });

    if (polError) {
      console.log('   ❌ Error checking policies:', polError.message);
    } else if (policies && policies.length > 0) {
      console.log('   ✅ RLS policies found:');
      policies.forEach((pol: any) => {
        console.log(`      - ${pol.policyname} (${pol.cmd}, ${pol.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE'})`);
      });
    } else {
      console.log('   ⚠️  No RLS policies found');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  console.log('\n✅ Check complete!');
}

checkUnifiedTables().catch(console.error);
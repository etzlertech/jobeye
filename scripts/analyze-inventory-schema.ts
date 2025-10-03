#!/usr/bin/env npx tsx
/**
 * Analyze current inventory schema to design unified model
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeInventorySchema() {
  console.log('🔍 Analyzing inventory schema...\n');

  // Get all tables related to inventory and equipment
  const { data: tables, error: tableError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        table_name,
        obj_description(pgc.oid) as table_comment
      FROM information_schema.tables t
      JOIN pg_class pgc ON pgc.relname = t.table_name
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND (
        table_name LIKE '%inventory%' 
        OR table_name LIKE '%equipment%'
        OR table_name LIKE '%container%'
        OR table_name LIKE '%material%'
        OR table_name LIKE '%tool%'
        OR table_name = 'items'
      )
      ORDER BY table_name;
    `
  });

  if (tableError) {
    console.error('❌ Error fetching tables:', tableError);
    process.exit(1);
  }

  console.log('📋 Found inventory-related tables:\n');
  for (const table of tables || []) {
    console.log(`  • ${table.table_name}`);
    if (table.table_comment) {
      console.log(`    ${table.table_comment}`);
    }
    
    // Get columns for each table
    const { data: columns } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = '${table.table_name}'
        ORDER BY ordinal_position;
      `
    });

    if (columns && columns.length > 0) {
      console.log('    Columns:');
      for (const col of columns) {
        const nullable = col.is_nullable === 'YES' ? '?' : '';
        const defaultVal = col.column_default ? ` (default: ${col.column_default})` : '';
        console.log(`      - ${col.column_name}: ${col.data_type}${nullable}${defaultVal}`);
      }
    }
    console.log('');
  }

  // Get row counts
  console.log('📊 Row counts:\n');
  for (const table of tables || []) {
    const { data: count } = await client.rpc('exec_sql', {
      sql: `SELECT COUNT(*) as count FROM "${table.table_name}"`
    });
    
    if (count && count[0]) {
      console.log(`  • ${table.table_name}: ${count[0].count} rows`);
    }
  }
  
  console.log('\n🎯 Analysis Summary:');
  console.log('\nDuplication patterns found:');
  console.log('1. Equipment vs Inventory Items:');
  console.log('   - equipment table: General equipment records');
  console.log('   - inventory_items table: Similar but with quantity tracking');
  console.log('   - tools table: Specialized tool records');
  console.log('   - materials table: Material records with quantity');
  
  console.log('\n2. Container Management:');
  console.log('   - containers table: Equipment domain containers');
  console.log('   - container_assignments: Links items to containers');
  
  console.log('\n🏗️  Proposed Unified Schema:');
  console.log('\n1. Single "items" table with:');
  console.log('   - item_type: equipment | material | consumable | tool');
  console.log('   - tracking_mode: individual | quantity | batch');
  console.log('   - Common fields: id, tenant_id, name, description, sku, barcode');
  console.log('   - Quantity fields: current_quantity, min_quantity, max_quantity');
  console.log('   - Location: current_location_id, home_location_id');
  console.log('   - Status: status (active | maintenance | retired | lost)');
  console.log('   - Metadata: attributes (JSONB for type-specific data)');
  
  console.log('\n2. Keep "containers" table as-is (already unified)');
  
  console.log('\n3. Keep "container_assignments" for tracking');
  
  console.log('\n4. Single "item_transactions" table for all movements');
  
  console.log('\n5. Drop redundant tables:');
  console.log('   - equipment (merge into items)');
  console.log('   - inventory_items (merge into items)');
  console.log('   - tools (merge into items)');
  console.log('   - materials (merge into items)');
}

analyzeInventorySchema().catch(console.error);
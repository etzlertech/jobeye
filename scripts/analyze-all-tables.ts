#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function analyzeDatabase() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Analyzing complete database schema...\n');

  // Get all tables
  const { data: tables, error: tablesError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        t.table_name,
        obj_description(('"' || t.table_schema || '"."' || t.table_name || '"')::regclass, 'pg_class') as description,
        COUNT(c.column_name) as column_count
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c 
        ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name, t.table_schema
      ORDER BY t.table_name;
    `
  });

  if (tablesError) {
    console.error('❌ Error getting tables:', tablesError);
    process.exit(1);
  }

  console.log(`📊 Found ${tables?.length || 0} tables in the database:\n`);
  
  // Group tables by apparent domain/purpose
  const tablesByDomain: Record<string, any[]> = {};
  
  tables?.forEach(table => {
    let domain = 'other';
    const name = table.table_name;
    
    // Categorize by prefix/pattern
    if (name.startsWith('vision_') || name.includes('detected_') || name.includes('verification')) {
      domain = 'vision';
    } else if (name.includes('job') || name === 'jobs' || name.includes('work_order')) {
      domain = 'jobs';
    } else if (name.includes('customer') || name.includes('contact')) {
      domain = 'customers';
    } else if (name.includes('property') || name.includes('properties')) {
      domain = 'properties';
    } else if (name.includes('equipment') || name.includes('kit')) {
      domain = 'equipment';
    } else if (name.includes('voice') || name.includes('transcription') || name.includes('intent')) {
      domain = 'voice';
    } else if (name.includes('schedule') || name.includes('routing')) {
      domain = 'scheduling';
    } else if (name.includes('crew') || name.includes('user') || name.includes('profile')) {
      domain = 'users';
    } else if (name.includes('material') || name.includes('inventory')) {
      domain = 'inventory';
    } else if (name.includes('offline') || name.includes('sync')) {
      domain = 'offline';
    } else if (name.includes('ai_') || name.includes('llm')) {
      domain = 'ai';
    } else if (name.includes('field_intelligence') || name.includes('workflow')) {
      domain = 'field_intelligence';
    } else if (name.includes('config') || name.includes('setting') || name.includes('company')) {
      domain = 'configuration';
    }
    
    if (!tablesByDomain[domain]) {
      tablesByDomain[domain] = [];
    }
    tablesByDomain[domain].push(table);
  });

  // Display by domain
  Object.entries(tablesByDomain).forEach(([domain, tables]) => {
    console.log(`\n🏷️  ${domain.toUpperCase()} DOMAIN (${tables.length} tables):`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name} (${table.column_count} columns)`);
    });
  });

  // Check for RLS policies
  console.log('\n\n🔒 Checking RLS Status...');
  const { data: rlsStatus, error: rlsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        schemaname,
        tablename,
        COUNT(policyname) as policy_count,
        array_agg(policyname) as policies
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY schemaname, tablename
      ORDER BY tablename;
    `
  });

  if (!rlsError && rlsStatus) {
    console.log(`\n📋 Tables with RLS policies: ${rlsStatus.length}`);
    const tablesWithoutRls = tables?.filter(t => 
      !rlsStatus.find(r => r.tablename === t.table_name)
    );
    
    if (tablesWithoutRls && tablesWithoutRls.length > 0) {
      console.log(`\n⚠️  Tables WITHOUT RLS policies (${tablesWithoutRls.length}):`);
      tablesWithoutRls.forEach(t => console.log(`  - ${t.table_name}`));
    }
  }

  // Check for foreign key relationships
  console.log('\n\n🔗 Checking Foreign Key Relationships...');
  const { data: fks, error: fkError } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        tc.table_name AS from_table,
        kcu.column_name AS from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `
  });

  if (!fkError && fks) {
    const tableRelations: Record<string, Set<string>> = {};
    fks.forEach(fk => {
      if (!tableRelations[fk.from_table]) {
        tableRelations[fk.from_table] = new Set();
      }
      tableRelations[fk.from_table].add(fk.to_table);
    });

    console.log('\n📊 Tables with relationships:');
    Object.entries(tableRelations).forEach(([table, related]) => {
      console.log(`  ${table} → ${Array.from(related).join(', ')}`);
    });

    // Find isolated tables (no FKs in or out)
    const tablesWithFks = new Set([...fks.map(fk => fk.from_table), ...fks.map(fk => fk.to_table)]);
    const isolatedTables = tables?.filter(t => !tablesWithFks.has(t.table_name));
    
    if (isolatedTables && isolatedTables.length > 0) {
      console.log(`\n🏝️  Isolated tables (no foreign keys, ${isolatedTables.length}):`);
      isolatedTables.forEach(t => console.log(`  - ${t.table_name}`));
    }
  }

  // Check for empty tables
  console.log('\n\n📪 Checking for empty tables...');
  for (const table of tables || []) {
    const { data: count, error: countError } = await client.rpc('exec_sql', {
      sql: `SELECT COUNT(*) as row_count FROM ${table.table_name};`
    });
    
    if (!countError && count && count[0].row_count === '0') {
      console.log(`  - ${table.table_name} (EMPTY)`);
    }
  }

  console.log('\n✅ Analysis complete!');
}

analyzeDatabase().catch(console.error);
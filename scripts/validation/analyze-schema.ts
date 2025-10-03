#!/usr/bin/env npx tsx
/**
 * @file /scripts/validation/analyze-schema.ts
 * @purpose Analyze database schema for cleanup requirements
 * @constitution MUST run check-actual-db.ts first per Rule 1
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableAnalysis {
  tableName: string;
  hasCompanyId: boolean;
  hasTenantId: boolean;
  rowCount: number;
  hasData: boolean;
  hasRelationships: boolean;
  category: 'active' | 'empty_with_code' | 'orphaned' | 'staging';
}

async function analyzeSchema() {
  console.log('🚨 MANDATORY: Running check-actual-db.ts first (Constitution Rule 1)\n');
  
  // Run check-actual-db.ts first as required by constitution
  try {
    const checkDbPath = path.join(__dirname, '..', 'check-actual-db.ts');
    execSync(`npx tsx "${checkDbPath}"`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..')
    });
    console.log('\n✅ Database precheck completed\n');
  } catch (error) {
    console.error('❌ Failed to run check-actual-db.ts - CANNOT PROCEED');
    console.error('   This is a constitutional requirement!');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseServiceKey);
  console.log('📊 Analyzing schema for cleanup requirements...\n');

  // Get all tables from information_schema
  const { data: tables, error: tablesError } = await client.rpc('exec_sql', {
    sql: `
      SELECT DISTINCT table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT IN ('schema_migrations', 'supabase_functions', '_prisma_migrations')
      ORDER BY table_name
    `
  });

  if (tablesError) {
    console.error('❌ Failed to fetch tables:', tablesError);
    process.exit(1);
  }

  const tableList = tables.map((t: any) => t.table_name);
  console.log(`Found ${tableList.length} tables to analyze\n`);

  const results: TableAnalysis[] = [];
  const needsMigration: string[] = [];
  const orphanedTables: string[] = [];
  const emptyTables: string[] = [];

  for (const tableName of tableList) {
    process.stdout.write(`Analyzing ${tableName}... `);

    // Get column information
    const { data: columns, error: columnsError } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${tableName}'
      `
    });

    if (columnsError) {
      console.error(`\n❌ Error analyzing ${tableName}:`, columnsError);
      continue;
    }

    const columnNames = columns.map((c: any) => c.column_name);
    const hasCompanyId = columnNames.includes('company_id');
    const hasTenantId = columnNames.includes('tenant_id');

    // Get row count
    const { data: countResult, error: countError } = await client.rpc('exec_sql', {
      sql: `SELECT COUNT(*) as count FROM "${tableName}"`
    });

    const rowCount = countError ? 0 : parseInt(countResult[0].count);

    // Check for foreign key relationships
    const { data: relationships, error: relError } = await client.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as count
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = '${tableName}' 
        AND tc.constraint_type = 'FOREIGN KEY'
      `
    });

    const hasRelationships = !relError && parseInt(relationships[0].count) > 0;

    // Categorize table
    let category: TableAnalysis['category'] = 'active';
    if (rowCount === 0 && !hasRelationships) {
      category = 'orphaned';
      orphanedTables.push(tableName);
    } else if (rowCount === 0) {
      category = 'empty_with_code';
      emptyTables.push(tableName);
    }

    // Check if needs migration
    if (hasCompanyId && !hasTenantId) {
      needsMigration.push(tableName);
    }

    const analysis: TableAnalysis = {
      tableName,
      hasCompanyId,
      hasTenantId,
      rowCount,
      hasData: rowCount > 0,
      hasRelationships,
      category
    };

    results.push(analysis);

    // Store in migration tracking table
    const { error: insertError } = await client
      .from('migration_tracking')
      .upsert({
        table_name: tableName,
        has_company_id: hasCompanyId,
        has_tenant_id: hasTenantId,
        row_count: rowCount,
        migration_status: hasCompanyId && !hasTenantId ? 'pending' : 'skipped'
      }, { onConflict: 'table_name' });

    if (insertError) {
      console.error(`\n❌ Failed to track ${tableName}:`, insertError);
    }

    // Store in table inventory
    const { error: inventoryError } = await client
      .from('table_inventory')
      .upsert({
        schema_name: 'public',
        table_name: tableName,
        category,
        row_count: rowCount,
        has_code_references: false, // Will be updated by code analysis
        has_relationships: hasRelationships,
        decision: category === 'orphaned' ? 'pending' : 'keep'
      }, { onConflict: 'schema_name,table_name' });

    if (inventoryError) {
      console.error(`\n❌ Failed to inventory ${tableName}:`, inventoryError);
    }

    console.log('✓');
  }

  // Summary report
  console.log('\n📋 ANALYSIS SUMMARY');
  console.log('===================');
  console.log(`Total tables analyzed: ${results.length}`);
  console.log(`Tables needing tenant_id migration: ${needsMigration.length}`);
  console.log(`Orphaned tables (no data, no relationships): ${orphanedTables.length}`);
  console.log(`Empty tables with code references: ${emptyTables.length}`);

  if (needsMigration.length > 0) {
    console.log('\n🔄 TABLES NEEDING MIGRATION (company_id → tenant_id):');
    for (const table of needsMigration) {
      const analysis = results.find(r => r.tableName === table)!;
      console.log(`   - ${table} (${analysis.rowCount} rows)`);
    }
  }

  if (orphanedTables.length > 0) {
    console.log('\n🗑️  ORPHANED TABLES (candidates for removal):');
    for (const table of orphanedTables.slice(0, 10)) {
      console.log(`   - ${table}`);
    }
    if (orphanedTables.length > 10) {
      console.log(`   ... and ${orphanedTables.length - 10} more`);
    }
  }

  if (emptyTables.length > 0) {
    console.log('\n📦 EMPTY TABLES WITH RELATIONSHIPS (need seeding):');
    for (const table of emptyTables.slice(0, 10)) {
      console.log(`   - ${table}`);
    }
    if (emptyTables.length > 10) {
      console.log(`   ... and ${emptyTables.length - 10} more`);
    }
  }

  console.log('\n✅ Schema analysis complete!');
  console.log('   Results saved to migration_tracking and table_inventory tables');
}

analyzeSchema().catch(console.error);
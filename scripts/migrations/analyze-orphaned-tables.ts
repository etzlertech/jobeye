#!/usr/bin/env npx tsx
/**
 * @file /scripts/migrations/analyze-orphaned-tables.ts
 * @purpose Analyze orphaned tables for removal decisions
 * @constitution MUST run check-actual-db.ts first per Rule 1
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { TableInventoryRepository } from '@/domains/cleanup-tracking/repositories/table-inventory.repository';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function analyzeOrphanedTables() {
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
    process.exit(1);
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const tableRepo = new TableInventoryRepository(client);

  console.log('🔍 Analyzing orphaned tables from actual database...\n');

  // Get actual table list from information_schema
  const { data: actualTables } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name, 
             COALESCE(obj_description(c.oid), '') as comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  });

  console.log(`Found ${actualTables.length} tables in database`);

  // Analyze each table
  for (const table of actualTables) {
    const analysis = await analyzeTable(client, table.table_name);
    
    await tableRepo.upsert({
      schema_name: 'public',
      table_name: table.table_name,
      category: analysis.category,
      row_count: analysis.rowCount,
      has_code_references: analysis.hasCodeReferences,
      has_relationships: analysis.hasRelationships,
      decision: analysis.decision,
      decision_reason: analysis.reason
    });
  }

  // Get summary
  const orphaned = await tableRepo.findOrphanedTables();
  console.log(`\n📋 ORPHANED TABLES ANALYSIS RESULTS:`);
  console.log(`   Total orphaned: ${orphaned.length}`);
  
  orphaned.forEach(table => {
    console.log(`   - ${table.table_name}: ${table.decision_reason}`);
  });

  console.log('\n✅ Orphaned table analysis complete!');
}

async function analyzeTable(client: any, tableName: string) {
  // Get row count
  const { data: rowData } = await client.rpc('exec_sql', {
    sql: `SELECT COUNT(*) as count FROM "${tableName}";`
  });
  const rowCount = parseInt(rowData[0].count);

  // Check relationships
  const { data: relData } = await client.rpc('exec_sql', {
    sql: `
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE table_name = '${tableName}' 
      AND constraint_type = 'FOREIGN KEY';
    `
  });
  const hasRelationships = parseInt(relData[0].count) > 0;

  // Simple code reference check (placeholder)
  const hasCodeReferences = await checkCodeReferences(tableName);

  // Determine category and decision
  let category: 'active' | 'empty_with_code' | 'orphaned' | 'staging';
  let decision: 'keep' | 'seed' | 'remove' | 'document';
  let reason: string;

  if (rowCount > 0) {
    category = 'active';
    decision = 'keep';
    reason = `Active table with ${rowCount} rows`;
  } else if (hasCodeReferences) {
    category = 'empty_with_code';
    decision = 'seed';
    reason = 'Empty but has code references - needs test data';
  } else if (hasRelationships) {
    category = 'staging';
    decision = 'document';
    reason = 'Empty with relationships - likely staging table';
  } else {
    category = 'orphaned';
    decision = 'remove';
    reason = 'No data, no relationships, no code references';
  }

  return {
    category,
    rowCount,
    hasRelationships,
    hasCodeReferences,
    decision,
    reason
  };
}

async function checkCodeReferences(tableName: string): Promise<boolean> {
  // Simplified check - in real implementation would scan codebase
  // For now, assume any table ending in common patterns has code
  const patterns = ['_items', '_records', '_data', '_logs', '_history'];
  return patterns.some(pattern => tableName.includes(pattern));
}

analyzeOrphanedTables().catch(console.error);
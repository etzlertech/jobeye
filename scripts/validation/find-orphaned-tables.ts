#!/usr/bin/env npx tsx
/**
 * @file /scripts/validation/find-orphaned-tables.ts
 * @purpose Find tables with no code references in the codebase
 */

import { createClient } from '@supabase/supabase-js';
import { glob } from 'glob';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TableReference {
  table: string;
  files: Set<string>;
  count: number;
}

async function findOrphanedTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  console.log('🔍 Finding orphaned tables...\n');

  // Get all tables from inventory
  const { data: tables, error } = await client
    .from('table_inventory')
    .select('table_name, category')
    .order('table_name');

  if (error || !tables) {
    console.error('❌ Failed to fetch table inventory:', error);
    process.exit(1);
  }

  console.log(`Checking ${tables.length} tables for code references...\n`);

  // Find all source files
  const sourceFiles = await glob([
    'src/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,tsx,js,jsx}',
    'supabase/migrations/**/*.sql'
  ], {
    ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
    cwd: process.cwd()
  });

  console.log(`Scanning ${sourceFiles.length} source files...\n`);

  // Track table references
  const tableReferences = new Map<string, TableReference>();
  
  // Initialize all tables
  for (const table of tables) {
    tableReferences.set(table.table_name, {
      table: table.table_name,
      files: new Set(),
      count: 0
    });
  }

  // Scan files for table references
  let filesScanned = 0;
  for (const filePath of sourceFiles) {
    filesScanned++;
    if (filesScanned % 100 === 0) {
      process.stdout.write(`\rScanning files: ${filesScanned}/${sourceFiles.length}`);
    }

    const fullPath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Check for table references
    for (const [tableName, ref] of tableReferences) {
      // Various patterns to match table references
      const patterns = [
        new RegExp(`['"\`]${tableName}['"\`]`, 'gi'),           // Quoted table name
        new RegExp(`from\\(["'\`]${tableName}["'\`]\\)`, 'gi'), // Supabase from()
        new RegExp(`\\.${tableName}\\b`, 'gi'),                 // Property access
        new RegExp(`FROM\\s+${tableName}\\b`, 'gi'),            // SQL FROM
        new RegExp(`JOIN\\s+${tableName}\\b`, 'gi'),            // SQL JOIN
        new RegExp(`TABLE\\s+${tableName}\\b`, 'gi'),           // CREATE TABLE
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          ref.files.add(filePath);
          ref.count++;
          break; // Found reference, no need to check other patterns
        }
      }
    }
  }

  console.log('\n\n📊 Analyzing results...\n');

  // Categorize tables
  const orphaned: string[] = [];
  const referenced: string[] = [];
  const possiblyOrphaned: string[] = [];

  for (const [tableName, ref] of tableReferences) {
    if (ref.files.size === 0) {
      orphaned.push(tableName);
    } else if (ref.files.size <= 2) {
      // Only referenced in migration files or very few places
      const onlyInMigrations = Array.from(ref.files).every(f => f.includes('migrations'));
      if (onlyInMigrations) {
        possiblyOrphaned.push(tableName);
      } else {
        referenced.push(tableName);
      }
    } else {
      referenced.push(tableName);
    }
  }

  // Update table inventory with findings
  console.log('💾 Updating table inventory...\n');
  
  for (const tableName of orphaned) {
    await client
      .from('table_inventory')
      .update({ 
        has_code_references: false,
        category: 'orphaned',
        decision: 'remove',
        decision_reason: 'No code references found'
      })
      .eq('table_name', tableName);
  }
  
  for (const tableName of referenced) {
    await client
      .from('table_inventory')
      .update({ 
        has_code_references: true,
        decision: 'keep',
        decision_reason: `Found in ${tableReferences.get(tableName)!.files.size} files`
      })
      .eq('table_name', tableName);
  }
  
  for (const tableName of possiblyOrphaned) {
    await client
      .from('table_inventory')
      .update({ 
        has_code_references: true,
        category: 'staging',
        decision: 'document',
        decision_reason: 'Only found in migration files'
      })
      .eq('table_name', tableName);
  }

  // Print results
  console.log('📋 ORPHANED TABLE ANALYSIS');
  console.log('=========================');
  console.log(`Total tables analyzed: ${tables.length}`);
  console.log(`Orphaned (no references): ${orphaned.length}`);
  console.log(`Possibly orphaned (migrations only): ${possiblyOrphaned.length}`);
  console.log(`Referenced in code: ${referenced.length}`);

  if (orphaned.length > 0) {
    console.log('\n🗑️  ORPHANED TABLES (no code references):');
    for (const table of orphaned.slice(0, 20)) {
      console.log(`   - ${table}`);
    }
    if (orphaned.length > 20) {
      console.log(`   ... and ${orphaned.length - 20} more`);
    }
  }

  if (possiblyOrphaned.length > 0) {
    console.log('\n⚠️  POSSIBLY ORPHANED (only in migrations):');
    for (const table of possiblyOrphaned.slice(0, 10)) {
      console.log(`   - ${table}`);
    }
    if (possiblyOrphaned.length > 10) {
      console.log(`   ... and ${possiblyOrphaned.length - 10} more`);
    }
  }

  // Show some referenced tables with high usage
  const topReferenced = Array.from(tableReferences.entries())
    .filter(([_, ref]) => ref.files.size > 0)
    .sort((a, b) => b[1].files.size - a[1].files.size)
    .slice(0, 10);

  console.log('\n✅ MOST REFERENCED TABLES:');
  for (const [tableName, ref] of topReferenced) {
    console.log(`   - ${tableName} (${ref.files.size} files)`);
  }

  console.log('\n✅ Orphaned table detection complete!');
  console.log('   Results saved to table_inventory');
}

findOrphanedTables().catch(console.error);
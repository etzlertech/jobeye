#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TableInfo {
  name: string;
  schema: string;
  migrationFile: string;
  hasRLS?: boolean;
  columns: string[];
}

async function analyzeMigrations() {
  console.log('📊 Analyzing database from migration files...\n');

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

  const tables = new Map<string, TableInfo>();
  const rlsTables = new Set<string>();

  console.log(`Found ${sqlFiles.length} migration files\n`);

  for (const file of sqlFiles) {
    const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    
    // Extract CREATE TABLE statements
    const createTableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:([\w_]+)\.)?([\w_]+)\s*\(([\s\S]*?)\);/gi;
    let match;
    
    while ((match = createTableRegex.exec(content)) !== null) {
      const schema = match[1] || 'public';
      const tableName = match[2];
      const columnsDef = match[3];
      
      // Extract column names
      const columns: string[] = [];
      const columnRegex = /^\s*(\w+)\s+/gm;
      let colMatch;
      const lines = columnsDef.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('CONSTRAINT') && !trimmed.startsWith('PRIMARY KEY') && !trimmed.startsWith('FOREIGN KEY')) {
          const colName = trimmed.split(/\s+/)[0].replace(',', '');
          if (colName && !colName.match(/^\(/)) {
            columns.push(colName);
          }
        }
      }
      
      const fullTableName = `${schema}.${tableName}`;
      tables.set(fullTableName, {
        name: tableName,
        schema,
        migrationFile: file,
        columns
      });
    }
    
    // Check for RLS enablement
    const rlsRegex = /ALTER TABLE\s+(?:([\w_]+)\.)?([\w_]+)\s+ENABLE ROW LEVEL SECURITY/gi;
    while ((match = rlsRegex.exec(content)) !== null) {
      const schema = match[1] || 'public';
      const tableName = match[2];
      rlsTables.add(`${schema}.${tableName}`);
    }
  }

  // Update RLS status
  for (const [fullName, info] of tables) {
    info.hasRLS = rlsTables.has(fullName);
  }

  console.log(`\n📋 Found ${tables.size} tables across all schemas:\n`);

  // Group by schema
  const bySchema = new Map<string, TableInfo[]>();
  for (const table of tables.values()) {
    if (!bySchema.has(table.schema)) {
      bySchema.set(table.schema, []);
    }
    bySchema.get(table.schema)!.push(table);
  }

  // Display summary
  for (const [schema, schemaTables] of bySchema) {
    console.log(`\n${schema} schema (${schemaTables.length} tables):`);
    console.log('─'.repeat(50));
    
    for (const table of schemaTables.sort((a, b) => a.name.localeCompare(b.name))) {
      const rlsStatus = table.hasRLS ? '✅' : '❌';
      console.log(`  ${rlsStatus} ${table.name} (${table.columns.length} columns)`);
    }
  }

  // Now let's check which tables actually exist in the database
  console.log('\n\n🔍 Checking which tables exist in the database...\n');

  const client = createClient(supabaseUrl, supabaseServiceKey);
  const existingTables: string[] = [];
  const missingTables: string[] = [];

  for (const [fullName, info] of tables) {
    try {
      // Try to query the table
      const { count, error } = await client
        .from(fullName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.message.includes('does not exist')) {
          missingTables.push(fullName);
        } else {
          // Table exists but might have other issues
          existingTables.push(fullName);
        }
      } else {
        existingTables.push(fullName);
      }
    } catch (e) {
      missingTables.push(fullName);
    }
  }

  console.log(`\n✅ Tables that exist in database: ${existingTables.length}`);
  console.log(`❌ Tables defined in migrations but missing: ${missingTables.length}`);
  
  if (missingTables.length > 0) {
    console.log('\nMissing tables:');
    for (const table of missingTables) {
      console.log(`  - ${table}`);
    }
  }

  // Summary
  console.log('\n\n📊 Summary:');
  console.log(`- Total tables in migrations: ${tables.size}`);
  console.log(`- Tables with RLS enabled: ${Array.from(tables.values()).filter(t => t.hasRLS).length}`);
  console.log(`- Tables without RLS: ${Array.from(tables.values()).filter(t => !t.hasRLS).length}`);
  console.log(`- Schemas found: ${Array.from(bySchema.keys()).join(', ')}`);

  return { tables, existingTables, missingTables };
}

analyzeMigrations().catch(console.error);
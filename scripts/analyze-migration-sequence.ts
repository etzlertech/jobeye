#!/usr/bin/env npx tsx
/**
 * Analyze migration sequence for conflicts and duplicates
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

interface Migration {
  file: string;
  number: number;
  tables: string[];
  alters: string[];
  drops: string[];
  functions: string[];
  policies: string[];
}

async function analyzeMigration(filePath: string): Promise<Migration> {
  const content = await readFile(filePath, 'utf-8');
  const fileName = filePath.split('/').pop()!;
  const number = parseInt(fileName.split('_')[0]);

  // Extract different SQL operations
  const tables = [...content.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-zA-Z_]+)/gi)]
    .map(m => m[1]);
  
  const alters = [...content.matchAll(/ALTER TABLE ([a-zA-Z_]+)/gi)]
    .map(m => m[1]);
  
  const drops = [...content.matchAll(/DROP (?:TABLE|POLICY|FUNCTION) (?:IF EXISTS )?([a-zA-Z_]+)/gi)]
    .map(m => m[1]);
  
  const functions = [...content.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-zA-Z_]+)/gi)]
    .map(m => m[1]);
  
  const policies = [...content.matchAll(/CREATE POLICY ([a-zA-Z_]+)/gi)]
    .map(m => m[1]);

  return {
    file: fileName,
    number,
    tables,
    alters,
    drops,
    functions,
    policies
  };
}

async function main() {
  console.log(chalk.bold('🔍 Analyzing Migration Sequence\n'));

  const migrationsDir = 'supabase/migrations';
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql') && !f.includes('archive'))
    .sort();

  const migrations: Migration[] = [];
  
  // Analyze each migration
  for (const file of files) {
    const migration = await analyzeMigration(join(migrationsDir, file));
    migrations.push(migration);
  }

  // Check for issues
  const issues: string[] = [];
  const tableCreations = new Map<string, string[]>();
  const tableAlterations = new Map<string, string[]>();
  const droppedObjects = new Map<string, string[]>();

  // Track all operations
  for (const migration of migrations) {
    // Track table creations
    for (const table of migration.tables) {
      if (!tableCreations.has(table)) {
        tableCreations.set(table, []);
      }
      tableCreations.get(table)!.push(migration.file);
    }

    // Track alterations
    for (const table of migration.alters) {
      if (!tableAlterations.has(table)) {
        tableAlterations.set(table, []);
      }
      tableAlterations.get(table)!.push(migration.file);
    }

    // Track drops
    for (const obj of migration.drops) {
      if (!droppedObjects.has(obj)) {
        droppedObjects.set(obj, []);
      }
      droppedObjects.get(obj)!.push(migration.file);
    }
  }

  // Find issues
  console.log(chalk.yellow('⚠️  Potential Issues:\n'));

  // Duplicate table creations
  for (const [table, files] of tableCreations) {
    if (files.length > 1) {
      issues.push(`Table '${table}' created in multiple migrations: ${files.join(', ')}`);
      console.log(chalk.red(`  ❌ Duplicate creation: ${table}`));
      files.forEach(f => console.log(`     - ${f}`));
    }
  }

  // Tables altered before creation
  for (const [table, alterFiles] of tableAlterations) {
    const creationFiles = tableCreations.get(table) || [];
    if (creationFiles.length === 0) {
      issues.push(`Table '${table}' altered but never created`);
      console.log(chalk.red(`  ❌ Altered without creation: ${table}`));
      alterFiles.forEach(f => console.log(`     - ${f}`));
    } else {
      const creationNumber = parseInt(creationFiles[0].split('_')[0]);
      for (const alterFile of alterFiles) {
        const alterNumber = parseInt(alterFile.split('_')[0]);
        if (alterNumber < creationNumber) {
          issues.push(`Table '${table}' altered before creation`);
          console.log(chalk.red(`  ❌ Premature alteration: ${table}`));
          console.log(`     - Created in: ${creationFiles[0]}`);
          console.log(`     - Altered in: ${alterFile}`);
        }
      }
    }
  }

  // Summary
  console.log(chalk.bold('\n📊 Summary:\n'));
  console.log(`  Total migrations: ${migrations.length}`);
  console.log(`  Tables created: ${tableCreations.size}`);
  console.log(`  Tables altered: ${tableAlterations.size}`);
  console.log(`  Objects dropped: ${droppedObjects.size}`);
  console.log(`  Issues found: ${issues.length}`);

  // Recommendations
  if (issues.length > 0) {
    console.log(chalk.yellow('\n💡 Recommendations:\n'));
    console.log('  1. Move duplicate table creations to archive/');
    console.log('  2. Ensure ALTER TABLE statements come after CREATE TABLE');
    console.log('  3. Use IF NOT EXISTS for all CREATE TABLE statements');
    console.log('  4. Consider consolidating related alterations');
  }

  // List tables by domain
  console.log(chalk.bold('\n🏗️  Tables by Domain:\n'));
  const domains = {
    vision: [] as string[],
    inventory: [] as string[],
    voice: [] as string[],
    jobs: [] as string[],
    customers: [] as string[],
    equipment: [] as string[],
    other: [] as string[]
  };

  for (const table of tableCreations.keys()) {
    if (table.includes('vision')) domains.vision.push(table);
    else if (table.includes('inventory') || table === 'items' || table === 'item_transactions') domains.inventory.push(table);
    else if (table.includes('voice') || table.includes('transcript')) domains.voice.push(table);
    else if (table.includes('job')) domains.jobs.push(table);
    else if (table.includes('customer')) domains.customers.push(table);
    else if (table.includes('equipment') || table.includes('container')) domains.equipment.push(table);
    else domains.other.push(table);
  }

  for (const [domain, tables] of Object.entries(domains)) {
    if (tables.length > 0) {
      console.log(`  ${domain}: ${tables.length} tables`);
      tables.forEach(t => console.log(`    - ${t}`));
    }
  }
}

main().catch(console.error);
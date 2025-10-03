#!/usr/bin/env npx tsx
/**
 * Query live database for all tables and analyze their usage in codebase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing environment variables'));
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TableInfo {
  table_name: string;
  table_schema: string;
  row_count?: number;
}

interface TableUsage {
  table: string;
  usageCount: number;
  locations: {
    file: string;
    type: 'query' | 'migration' | 'repository' | 'type' | 'service';
    context: string;
  }[];
}

async function getAllTables(): Promise<TableInfo[]> {
  console.log(chalk.blue('🔍 Querying live database for tables...\n'));
  
  // Query information_schema for all tables
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        table_schema,
        table_name
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'vault', 'pgsodium', 'pgsodium_masks', 'graphql', 'graphql_public', 'realtime', 'supabase_functions', 'extensions', 'net', 'cron', 'pg_net', 'pg_stat_statements', 'pgsodium')
      ORDER BY table_schema, table_name
    `
  });

  if (error) {
    console.error(chalk.red('❌ Error querying tables:'), error);
    return [];
  }

  return data || [];
}

async function getTableRowCounts(tables: TableInfo[]): Promise<Map<string, number>> {
  console.log(chalk.blue('📊 Getting row counts...\n'));
  
  const counts = new Map<string, number>();
  
  for (const table of tables) {
    try {
      const { count } = await supabase
        .from(table.table_name)
        .select('*', { count: 'exact', head: true });
      
      counts.set(table.table_name, count || 0);
    } catch (err) {
      counts.set(table.table_name, -1); // -1 indicates error
    }
  }
  
  return counts;
}

async function findTableUsageInCode(tableName: string): Promise<TableUsage> {
  const usage: TableUsage = {
    table: tableName,
    usageCount: 0,
    locations: []
  };
  
  const directories = [
    'src',
    'supabase/migrations',
    'scripts'
  ];
  
  for (const dir of directories) {
    await searchDirectory(dir, tableName, usage);
  }
  
  return usage;
}

async function searchDirectory(dir: string, tableName: string, usage: TableUsage) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        await searchDirectory(fullPath, tableName, usage);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.sql'))) {
        const content = await readFile(fullPath, 'utf-8');
        
        // Different patterns to search for
        const patterns = [
          // Direct table references
          new RegExp(`from\\(['"\`]${tableName}['"\`]`, 'gi'),
          new RegExp(`\\.from\\(['"\`]${tableName}['"\`]`, 'gi'),
          
          // SQL queries
          new RegExp(`FROM\\s+${tableName}(?:\\s|;|$)`, 'gi'),
          new RegExp(`JOIN\\s+${tableName}(?:\\s|;|$)`, 'gi'),
          new RegExp(`INTO\\s+${tableName}(?:\\s|;|$)`, 'gi'),
          new RegExp(`UPDATE\\s+${tableName}(?:\\s|;|$)`, 'gi'),
          new RegExp(`CREATE TABLE(?:\\s+IF NOT EXISTS)?\\s+${tableName}`, 'gi'),
          new RegExp(`ALTER TABLE\\s+${tableName}`, 'gi'),
          new RegExp(`DROP TABLE(?:\\s+IF EXISTS)?\\s+${tableName}`, 'gi'),
          
          // Type definitions
          new RegExp(`type\\s+${tableName}\\s*=`, 'gi'),
          new RegExp(`interface\\s+${tableName}\\s*{`, 'gi'),
          
          // Repository patterns
          new RegExp(`new\\s+.*Repository.*\\(['"\`]${tableName}['"\`]`, 'gi'),
          new RegExp(`super\\(['"\`]${tableName}['"\`]`, 'gi')
        ];
        
        for (const pattern of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            usage.usageCount += matches.length;
            
            // Determine type based on file location and pattern
            let type: 'query' | 'migration' | 'repository' | 'type' | 'service' = 'query';
            if (fullPath.includes('/migrations/')) type = 'migration';
            else if (fullPath.includes('/repositories/')) type = 'repository';
            else if (fullPath.includes('/types/')) type = 'type';
            else if (fullPath.includes('/services/')) type = 'service';
            
            // Get context (the line containing the match)
            const lines = content.split('\n');
            const matchingLines = lines.filter(line => pattern.test(line));
            
            usage.locations.push({
              file: fullPath,
              type,
              context: matchingLines[0]?.trim() || matches[0]
            });
          }
        }
      }
    }
  } catch (err) {
    // Ignore errors for missing directories
  }
}

async function main() {
  console.log(chalk.bold('🔍 Live Database Table Analysis\n'));
  
  // Get all tables
  const tables = await getAllTables();
  console.log(chalk.green(`Found ${tables.length} tables in live database\n`));
  
  // Get row counts
  const rowCounts = await getTableRowCounts(tables);
  
  // Analyze usage for each table
  console.log(chalk.blue('🔍 Analyzing codebase usage...\n'));
  
  const tableUsages: TableUsage[] = [];
  for (const table of tables) {
    const usage = await findTableUsageInCode(table.table_name);
    tableUsages.push(usage);
  }
  
  // Sort by usage count
  tableUsages.sort((a, b) => b.usageCount - a.usageCount);
  
  // Print results
  console.log(chalk.bold('\n📊 Table Usage Report\n'));
  console.log(chalk.gray('=' .repeat(80)));
  
  // Summary stats
  const usedTables = tableUsages.filter(t => t.usageCount > 0);
  const unusedTables = tableUsages.filter(t => t.usageCount === 0);
  
  console.log(chalk.bold('\n📈 Summary:'));
  console.log(`  Total tables: ${tables.length}`);
  console.log(`  Used tables: ${usedTables.length}`);
  console.log(`  Unused tables: ${unusedTables.length}`);
  console.log(`  Total rows across all tables: ${Array.from(rowCounts.values()).reduce((sum, count) => sum + (count > 0 ? count : 0), 0)}`);
  
  // Heavily used tables
  console.log(chalk.bold('\n🔥 Most Used Tables:'));
  usedTables.slice(0, 10).forEach(usage => {
    const rowCount = rowCounts.get(usage.table) || 0;
    console.log(`  ${chalk.green(usage.table.padEnd(30))} - ${usage.usageCount} references, ${rowCount} rows`);
    
    // Show top 3 usage locations
    usage.locations.slice(0, 3).forEach(loc => {
      console.log(chalk.gray(`    ${loc.type.padEnd(10)} ${loc.file.replace(/^.*\/jobeye\//, '')}`));
    });
  });
  
  // Unused tables (potential cleanup candidates)
  if (unusedTables.length > 0) {
    console.log(chalk.bold('\n⚠️  Unused Tables (cleanup candidates):'));
    unusedTables.forEach(usage => {
      const rowCount = rowCounts.get(usage.table) || 0;
      console.log(`  ${chalk.yellow(usage.table.padEnd(30))} - ${rowCount} rows`);
    });
  }
  
  // Tables with data but low usage
  console.log(chalk.bold('\n📦 Tables with Data but Low Usage:'));
  tableUsages
    .filter(usage => {
      const rowCount = rowCounts.get(usage.table) || 0;
      return rowCount > 0 && usage.usageCount < 5;
    })
    .forEach(usage => {
      const rowCount = rowCounts.get(usage.table) || 0;
      console.log(`  ${chalk.yellow(usage.table.padEnd(30))} - ${usage.usageCount} references, ${rowCount} rows`);
    });
  
  // Export detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTables: tables.length,
      usedTables: usedTables.length,
      unusedTables: unusedTables.length,
      totalRows: Array.from(rowCounts.values()).reduce((sum, count) => sum + (count > 0 ? count : 0), 0)
    },
    tables: tableUsages.map(usage => ({
      name: usage.table,
      rowCount: rowCounts.get(usage.table) || 0,
      usageCount: usage.usageCount,
      locations: usage.locations
    }))
  };
  
  // Save report
  await writeFile(
    'table-usage-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log(chalk.bold('\n📄 Detailed report saved to: table-usage-report.json'));
}

main().catch(console.error);
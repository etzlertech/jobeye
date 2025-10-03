#!/usr/bin/env npx tsx
/**
 * Comprehensive analysis of how each live database table is used in the codebase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Tables found in live database with row counts
const liveTables = [
  { name: 'ai_cost_tracking', rows: 0 },
  { name: 'ai_interaction_logs', rows: 0 },
  { name: 'background_filter_preferences', rows: 0 },
  { name: 'code_pattern_violations', rows: 277 },
  { name: 'companies', rows: 5 },
  { name: 'container_assignments', rows: 0 },
  { name: 'containers', rows: 0 },
  { name: 'conversation_sessions', rows: 0 },
  { name: 'customers', rows: 91 },
  { name: 'detection_confidence_thresholds', rows: 0 },
  { name: 'equipment', rows: 0 },
  { name: 'intent_classifications', rows: 0 },
  { name: 'intent_recognitions', rows: 0 },
  { name: 'inventory_images', rows: 1 },
  { name: 'inventory_items', rows: 0 },
  { name: 'inventory_transactions', rows: 0 },
  { name: 'irrigation_runs', rows: 0 },
  { name: 'irrigation_schedules', rows: 0 },
  { name: 'irrigation_systems', rows: 0 },
  { name: 'irrigation_zones', rows: 0 },
  { name: 'item_relationships', rows: 0 },
  { name: 'item_transactions', rows: 0 },
  { name: 'items', rows: 0 },
  { name: 'job_checklist_items', rows: 0 },
  { name: 'job_templates', rows: 0 },
  { name: 'jobs', rows: 50 },
  { name: 'load_verifications', rows: 0 },
  { name: 'materials', rows: 0 },
  { name: 'media_assets', rows: 0 },
  { name: 'migration_tracking', rows: 0 },
  { name: 'offline_sync_queue', rows: 0 },
  { name: 'properties', rows: 35 },
  { name: 'purchase_receipts', rows: 0 },
  { name: 'repository_inventory', rows: 28 },
  { name: 'request_deduplication', rows: 0 },
  { name: 'route_stops', rows: 0 },
  { name: 'routes', rows: 0 },
  { name: 'service_history', rows: 0 },
  { name: 'table_inventory', rows: 0 },
  { name: 'time_entries', rows: 0 },
  { name: 'training_data_records', rows: 0 },
  { name: 'users', rows: 0 },
  { name: 'vision_confidence_config', rows: 0 },
  { name: 'vision_cost_records', rows: 0 },
  { name: 'vision_detected_items', rows: 0 },
  { name: 'vision_training_annotations', rows: 0 },
  { name: 'vision_verifications', rows: 0 },
  { name: 'voice_sessions', rows: 0 },
  { name: 'voice_transcripts', rows: 0 }
];

interface TableUsage {
  table: string;
  rowCount: number;
  usages: {
    repositories: string[];
    services: string[];
    apiRoutes: string[];
    migrations: string[];
    types: string[];
    tests: string[];
    other: string[];
  };
  totalUsageCount: number;
  hasRepository: boolean;
  hasService: boolean;
  hasApiRoute: boolean;
  hasMigration: boolean;
}

async function analyzeTableUsage(tableName: string): Promise<TableUsage> {
  const usage: TableUsage = {
    table: tableName,
    rowCount: liveTables.find(t => t.name === tableName)?.rows || 0,
    usages: {
      repositories: [],
      services: [],
      apiRoutes: [],
      migrations: [],
      types: [],
      tests: [],
      other: []
    },
    totalUsageCount: 0,
    hasRepository: false,
    hasService: false,
    hasApiRoute: false,
    hasMigration: false
  };

  const searchPaths = [
    { path: 'src/domains', recursive: true },
    { path: 'src/app/api', recursive: true },
    { path: 'supabase/migrations', recursive: false },
    { path: 'src/lib', recursive: true },
    { path: 'src/core', recursive: true },
    { path: 'scripts', recursive: true }
  ];

  for (const searchPath of searchPaths) {
    if (existsSync(searchPath.path)) {
      await searchInPath(searchPath.path, tableName, usage, searchPath.recursive);
    }
  }

  // Calculate totals and flags
  usage.totalUsageCount = 
    usage.usages.repositories.length +
    usage.usages.services.length +
    usage.usages.apiRoutes.length +
    usage.usages.migrations.length +
    usage.usages.types.length +
    usage.usages.tests.length +
    usage.usages.other.length;

  usage.hasRepository = usage.usages.repositories.length > 0;
  usage.hasService = usage.usages.services.length > 0;
  usage.hasApiRoute = usage.usages.apiRoutes.length > 0;
  usage.hasMigration = usage.usages.migrations.length > 0;

  return usage;
}

async function searchInPath(dir: string, tableName: string, usage: TableUsage, recursive: boolean) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && recursive && !entry.name.includes('node_modules') && !entry.name.startsWith('.')) {
        await searchInPath(fullPath, tableName, usage, recursive);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.sql'))) {
        await searchFile(fullPath, tableName, usage);
      }
    }
  } catch (err) {
    // Ignore permission errors
  }
}

async function searchFile(filePath: string, tableName: string, usage: TableUsage) {
  const content = await readFile(filePath, 'utf-8');
  
  // Various patterns to detect table usage
  const patterns = [
    // Supabase queries
    new RegExp(`from\\(['"\`]${tableName}['"\`]`, 'g'),
    new RegExp(`\\.from\\(['"\`]${tableName}['"\`]`, 'g'),
    
    // SQL
    new RegExp(`\\bFROM\\s+${tableName}\\b`, 'gi'),
    new RegExp(`\\bJOIN\\s+${tableName}\\b`, 'gi'),
    new RegExp(`\\bINTO\\s+${tableName}\\b`, 'gi'),
    new RegExp(`\\bUPDATE\\s+${tableName}\\b`, 'gi'),
    new RegExp(`\\bDELETE\\s+FROM\\s+${tableName}\\b`, 'gi'),
    new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}\\b`, 'gi'),
    new RegExp(`\\bALTER\\s+TABLE\\s+${tableName}\\b`, 'gi'),
    new RegExp(`\\bDROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${tableName}\\b`, 'gi'),
    new RegExp(`\\bREFERENCES\\s+${tableName}\\b`, 'gi'),
    
    // Type definitions
    new RegExp(`type\\s+${tableName}\\s*=`, 'g'),
    new RegExp(`interface\\s+${tableName}\\s*{`, 'g'),
    new RegExp(`interface\\s+${tableName}Create\\s*{`, 'g'),
    new RegExp(`interface\\s+${tableName}Update\\s*{`, 'g'),
    
    // Repository patterns
    new RegExp(`super\\(['"\`]${tableName}['"\`]`, 'g'),
    new RegExp(`Repository.*${tableName}`, 'gi'),
    new RegExp(`${tableName}.*Repository`, 'gi')
  ];

  let found = false;
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      found = true;
      break;
    }
  }

  if (!found) return;

  // Categorize the file
  const relativePath = filePath.replace(/^.*\/jobeye\//, '');
  
  if (filePath.includes('/repositories/')) {
    if (!usage.usages.repositories.includes(relativePath)) {
      usage.usages.repositories.push(relativePath);
    }
  } else if (filePath.includes('/services/')) {
    if (!usage.usages.services.includes(relativePath)) {
      usage.usages.services.push(relativePath);
    }
  } else if (filePath.includes('/api/')) {
    if (!usage.usages.apiRoutes.includes(relativePath)) {
      usage.usages.apiRoutes.push(relativePath);
    }
  } else if (filePath.includes('/migrations/')) {
    if (!usage.usages.migrations.includes(relativePath)) {
      usage.usages.migrations.push(relativePath);
    }
  } else if (filePath.includes('/types/') || filePath.includes('types.ts') || filePath.includes('-types.ts')) {
    if (!usage.usages.types.includes(relativePath)) {
      usage.usages.types.push(relativePath);
    }
  } else if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
    if (!usage.usages.tests.includes(relativePath)) {
      usage.usages.tests.push(relativePath);
    }
  } else {
    if (!usage.usages.other.includes(relativePath)) {
      usage.usages.other.push(relativePath);
    }
  }
}

async function main() {
  console.log(chalk.bold('🔍 Comprehensive Table Usage Analysis\n'));

  const tableUsages: TableUsage[] = [];

  // Analyze each table
  for (const table of liveTables) {
    process.stdout.write(chalk.blue(`Analyzing ${table.name}...`));
    const usage = await analyzeTableUsage(table.name);
    tableUsages.push(usage);
    console.log(chalk.green(' ✓'));
  }

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTables: liveTables.length,
      tablesWithData: liveTables.filter(t => t.rows > 0).length,
      totalRows: liveTables.reduce((sum, t) => sum + t.rows, 0),
      usedTables: tableUsages.filter(t => t.totalUsageCount > 0).length,
      unusedTables: tableUsages.filter(t => t.totalUsageCount === 0).length,
      tablesWithRepositories: tableUsages.filter(t => t.hasRepository).length,
      tablesWithServices: tableUsages.filter(t => t.hasService).length,
      tablesWithApiRoutes: tableUsages.filter(t => t.hasApiRoute).length
    },
    categories: {
      fullyImplemented: tableUsages.filter(t => t.hasRepository && t.hasService && t.hasApiRoute),
      partiallyImplemented: tableUsages.filter(t => t.totalUsageCount > 0 && !(t.hasRepository && t.hasService && t.hasApiRoute)),
      migrationOnly: tableUsages.filter(t => t.hasMigration && t.totalUsageCount === 1),
      unused: tableUsages.filter(t => t.totalUsageCount === 0),
      dataNoCode: tableUsages.filter(t => t.rowCount > 0 && t.totalUsageCount === 0),
      codeNoData: tableUsages.filter(t => t.rowCount === 0 && t.totalUsageCount > 0)
    },
    tables: tableUsages
  };

  // Console output
  console.log(chalk.bold('\n📊 Analysis Summary:\n'));
  console.log(`Total Tables: ${report.summary.totalTables}`);
  console.log(`Tables with Data: ${report.summary.tablesWithData}`);
  console.log(`Used in Code: ${report.summary.usedTables}`);
  console.log(`Unused: ${report.summary.unusedTables}`);

  console.log(chalk.bold('\n✅ Fully Implemented Tables:'));
  report.categories.fullyImplemented.forEach(t => {
    console.log(`  ${chalk.green(t.table)} - ${t.rowCount} rows`);
  });

  console.log(chalk.bold('\n⚠️  Partially Implemented Tables:'));
  report.categories.partiallyImplemented.forEach(t => {
    console.log(`  ${chalk.yellow(t.table)} - ${t.rowCount} rows`);
    if (!t.hasRepository) console.log(chalk.red('    Missing: Repository'));
    if (!t.hasService) console.log(chalk.red('    Missing: Service'));
    if (!t.hasApiRoute) console.log(chalk.red('    Missing: API Route'));
  });

  console.log(chalk.bold('\n❌ Unused Tables (cleanup candidates):'));
  report.categories.unused.forEach(t => {
    console.log(`  ${chalk.red(t.table)} - ${t.rowCount} rows`);
  });

  console.log(chalk.bold('\n📦 Tables with Data but No Code:'));
  report.categories.dataNoCode.forEach(t => {
    console.log(`  ${chalk.yellow(t.table)} - ${t.rowCount} rows`);
  });

  // Save detailed report
  await writeFile(
    'table-usage-comprehensive.json',
    JSON.stringify(report, null, 2)
  );

  // Save markdown report
  const markdown = generateMarkdownReport(report);
  await writeFile('table-usage-report.md', markdown);

  console.log(chalk.bold('\n📄 Reports saved:'));
  console.log('  - table-usage-comprehensive.json');
  console.log('  - table-usage-report.md');
}

function generateMarkdownReport(report: any): string {
  let md = `# Database Table Usage Report\n\n`;
  md += `Generated: ${report.timestamp}\n\n`;
  
  md += `## Summary\n\n`;
  md += `- **Total Tables**: ${report.summary.totalTables}\n`;
  md += `- **Tables with Data**: ${report.summary.tablesWithData}\n`;
  md += `- **Total Rows**: ${report.summary.totalRows}\n`;
  md += `- **Used in Code**: ${report.summary.usedTables}\n`;
  md += `- **Unused**: ${report.summary.unusedTables}\n\n`;

  md += `## Table Categories\n\n`;
  
  md += `### ✅ Fully Implemented (${report.categories.fullyImplemented.length})\n\n`;
  md += `Tables with repository, service, and API routes:\n\n`;
  report.categories.fullyImplemented.forEach((t: TableUsage) => {
    md += `- **${t.table}** (${t.rowCount} rows)\n`;
  });

  md += `\n### ⚠️ Partially Implemented (${report.categories.partiallyImplemented.length})\n\n`;
  report.categories.partiallyImplemented.forEach((t: TableUsage) => {
    md += `- **${t.table}** (${t.rowCount} rows)\n`;
    if (t.hasRepository) md += `  - ✅ Repository\n`;
    else md += `  - ❌ Repository\n`;
    if (t.hasService) md += `  - ✅ Service\n`;
    else md += `  - ❌ Service\n`;
    if (t.hasApiRoute) md += `  - ✅ API Route\n`;
    else md += `  - ❌ API Route\n`;
  });

  md += `\n### 🗑️ Unused Tables (${report.categories.unused.length})\n\n`;
  md += `Consider removing these tables:\n\n`;
  report.categories.unused.forEach((t: TableUsage) => {
    md += `- **${t.table}** (${t.rowCount} rows)\n`;
  });

  md += `\n### 📊 Tables with Data but No Code (${report.categories.dataNoCode.length})\n\n`;
  md += `These tables contain data but aren't referenced in code:\n\n`;
  report.categories.dataNoCode.forEach((t: TableUsage) => {
    md += `- **${t.table}** (${t.rowCount} rows)\n`;
  });

  md += `\n## Detailed Usage\n\n`;
  report.tables
    .filter((t: TableUsage) => t.totalUsageCount > 0)
    .sort((a: TableUsage, b: TableUsage) => b.totalUsageCount - a.totalUsageCount)
    .forEach((t: TableUsage) => {
      md += `### ${t.table}\n\n`;
      md += `- **Row Count**: ${t.rowCount}\n`;
      md += `- **Total References**: ${t.totalUsageCount}\n\n`;
      
      if (t.usages.repositories.length > 0) {
        md += `**Repositories**:\n`;
        t.usages.repositories.forEach(r => md += `- ${r}\n`);
        md += '\n';
      }
      
      if (t.usages.services.length > 0) {
        md += `**Services**:\n`;
        t.usages.services.forEach(s => md += `- ${s}\n`);
        md += '\n';
      }
      
      if (t.usages.apiRoutes.length > 0) {
        md += `**API Routes**:\n`;
        t.usages.apiRoutes.forEach(a => md += `- ${a}\n`);
        md += '\n';
      }
    });

  return md;
}

main().catch(console.error);
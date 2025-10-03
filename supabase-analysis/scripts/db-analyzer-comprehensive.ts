#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

interface TableInfo {
  table_name: string;
  row_count: number;
  total_size: string;
  has_indexes: boolean;
  has_primary_key: boolean;
  has_foreign_keys: boolean;
  has_policies: boolean;
  has_triggers: boolean;
  rls_enabled: boolean;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length: number | null;
  is_primary_key: boolean;
  foreign_table: string | null;
  foreign_column: string | null;
}

interface IndexInfo {
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
  index_size: string;
}

interface PolicyInfo {
  policy_name: string;
  command: string;
  permissive: boolean;
  roles: string[];
  using_expression: string | null;
  check_expression: string | null;
}

interface ComprehensiveTableDetails {
  info: TableInfo;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  policies: PolicyInfo[];
}

class ComprehensiveDatabaseAnalyzer {
  private client = createClient(supabaseUrl, supabaseServiceKey);
  private tables: ComprehensiveTableDetails[] = [];

  async analyze() {
    console.log('🔍 Starting comprehensive database analysis...\n');

    // First check if our info functions exist
    const functionsExist = await this.checkInfoFunctions();
    if (!functionsExist) {
      console.error('❌ Required info functions not found. Please run:');
      console.error('   npx tsx scripts/create-db-info-functions.ts');
      process.exit(1);
    }

    // Get table information
    const tableInfos = await this.getTableInfos();
    console.log(`✅ Found ${tableInfos.length} tables\n`);

    // For each table, get detailed information
    for (const tableInfo of tableInfos) {
      console.log(`📊 Analyzing table: ${tableInfo.table_name}`);
      
      const columns = await this.getColumnInfo(tableInfo.table_name);
      const indexes = await this.getIndexInfo(tableInfo.table_name);
      const policies = await this.getPolicyInfo(tableInfo.table_name);

      this.tables.push({
        info: tableInfo,
        columns,
        indexes,
        policies
      });

      console.log(`   - ${columns.length} columns`);
      console.log(`   - ${indexes.length} indexes`);
      console.log(`   - ${policies.length} policies`);
    }

    // Generate comprehensive reports
    await this.generateReports();
  }

  private async checkInfoFunctions(): Promise<boolean> {
    try {
      // Try to call one of our functions
      const { error } = await this.client.rpc('get_table_info');
      return !error;
    } catch (e) {
      return false;
    }
  }

  private async getTableInfos(): Promise<TableInfo[]> {
    const { data, error } = await this.client.rpc('get_table_info');
    
    if (error) {
      throw new Error(`Failed to get table info: ${error.message}`);
    }

    return data || [];
  }

  private async getColumnInfo(tableName: string): Promise<ColumnInfo[]> {
    const { data, error } = await this.client.rpc('get_column_info', {
      p_table_name: tableName
    });
    
    if (error) {
      console.error(`  ⚠️  Failed to get columns for ${tableName}: ${error.message}`);
      return [];
    }

    return data || [];
  }

  private async getIndexInfo(tableName: string): Promise<IndexInfo[]> {
    const { data, error } = await this.client.rpc('get_index_info', {
      p_table_name: tableName
    });
    
    if (error) {
      console.error(`  ⚠️  Failed to get indexes for ${tableName}: ${error.message}`);
      return [];
    }

    return data || [];
  }

  private async getPolicyInfo(tableName: string): Promise<PolicyInfo[]> {
    const { data, error } = await this.client.rpc('get_policy_info', {
      p_table_name: tableName
    });
    
    if (error) {
      console.error(`  ⚠️  Failed to get policies for ${tableName}: ${error.message}`);
      return [];
    }

    return data || [];
  }

  private async generateReports() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.join(process.cwd(), 'supabase-analysis', 'reports', 'comprehensive', timestamp);
    
    await fs.mkdir(reportDir, { recursive: true });

    // Generate comprehensive markdown report
    const markdownReport = this.generateMarkdownReport();
    await fs.writeFile(path.join(reportDir, 'comprehensive-analysis.md'), markdownReport);

    // Generate detailed YAML data dump
    const yamlData = yaml.stringify({
      analyzed_at: new Date().toISOString(),
      database_url: supabaseUrl,
      total_tables: this.tables.length,
      total_rows: this.tables.reduce((sum, t) => sum + t.info.row_count, 0),
      tables: this.tables
    });
    await fs.writeFile(path.join(reportDir, 'comprehensive-data.yaml'), yamlData);

    // Generate complete SQL schema
    const sqlSchema = this.generateSQLSchema();
    await fs.writeFile(path.join(reportDir, 'complete-schema.sql'), sqlSchema);

    // Generate migration recommendations
    const migrations = this.generateMigrationRecommendations();
    await fs.writeFile(path.join(reportDir, 'migration-recommendations.sql'), migrations);

    // Create latest symlink
    const latestDir = path.join(process.cwd(), 'supabase-analysis', 'reports', 'comprehensive', 'latest');
    try {
      await fs.unlink(latestDir);
    } catch (e) {}
    await fs.symlink(reportDir, latestDir);

    console.log(`\n✅ Comprehensive reports generated in: ${reportDir}`);
    console.log(`   - comprehensive-analysis.md: Full markdown report with all details`);
    console.log(`   - comprehensive-data.yaml: Complete structured data`);
    console.log(`   - complete-schema.sql: Full SQL schema definitions`);
    console.log(`   - migration-recommendations.sql: Recommended schema improvements`);
    console.log(`\n📁 Also available at: ${latestDir}`);
  }

  private generateMarkdownReport(): string {
    const report: string[] = [];
    
    report.push('# Comprehensive Database Analysis Report');
    report.push(`\nGenerated: ${new Date().toISOString()}`);
    report.push(`Database: ${supabaseUrl}`);
    
    // Summary section
    report.push(`\n## Executive Summary`);
    report.push(`\n### Key Metrics`);
    report.push(`- **Total Tables**: ${this.tables.length}`);
    report.push(`- **Total Rows**: ${this.tables.reduce((sum, t) => sum + t.info.row_count, 0).toLocaleString()}`);
    report.push(`- **Total Size**: ${this.calculateTotalSize()}`);
    
    const tablesWithRLS = this.tables.filter(t => t.info.rls_enabled).length;
    const tablesWithPK = this.tables.filter(t => t.info.has_primary_key).length;
    const tablesWithFK = this.tables.filter(t => t.info.has_foreign_keys).length;
    const tablesWithIndexes = this.tables.filter(t => t.info.has_indexes).length;
    const tablesWithPolicies = this.tables.filter(t => t.info.has_policies).length;
    
    report.push(`\n### Security & Performance Overview`);
    report.push(`- **Tables with RLS**: ${tablesWithRLS}/${this.tables.length} (${Math.round(tablesWithRLS/this.tables.length*100)}%)`);
    report.push(`- **Tables with Primary Keys**: ${tablesWithPK}/${this.tables.length} (${Math.round(tablesWithPK/this.tables.length*100)}%)`);
    report.push(`- **Tables with Foreign Keys**: ${tablesWithFK}/${this.tables.length}`);
    report.push(`- **Tables with Indexes**: ${tablesWithIndexes}/${this.tables.length}`);
    report.push(`- **Tables with RLS Policies**: ${tablesWithPolicies}/${this.tables.length}`);
    
    // Detailed table analysis
    report.push('\n## Detailed Table Analysis\n');
    
    const sortedTables = [...this.tables].sort((a, b) => b.info.row_count - a.info.row_count);
    
    for (const table of sortedTables) {
      report.push(`### 📋 ${table.info.table_name}`);
      report.push('');
      report.push('#### Overview');
      report.push(`- **Row Count**: ${table.info.row_count.toLocaleString()}`);
      report.push(`- **Total Size**: ${table.info.total_size}`);
      report.push(`- **RLS Enabled**: ${table.info.rls_enabled ? '✅ Yes' : '❌ No'}`);
      report.push(`- **Has Primary Key**: ${table.info.has_primary_key ? '✅ Yes' : '❌ No'}`);
      report.push(`- **Has Foreign Keys**: ${table.info.has_foreign_keys ? '✅ Yes' : '❌ No'}`);
      report.push(`- **Has Indexes**: ${table.info.has_indexes ? '✅ Yes' : '❌ No'}`);
      report.push(`- **Has RLS Policies**: ${table.info.has_policies ? '✅ Yes' : '❌ No'}`);
      report.push(`- **Has Triggers**: ${table.info.has_triggers ? '✅ Yes' : '❌ No'}`);
      
      if (table.columns.length > 0) {
        report.push('\n#### Columns');
        report.push('| Column | Type | Nullable | Default | PK | FK Reference |');
        report.push('|--------|------|----------|---------|----|--------------| ');
        
        for (const col of table.columns) {
          const fkRef = col.foreign_table ? `${col.foreign_table}.${col.foreign_column}` : '-';
          report.push(`| ${col.column_name} | ${col.data_type} | ${col.is_nullable ? 'Yes' : 'No'} | ${col.column_default || '-'} | ${col.is_primary_key ? '🔑' : '-'} | ${fkRef} |`);
        }
      }
      
      if (table.indexes.length > 0) {
        report.push('\n#### Indexes');
        report.push('| Index Name | Type | Columns | Size |');
        report.push('|------------|------|---------|------|');
        
        for (const idx of table.indexes) {
          const type = idx.is_primary ? 'PRIMARY' : (idx.is_unique ? 'UNIQUE' : 'BTREE');
          report.push(`| ${idx.index_name} | ${type} | ${idx.columns.join(', ')} | ${idx.index_size} |`);
        }
      }
      
      if (table.policies.length > 0) {
        report.push('\n#### RLS Policies');
        report.push('| Policy | Command | Roles | Type |');
        report.push('|--------|---------|-------|------|');
        
        for (const pol of table.policies) {
          const type = pol.permissive ? 'PERMISSIVE' : 'RESTRICTIVE';
          report.push(`| ${pol.policy_name} | ${pol.command} | ${pol.roles.join(', ') || 'PUBLIC'} | ${type} |`);
          
          if (pol.using_expression) {
            report.push(`| | USING: \`${pol.using_expression}\` | | |`);
          }
          if (pol.check_expression) {
            report.push(`| | CHECK: \`${pol.check_expression}\` | | |`);
          }
        }
      }
      
      report.push('\n---\n');
    }
    
    // Issues and recommendations
    report.push('\n## 🚨 Critical Issues & Recommendations\n');
    
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Check for tables without primary keys that have data
    const noPKWithData = this.tables.filter(t => !t.info.has_primary_key && t.info.row_count > 0);
    if (noPKWithData.length > 0) {
      criticalIssues.push(`**${noPKWithData.length} tables with data lack primary keys**: ${noPKWithData.map(t => t.info.table_name).join(', ')}`);
    }
    
    // Check for tables without RLS that have data
    const noRLSWithData = this.tables.filter(t => !t.info.rls_enabled && t.info.row_count > 0);
    if (noRLSWithData.length > 0) {
      warnings.push(`**${noRLSWithData.length} tables with data have RLS disabled**: ${noRLSWithData.map(t => t.info.table_name).join(', ')}`);
    }
    
    // Check for tables with RLS enabled but no policies
    const rlsNoPolicies = this.tables.filter(t => t.info.rls_enabled && !t.info.has_policies);
    if (rlsNoPolicies.length > 0) {
      criticalIssues.push(`**${rlsNoPolicies.length} tables have RLS enabled but NO policies** (blocking all access): ${rlsNoPolicies.map(t => t.info.table_name).join(', ')}`);
    }
    
    // Check for missing indexes on foreign key columns
    for (const table of this.tables) {
      const fkColumns = table.columns.filter(c => c.foreign_table).map(c => c.column_name);
      const indexedColumns = new Set(table.indexes.flatMap(idx => idx.columns));
      const unindexedFKs = fkColumns.filter(col => !indexedColumns.has(col));
      
      if (unindexedFKs.length > 0) {
        suggestions.push(`Table **${table.info.table_name}**: Add indexes on FK columns: ${unindexedFKs.join(', ')}`);
      }
    }
    
    if (criticalIssues.length > 0) {
      report.push('### 🔴 Critical Issues');
      criticalIssues.forEach(issue => report.push(`- ${issue}`));
      report.push('');
    }
    
    if (warnings.length > 0) {
      report.push('### 🟡 Warnings');
      warnings.forEach(warning => report.push(`- ${warning}`));
      report.push('');
    }
    
    if (suggestions.length > 0) {
      report.push('### 💡 Performance Suggestions');
      suggestions.forEach(suggestion => report.push(`- ${suggestion}`));
      report.push('');
    }
    
    return report.join('\n');
  }

  private generateSQLSchema(): string {
    const sql: string[] = [];
    
    sql.push('-- Complete Database Schema');
    sql.push('-- Generated from live Supabase database');
    sql.push(`-- Date: ${new Date().toISOString()}`);
    sql.push('');
    
    for (const table of this.tables) {
      sql.push(`-- Table: ${table.info.table_name}`);
      sql.push(`-- Rows: ${table.info.row_count}, Size: ${table.info.total_size}`);
      sql.push(`CREATE TABLE ${table.info.table_name} (`);
      
      const columnDefs: string[] = [];
      
      for (const col of table.columns) {
        let def = `    ${col.column_name} ${col.data_type}`;
        
        if (!col.is_nullable) {
          def += ' NOT NULL';
        }
        
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        columnDefs.push(def);
      }
      
      // Add primary key constraint
      const pkColumns = table.columns.filter(c => c.is_primary_key);
      if (pkColumns.length > 0) {
        columnDefs.push(`    PRIMARY KEY (${pkColumns.map(c => c.column_name).join(', ')})`);
      }
      
      sql.push(columnDefs.join(',\n'));
      sql.push(');');
      sql.push('');
      
      // Add foreign key constraints
      const fkColumns = table.columns.filter(c => c.foreign_table);
      for (const fk of fkColumns) {
        sql.push(`ALTER TABLE ${table.info.table_name}`);
        sql.push(`    ADD CONSTRAINT ${table.info.table_name}_${fk.column_name}_fkey`);
        sql.push(`    FOREIGN KEY (${fk.column_name})`);
        sql.push(`    REFERENCES ${fk.foreign_table}(${fk.foreign_column});`);
        sql.push('');
      }
      
      // Add indexes
      for (const idx of table.indexes) {
        if (!idx.is_primary) {
          const unique = idx.is_unique ? 'UNIQUE ' : '';
          sql.push(`CREATE ${unique}INDEX ${idx.index_name}`);
          sql.push(`    ON ${table.info.table_name} (${idx.columns.join(', ')});`);
          sql.push('');
        }
      }
      
      // Enable RLS if needed
      if (table.info.rls_enabled) {
        sql.push(`ALTER TABLE ${table.info.table_name} ENABLE ROW LEVEL SECURITY;`);
        sql.push('');
        
        // Add policies
        for (const pol of table.policies) {
          sql.push(`CREATE POLICY ${pol.policy_name}`);
          sql.push(`    ON ${table.info.table_name}`);
          sql.push(`    FOR ${pol.command}`);
          sql.push(`    TO ${pol.roles.join(', ') || 'PUBLIC'}`);
          
          if (pol.using_expression) {
            sql.push(`    USING (${pol.using_expression})`);
          }
          if (pol.check_expression) {
            sql.push(`    WITH CHECK (${pol.check_expression})`);
          }
          sql.push(';');
          sql.push('');
        }
      }
      
      sql.push('');
    }
    
    return sql.join('\n');
  }

  private generateMigrationRecommendations(): string {
    const sql: string[] = [];
    
    sql.push('-- Migration Recommendations');
    sql.push('-- Based on analysis of current schema');
    sql.push(`-- Generated: ${new Date().toISOString()}`);
    sql.push('');
    sql.push('-- Run these commands to improve your schema:');
    sql.push('');
    
    // Add primary keys
    const noPK = this.tables.filter(t => !t.info.has_primary_key && t.info.row_count > 0);
    if (noPK.length > 0) {
      sql.push('-- 1. Add missing primary keys');
      for (const table of noPK) {
        // Check if there's an 'id' column
        const idCol = table.columns.find(c => c.column_name === 'id');
        if (idCol) {
          sql.push(`ALTER TABLE ${table.info.table_name} ADD PRIMARY KEY (id);`);
        } else {
          sql.push(`-- TODO: Determine primary key for ${table.info.table_name}`);
          sql.push(`-- ALTER TABLE ${table.info.table_name} ADD PRIMARY KEY (...);`);
        }
      }
      sql.push('');
    }
    
    // Enable RLS
    const noRLS = this.tables.filter(t => !t.info.rls_enabled && t.info.row_count > 0);
    if (noRLS.length > 0) {
      sql.push('-- 2. Enable Row Level Security');
      for (const table of noRLS) {
        sql.push(`ALTER TABLE ${table.info.table_name} ENABLE ROW LEVEL SECURITY;`);
        sql.push(`-- TODO: Add appropriate policies for ${table.info.table_name}`);
      }
      sql.push('');
    }
    
    // Add missing indexes on foreign keys
    sql.push('-- 3. Add missing indexes on foreign key columns');
    for (const table of this.tables) {
      const fkColumns = table.columns.filter(c => c.foreign_table);
      const indexedColumns = new Set(table.indexes.flatMap(idx => idx.columns));
      
      for (const fk of fkColumns) {
        if (!indexedColumns.has(fk.column_name)) {
          sql.push(`CREATE INDEX idx_${table.info.table_name}_${fk.column_name}`);
          sql.push(`    ON ${table.info.table_name} (${fk.column_name});`);
        }
      }
    }
    sql.push('');
    
    // Fix RLS enabled but no policies
    const rlsNoPolicies = this.tables.filter(t => t.info.rls_enabled && !t.info.has_policies);
    if (rlsNoPolicies.length > 0) {
      sql.push('-- 4. CRITICAL: Tables with RLS enabled but NO policies (blocking all access)');
      for (const table of rlsNoPolicies) {
        sql.push(`-- Table: ${table.info.table_name}`);
        sql.push(`-- Option 1: Add policies`);
        sql.push(`-- CREATE POLICY "Enable read for authenticated users" ON ${table.info.table_name}`);
        sql.push(`--     FOR SELECT TO authenticated USING (true);`);
        sql.push(`-- Option 2: Disable RLS if not needed`);
        sql.push(`-- ALTER TABLE ${table.info.table_name} DISABLE ROW LEVEL SECURITY;`);
        sql.push('');
      }
    }
    
    return sql.join('\n');
  }

  private calculateTotalSize(): string {
    let totalBytes = 0;
    
    for (const table of this.tables) {
      const sizeMatch = table.info.total_size.match(/(\d+(?:\.\d+)?)\s*([KMGT]?B)/);
      if (sizeMatch) {
        const [, value, unit] = sizeMatch;
        const multipliers: Record<string, number> = {
          'B': 1,
          'KB': 1024,
          'MB': 1024 * 1024,
          'GB': 1024 * 1024 * 1024,
          'TB': 1024 * 1024 * 1024 * 1024
        };
        totalBytes += parseFloat(value) * (multipliers[unit] || 1);
      }
    }
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = totalBytes;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// Run the analyzer
async function main() {
  const analyzer = new ComprehensiveDatabaseAnalyzer();
  
  try {
    await analyzer.analyze();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main();
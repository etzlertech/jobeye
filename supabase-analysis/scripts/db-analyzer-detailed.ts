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
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

interface TableDetails {
  name: string;
  row_count: number;
  columns: any[];
  foreign_keys: any[];
  indexes: any[];
  policies: any[];
  triggers: any[];
  has_primary_key: boolean;
  primary_key_columns: string[];
  rls_enabled: boolean;
  description?: string;
}

class DetailedDatabaseAnalyzer {
  private client = createClient(supabaseUrl, supabaseServiceKey);
  private tables: TableDetails[] = [];

  async analyze() {
    console.log('🔍 Starting detailed database analysis...\n');

    // Step 1: Get all tables using REST API
    const tableNames = await this.discoverTables();
    console.log(`✅ Found ${tableNames.length} tables\n`);

    // Step 2: For each table, gather detailed information
    for (const tableName of tableNames) {
      console.log(`📊 Analyzing table: ${tableName}`);
      const details = await this.analyzeTable(tableName);
      this.tables.push(details);
    }

    // Step 3: Generate comprehensive report
    await this.generateReport();
  }

  private async discoverTables(): Promise<string[]> {
    // Method 1: Try REST API OpenAPI spec - this is the most reliable
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseServiceKey}`);
      if (response.ok) {
        const openApiSpec = await response.json();
        
        if (openApiSpec.definitions) {
          const tableNames = Object.keys(openApiSpec.definitions)
            .filter(name => !name.includes('.'))
            .sort();
          
          if (tableNames.length > 0) {
            console.log('✅ Retrieved table list from REST API OpenAPI spec');
            return tableNames;
          }
        }
      }
    } catch (error) {
      console.error('⚠️  REST API approach failed:', error);
    }

    // Method 2: Try to query pg_tables
    try {
      const { data, error } = await this.client.rpc('exec_sql_query', {
        query: `
          SELECT tablename 
          FROM pg_tables 
          WHERE schemaname = 'public' 
          ORDER BY tablename;
        `
      });

      if (!error && data) {
        return data.map((row: any) => row.tablename);
      }
    } catch (e) {
      console.log('⚠️  exec_sql_query not available');
    }

    throw new Error('Could not discover tables');
  }

  private async analyzeTable(tableName: string): Promise<TableDetails> {
    const details: TableDetails = {
      name: tableName,
      row_count: 0,
      columns: [],
      foreign_keys: [],
      indexes: [],
      policies: [],
      triggers: [],
      has_primary_key: false,
      primary_key_columns: [],
      rls_enabled: false
    };

    // Get row count
    try {
      const { count } = await this.client
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      details.row_count = count || 0;
    } catch (e) {
      console.log(`  ⚠️  Could not get row count for ${tableName}`);
    }

    // Get table structure from REST API
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?limit=0`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Prefer': 'count=exact'
        }
      });

      if (response.ok) {
        // Parse OpenAPI schema for this specific table
        const schemaResponse = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseServiceKey}`);
        if (schemaResponse.ok) {
          const openApiSpec = await schemaResponse.json();
          const tableSchema = openApiSpec.definitions?.[tableName];
          
          if (tableSchema?.properties) {
            details.columns = Object.entries(tableSchema.properties).map(([name, schema]: [string, any]) => ({
              column_name: name,
              data_type: schema.type || 'unknown',
              format: schema.format,
              description: schema.description,
              maxLength: schema.maxLength,
              default: schema.default,
              enum: schema.enum
            }));

            // Check for ID column as primary key indicator
            if (tableSchema.properties.id) {
              details.has_primary_key = true;
              details.primary_key_columns = ['id'];
            }
          }
        }
      }
    } catch (e) {
      console.log(`  ⚠️  Could not get schema for ${tableName}`);
    }

    // Try to get RLS status by attempting to query with anon key
    try {
      const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error } = await anonClient.from(tableName).select('*', { head: true });
      
      // If we get a permission error, RLS is likely enabled
      if (error && error.message.includes('permission')) {
        details.rls_enabled = true;
      }
    } catch (e) {
      // Ignore errors here
    }

    // Look for foreign key relationships in column names
    details.columns.forEach(col => {
      if (col.column_name.endsWith('_id') && col.column_name !== 'id') {
        const possibleTable = col.column_name.replace(/_id$/, 's');
        details.foreign_keys.push({
          column_name: col.column_name,
          foreign_table_name: possibleTable,
          foreign_column_name: 'id'
        });
      }
    });

    return details;
  }

  private async generateReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.join(process.cwd(), 'supabase-analysis', 'reports', 'detailed', timestamp);
    
    await fs.mkdir(reportDir, { recursive: true });

    // Generate detailed markdown report
    const markdownReport = this.generateMarkdownReport();
    await fs.writeFile(path.join(reportDir, 'detailed-analysis.md'), markdownReport);

    // Generate YAML data dump
    const yamlData = yaml.stringify({
      analyzed_at: new Date().toISOString(),
      database_url: supabaseUrl,
      total_tables: this.tables.length,
      total_rows: this.tables.reduce((sum, t) => sum + t.row_count, 0),
      tables: this.tables
    });
    await fs.writeFile(path.join(reportDir, 'detailed-data.yaml'), yamlData);

    // Generate SQL recreation script
    const sqlScript = this.generateSQLScript();
    await fs.writeFile(path.join(reportDir, 'table-definitions.sql'), sqlScript);

    console.log(`\n✅ Reports generated in: ${reportDir}`);
    console.log(`   - detailed-analysis.md: Comprehensive markdown report`);
    console.log(`   - detailed-data.yaml: Structured data dump`);
    console.log(`   - table-definitions.sql: SQL definitions based on discovered schema`);
  }

  private generateMarkdownReport(): string {
    const report: string[] = [];
    
    report.push('# Detailed Database Analysis Report');
    report.push(`\nGenerated: ${new Date().toISOString()}`);
    report.push(`\n## Summary`);
    report.push(`- **Total Tables**: ${this.tables.length}`);
    report.push(`- **Total Rows**: ${this.tables.reduce((sum, t) => sum + t.row_count, 0)}`);
    report.push(`- **Tables with RLS**: ${this.tables.filter(t => t.rls_enabled).length}`);
    report.push(`- **Tables with Primary Keys**: ${this.tables.filter(t => t.has_primary_key).length}`);
    
    report.push('\n## Table Details\n');
    
    // Sort tables by row count descending
    const sortedTables = [...this.tables].sort((a, b) => b.row_count - a.row_count);
    
    for (const table of sortedTables) {
      report.push(`### ${table.name}`);
      report.push(`- **Row Count**: ${table.row_count.toLocaleString()}`);
      report.push(`- **RLS Enabled**: ${table.rls_enabled ? '✅' : '❌'}`);
      report.push(`- **Primary Key**: ${table.has_primary_key ? `✅ (${table.primary_key_columns.join(', ')})` : '❌'}`);
      
      if (table.columns.length > 0) {
        report.push('\n#### Columns');
        report.push('| Name | Type | Format | Description |');
        report.push('|------|------|--------|-------------|');
        
        for (const col of table.columns) {
          report.push(`| ${col.column_name} | ${col.data_type} | ${col.format || '-'} | ${col.description || '-'} |`);
        }
      }
      
      if (table.foreign_keys.length > 0) {
        report.push('\n#### Foreign Keys (inferred)');
        report.push('| Column | References |');
        report.push('|--------|------------|');
        
        for (const fk of table.foreign_keys) {
          report.push(`| ${fk.column_name} | ${fk.foreign_table_name}.${fk.foreign_column_name} |`);
        }
      }
      
      report.push('\n---\n');
    }
    
    report.push('\n## Recommendations\n');
    
    // Tables without primary keys
    const noPkTables = this.tables.filter(t => !t.has_primary_key && t.row_count > 0);
    if (noPkTables.length > 0) {
      report.push(`### 🔑 Add Primary Keys`);
      report.push(`The following ${noPkTables.length} tables don't have primary keys:`);
      noPkTables.forEach(t => report.push(`- ${t.name} (${t.row_count} rows)`));
      report.push('');
    }
    
    // Tables without RLS
    const noRlsTables = this.tables.filter(t => !t.rls_enabled && t.row_count > 0);
    if (noRlsTables.length > 0) {
      report.push(`### 🔒 Enable Row Level Security`);
      report.push(`The following ${noRlsTables.length} tables don't have RLS enabled:`);
      noRlsTables.forEach(t => report.push(`- ${t.name} (${t.row_count} rows)`));
      report.push('');
    }
    
    // Empty tables
    const emptyTables = this.tables.filter(t => t.row_count === 0);
    if (emptyTables.length > 0) {
      report.push(`### 🗑️ Review Empty Tables`);
      report.push(`The following ${emptyTables.length} tables have no data:`);
      emptyTables.forEach(t => report.push(`- ${t.name}`));
      report.push('');
    }
    
    return report.join('\n');
  }

  private generateSQLScript(): string {
    const sql: string[] = [];
    
    sql.push('-- Table definitions based on discovered schema');
    sql.push('-- Note: These are inferred from the REST API and may not be complete\n');
    
    for (const table of this.tables) {
      sql.push(`-- Table: ${table.name}`);
      sql.push(`-- Rows: ${table.row_count}`);
      sql.push(`CREATE TABLE IF NOT EXISTS ${table.name} (`);
      
      const columnDefs: string[] = [];
      
      for (const col of table.columns) {
        let def = `  ${col.column_name} `;
        
        // Map JSON Schema types to PostgreSQL types
        switch (col.data_type) {
          case 'string':
            if (col.format === 'uuid') {
              def += 'UUID';
            } else if (col.format === 'date-time') {
              def += 'TIMESTAMPTZ';
            } else if (col.maxLength) {
              def += `VARCHAR(${col.maxLength})`;
            } else {
              def += 'TEXT';
            }
            break;
          case 'integer':
            def += 'INTEGER';
            break;
          case 'number':
            def += 'NUMERIC';
            break;
          case 'boolean':
            def += 'BOOLEAN';
            break;
          case 'object':
            def += 'JSONB';
            break;
          case 'array':
            def += 'JSONB';
            break;
          default:
            def += 'TEXT';
        }
        
        if (col.default) {
          def += ` DEFAULT '${col.default}'`;
        }
        
        columnDefs.push(def);
      }
      
      if (table.has_primary_key) {
        columnDefs.push(`  PRIMARY KEY (${table.primary_key_columns.join(', ')})`);
      }
      
      sql.push(columnDefs.join(',\n'));
      sql.push(');\n');
      
      if (table.rls_enabled) {
        sql.push(`ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;\n`);
      }
    }
    
    return sql.join('\n');
  }
}

// Run the analyzer
async function main() {
  const analyzer = new DetailedDatabaseAnalyzer();
  
  try {
    await analyzer.analyze();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main();
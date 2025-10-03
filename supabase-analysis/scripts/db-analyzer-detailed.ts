import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TableDetails {
  name: string;
  row_count: number;
  columns: ColumnInfo[];
  primary_key?: string[];
  foreign_keys: ForeignKeyInfo[];
  indexes: string[];
  rls_enabled: boolean;
  rls_policies: any[];
  description?: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  is_primary: boolean;
  is_foreign: boolean;
  references?: string;
}

interface ForeignKeyInfo {
  column: string;
  references_table: string;
  references_column: string;
}

export class DetailedDatabaseAnalyzer {
  private client: SupabaseClient;
  private discoveredTables: string[] = [];
  
  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async analyze(): Promise<any> {
    console.log('🔍 Starting DETAILED database analysis...\n');
    
    // First discover tables
    await this.discoverTables();
    
    console.log(`✅ Discovered ${this.discoveredTables.length} tables\n`);
    
    // Analyze each table in detail
    const tableDetails: TableDetails[] = [];
    
    for (const tableName of this.discoveredTables) {
      console.log(`📊 Analyzing ${tableName}...`);
      const details = await this.analyzeTable(tableName);
      tableDetails.push(details);
    }
    
    // Sort by row count
    tableDetails.sort((a, b) => b.row_count - a.row_count);
    
    // Generate comprehensive analysis
    const analysis = {
      analyzed_at: new Date().toISOString(),
      database_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      total_tables: tableDetails.length,
      total_rows: tableDetails.reduce((sum, t) => sum + t.row_count, 0),
      tables: tableDetails,
      summary: this.generateSummary(tableDetails),
      recommendations: this.generateRecommendations(tableDetails)
    };
    
    return analysis;
  }

  private async discoverTables(): Promise<void> {
    // Try REST API approach first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
        if (response.ok) {
          const openApiSpec = await response.json();
          
          if (openApiSpec.definitions) {
            this.discoveredTables = Object.keys(openApiSpec.definitions)
              .filter(name => !name.includes('.'))
              .sort();
            return;
          }
        }
      } catch (error) {
        console.error('REST API discovery failed:', error);
      }
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
      rls_enabled: false,
      rls_policies: []
    };
    
    // Get row count
    try {
      const { count } = await this.client
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      details.row_count = count || 0;
    } catch (error) {
      console.error(`  ⚠️  Error counting rows for ${tableName}`);
    }
    
    // Try to get table structure from REST API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
        if (response.ok) {
          const openApiSpec = await response.json();
          const tableDef = openApiSpec.definitions?.[tableName];
          
          if (tableDef?.properties) {
            // Extract column information from OpenAPI schema
            for (const [columnName, columnDef] of Object.entries(tableDef.properties as any)) {
              const column: ColumnInfo = {
                name: columnName,
                type: this.mapOpenApiType(columnDef),
                nullable: !tableDef.required?.includes(columnName),
                is_primary: columnName === 'id' || columnName.endsWith('_id'),
                is_foreign: columnName.endsWith('_id') && columnName !== 'id',
                default: columnDef.default
              };
              
              // Infer foreign key relationships
              if (column.is_foreign) {
                const referencedTable = columnName.replace(/_id$/, '');
                if (this.discoveredTables.includes(referencedTable) || this.discoveredTables.includes(referencedTable + 's')) {
                  column.references = referencedTable;
                  details.foreign_keys.push({
                    column: columnName,
                    references_table: referencedTable,
                    references_column: 'id'
                  });
                }
              }
              
              details.columns.push(column);
            }
            
            // Identify primary key
            const pkColumn = details.columns.find(c => c.is_primary);
            if (pkColumn) {
              details.primary_key = [pkColumn.name];
            }
          }
        }
      } catch (error) {
        console.error(`  ⚠️  Error getting schema for ${tableName}`);
      }
    }
    
    // Try to get RLS policies
    try {
      const { data: policies } = await this.client.rpc('get_policies_for_table', {
        table_name: tableName
      }).throwOnError();
      
      if (policies && policies.length > 0) {
        details.rls_enabled = true;
        details.rls_policies = policies;
      }
    } catch (error) {
      // RLS check failed, assume not available
    }
    
    return details;
  }

  private mapOpenApiType(columnDef: any): string {
    if (columnDef.type === 'string') {
      if (columnDef.format === 'uuid') return 'uuid';
      if (columnDef.format === 'date-time') return 'timestamp';
      if (columnDef.format === 'date') return 'date';
      return columnDef.maxLength ? `varchar(${columnDef.maxLength})` : 'text';
    }
    if (columnDef.type === 'integer') return 'integer';
    if (columnDef.type === 'number') return 'numeric';
    if (columnDef.type === 'boolean') return 'boolean';
    if (columnDef.type === 'array') return `${this.mapOpenApiType(columnDef.items)}[]`;
    return 'unknown';
  }

  private generateSummary(tables: TableDetails[]): any {
    const tablesWithData = tables.filter(t => t.row_count > 0);
    const tablesWithPK = tables.filter(t => t.primary_key && t.primary_key.length > 0);
    const tablesWithFK = tables.filter(t => t.foreign_keys.length > 0);
    const tablesWithRLS = tables.filter(t => t.rls_enabled);
    
    return {
      total_tables: tables.length,
      tables_with_data: tablesWithData.length,
      empty_tables: tables.length - tablesWithData.length,
      tables_with_primary_key: tablesWithPK.length,
      tables_with_foreign_keys: tablesWithFK.length,
      tables_with_rls: tablesWithRLS.length,
      total_columns: tables.reduce((sum, t) => sum + t.columns.length, 0),
      total_relationships: tables.reduce((sum, t) => sum + t.foreign_keys.length, 0)
    };
  }

  private generateRecommendations(tables: TableDetails[]): string[] {
    const recommendations: string[] = [];
    
    // Tables without primary keys
    const noPK = tables.filter(t => !t.primary_key && t.row_count > 0);
    if (noPK.length > 0) {
      recommendations.push(
        `Add primary keys to ${noPK.length} tables: ${noPK.slice(0, 5).map(t => t.name).join(', ')}${noPK.length > 5 ? '...' : ''}`
      );
    }
    
    // Tables without RLS
    const noRLS = tables.filter(t => !t.rls_enabled && t.row_count > 0);
    if (noRLS.length > 0) {
      recommendations.push(
        `Enable RLS on ${noRLS.length} tables containing data`
      );
    }
    
    // Empty tables
    const emptyTables = tables.filter(t => t.row_count === 0);
    if (emptyTables.length > 5) {
      recommendations.push(
        `Review ${emptyTables.length} empty tables for potential removal`
      );
    }
    
    // Tables with many columns but no indexes
    const largeTablesNoIndex = tables.filter(t => 
      t.columns.length > 10 && t.indexes.length === 0 && t.row_count > 100
    );
    if (largeTablesNoIndex.length > 0) {
      recommendations.push(
        `Consider adding indexes to ${largeTablesNoIndex.length} large tables`
      );
    }
    
    return recommendations;
  }
}

// Report generator
export class DetailedReportGenerator {
  async generateReport(analysis: any, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });
    
    // Generate detailed markdown report
    const markdown = this.buildMarkdownReport(analysis);
    await fs.writeFile(path.join(outputDir, 'detailed-database-report.md'), markdown, 'utf8');
    
    // Generate YAML with full data
    const yaml = await import('js-yaml');
    const yamlContent = yaml.dump(analysis, {
      indent: 2,
      lineWidth: 120,
      sortKeys: false
    });
    await fs.writeFile(path.join(outputDir, 'detailed-database-analysis.yaml'), yamlContent, 'utf8');
    
    console.log(`\n✅ Detailed reports generated in: ${outputDir}`);
  }

  private buildMarkdownReport(analysis: any): string {
    const sections: string[] = [];
    
    sections.push(`# Detailed Database Analysis Report

Generated: ${analysis.analyzed_at}
Database: ${analysis.database_url}

## Executive Summary

- **Total Tables**: ${analysis.total_tables}
- **Total Rows**: ${analysis.total_rows.toLocaleString()}
- **Tables with Data**: ${analysis.summary.tables_with_data}
- **Empty Tables**: ${analysis.summary.empty_tables}
- **Tables with Primary Keys**: ${analysis.summary.tables_with_primary_key}
- **Tables with Foreign Keys**: ${analysis.summary.tables_with_foreign_keys}
- **Tables with RLS**: ${analysis.summary.tables_with_rls}
- **Total Columns**: ${analysis.summary.total_columns}
- **Total Relationships**: ${analysis.summary.total_relationships}

## Table Details

`);

    // Add detailed information for each table
    for (const table of analysis.tables) {
      if (table.row_count === 0 && table.columns.length === 0) continue;
      
      sections.push(`### 📊 ${table.name}

**Row Count**: ${table.row_count.toLocaleString()}
**Primary Key**: ${table.primary_key ? table.primary_key.join(', ') : 'None'}
**RLS Enabled**: ${table.rls_enabled ? '✅' : '❌'}

#### Columns (${table.columns.length})

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|`);

      for (const column of table.columns) {
        const notes = [];
        if (column.is_primary) notes.push('PK');
        if (column.is_foreign) notes.push(`FK → ${column.references || '?'}`);
        
        sections.push(
          `| ${column.name} | ${column.type} | ${column.nullable ? 'YES' : 'NO'} | ${column.default || '-'} | ${notes.join(', ') || '-'} |`
        );
      }

      if (table.foreign_keys.length > 0) {
        sections.push(`
#### Foreign Key Relationships

| Column | References Table | References Column |
|--------|------------------|-------------------|`);

        for (const fk of table.foreign_keys) {
          sections.push(
            `| ${fk.column} | ${fk.references_table} | ${fk.references_column} |`
          );
        }
      }

      sections.push('\n---\n');
    }

    // Add recommendations
    sections.push(`## Recommendations

${analysis.recommendations.map((rec: string, idx: number) => `${idx + 1}. ${rec}`).join('\n')}
`);

    return sections.join('\n');
  }
}
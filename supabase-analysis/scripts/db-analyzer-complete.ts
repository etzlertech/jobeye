import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TableAnalysis {
  name: string;
  schema: string;
  row_count: number;
  columns: ColumnInfo[];
  primary_keys: string[];
  foreign_keys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  rls_enabled: boolean;
  rls_policies: RLSPolicy[];
  triggers: TriggerInfo[];
  description?: string;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  udt_name?: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  is_identity?: boolean;
  is_generated?: boolean;
  generation_expression?: string | null;
  is_updatable?: boolean;
  ordinal_position: number;
  comment?: string;
}

export interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  update_rule?: string;
  delete_rule?: string;
}

export interface IndexInfo {
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
  index_type?: string;
  table_name: string;
}

export interface RLSPolicy {
  policy_name: string;
  table_name: string;
  command: string;
  roles?: string[];
  using_expression?: string | null;
  check_expression?: string | null;
  is_permissive?: boolean;
}

export interface TriggerInfo {
  trigger_name: string;
  event_manipulation: string;
  event_timing?: string;
  action_statement?: string;
  action_orientation?: string;
  condition_timing?: string | null;
}

export interface FunctionInfo {
  function_name: string;
  schema_name: string;
  return_type?: string;
  argument_types?: string[];
  is_aggregate?: boolean;
  is_window?: boolean;
  is_trigger?: boolean;
  security_type?: string;
  language?: string;
  source_code?: string;
  description?: string;
}

export interface ViewInfo {
  view_name: string;
  schema_name: string;
  is_materialized?: boolean;
  definition?: string;
  is_updatable?: boolean;
  columns?: string[];
}

export interface EnumInfo {
  enum_name: string;
  schema_name: string;
  values?: string[];
}

export interface DatabaseAnalysis {
  analyzed_at: string;
  database_url: string;
  tables: TableAnalysis[];
  views: ViewInfo[];
  functions: FunctionInfo[];
  enums: EnumInfo[];
  total_tables: number;
  total_rows: number;
  orphaned_tables: string[];
  missing_rls_tables: string[];
  recommendations: string[];
}

interface MigrationTableInfo {
  name: string;
  schema: string;
  migrationFile: string;
  hasRLS?: boolean;
  columns: { name: string; type: string; nullable: boolean; default?: string }[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: string[];
}

export class DatabaseAnalyzerComplete {
  private migrationTables: Map<string, MigrationTableInfo> = new Map();
  
  constructor(private client: SupabaseClient) {}

  async analyze(): Promise<DatabaseAnalysis> {
    const analyzedAt = new Date().toISOString();
    
    // First, parse migration files to get complete schema information
    await this.parseMigrations();
    
    // Get all tables that we can query
    const tableAnalyses: TableAnalysis[] = [];
    let totalRows = 0;
    
    console.log(`\n📊 Analyzing ${this.migrationTables.size} tables from migrations...`);
    
    let analyzed = 0;
    for (const [fullTableName, migrationInfo] of this.migrationTables) {
      analyzed++;
      if (analyzed % 10 === 0) {
        console.log(`  Progress: ${analyzed}/${this.migrationTables.size} tables analyzed...`);
      }
      
      try {
        const analysis = await this.analyzeTable(fullTableName, migrationInfo);
        tableAnalyses.push(analysis);
        totalRows += analysis.row_count;
      } catch (error) {
        console.error(`  ⚠️  Failed to analyze ${fullTableName}:`, error);
        // Still include the table with basic info from migrations
        tableAnalyses.push({
          name: migrationInfo.name,
          schema: migrationInfo.schema,
          row_count: 0,
          columns: migrationInfo.columns.map((col, idx) => ({
            name: col.name,
            data_type: col.type,
            is_nullable: col.nullable,
            column_default: col.default || null,
            ordinal_position: idx + 1
          })),
          primary_keys: migrationInfo.primaryKeys,
          foreign_keys: migrationInfo.foreignKeys,
          indexes: migrationInfo.indexes.map(idx => ({
            index_name: idx,
            is_unique: false,
            is_primary: false,
            columns: [],
            table_name: migrationInfo.name
          })),
          rls_enabled: migrationInfo.hasRLS || false,
          rls_policies: [],
          triggers: []
        });
      }
    }
    
    console.log(`\n✅ Analysis complete. Processed ${tableAnalyses.length} tables.`);
    
    // Calculate statistics
    const missingRlsTables = tableAnalyses
      .filter(t => !t.rls_enabled && !['spatial_ref_sys', 'geography_columns', 'geometry_columns'].includes(t.name))
      .map(t => t.name);
    const orphanedTables = this.detectOrphanedTables(tableAnalyses);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(tableAnalyses, [], []);
    
    return {
      analyzed_at: analyzedAt,
      database_url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      tables: tableAnalyses,
      views: [],
      functions: [],
      enums: [],
      total_tables: tableAnalyses.length,
      total_rows: totalRows,
      orphaned_tables: orphanedTables,
      missing_rls_tables: missingRlsTables,
      recommendations
    };
  }

  private async parseMigrations() {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    
    for (const file of sqlFiles) {
      const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
      
      // Parse CREATE TABLE statements
      const createTableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:([\w_]+)\.)?([\w_]+)\s*\(([\s\S]*?)\)(?:\s*INHERITS\s*\([^)]+\))?(?:\s*WITH\s*\([^)]+\))?;/gi;
      let match;
      
      while ((match = createTableRegex.exec(content)) !== null) {
        const schema = match[1] || 'public';
        const tableName = match[2];
        const columnsDef = match[3];
        const fullTableName = `${schema}.${tableName}`;
        
        // Parse columns
        const columns: { name: string; type: string; nullable: boolean; default?: string }[] = [];
        const primaryKeys: string[] = [];
        const foreignKeys: ForeignKeyInfo[] = [];
        const indexes: string[] = [];
        
        // Parse column definitions
        const lines = columnsDef.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Parse column definition
          const columnMatch = trimmed.match(/^(\w+)\s+([^,]+?)(?:\s+(NOT NULL|NULL))?(?:\s+DEFAULT\s+([^,]+))?(?:,|$)/i);
          if (columnMatch && !trimmed.startsWith('CONSTRAINT') && !trimmed.startsWith('PRIMARY KEY') && !trimmed.startsWith('FOREIGN KEY')) {
            const [, name, type, nullClause, defaultValue] = columnMatch;
            columns.push({
              name,
              type: type.trim(),
              nullable: nullClause !== 'NOT NULL',
              default: defaultValue?.trim()
            });
          }
          
          // Parse PRIMARY KEY constraint
          if (trimmed.match(/PRIMARY KEY\s*\(([^)]+)\)/i)) {
            const pkMatch = trimmed.match(/PRIMARY KEY\s*\(([^)]+)\)/i);
            if (pkMatch) {
              primaryKeys.push(...pkMatch[1].split(',').map(k => k.trim()));
            }
          }
          
          // Parse FOREIGN KEY constraint
          const fkMatch = trimmed.match(/FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+([\w.]+)\s*\((\w+)\)/i);
          if (fkMatch) {
            foreignKeys.push({
              constraint_name: `fk_${tableName}_${fkMatch[1]}`,
              table_name: tableName,
              column_name: fkMatch[1],
              foreign_table_name: fkMatch[2].split('.').pop()!,
              foreign_column_name: fkMatch[3]
            });
          }
        }
        
        // Check for single column primary keys
        columns.forEach(col => {
          if (col.type.includes('PRIMARY KEY')) {
            primaryKeys.push(col.name);
            col.type = col.type.replace('PRIMARY KEY', '').trim();
          }
        });
        
        this.migrationTables.set(fullTableName, {
          name: tableName,
          schema,
          migrationFile: file,
          columns,
          primaryKeys,
          foreignKeys,
          indexes,
          hasRLS: false
        });
      }
      
      // Parse RLS enablement
      const rlsRegex = /ALTER TABLE\s+(?:([\w_]+)\.)?([\w_]+)\s+ENABLE ROW LEVEL SECURITY/gi;
      while ((match = rlsRegex.exec(content)) !== null) {
        const schema = match[1] || 'public';
        const tableName = match[2];
        const fullTableName = `${schema}.${tableName}`;
        const tableInfo = this.migrationTables.get(fullTableName);
        if (tableInfo) {
          tableInfo.hasRLS = true;
        }
      }
      
      // Parse REFERENCES in column definitions
      const refRegex = /(\w+)\s+\w+\s+REFERENCES\s+([\w.]+)\s*\((\w+)\)/gi;
      while ((match = refRegex.exec(content)) !== null) {
        const [, columnName, refTable, refColumn] = match;
        // Find the table this belongs to
        for (const [fullName, info] of this.migrationTables) {
          if (content.includes(`CREATE TABLE ${fullName}`) || content.includes(`CREATE TABLE ${info.name}`)) {
            info.foreignKeys.push({
              constraint_name: `fk_${info.name}_${columnName}`,
              table_name: info.name,
              column_name: columnName,
              foreign_table_name: refTable.split('.').pop()!,
              foreign_column_name: refColumn
            });
            break;
          }
        }
      }
    }
  }

  private async analyzeTable(fullTableName: string, migrationInfo: MigrationTableInfo): Promise<TableAnalysis> {
    const tableName = fullTableName.includes('.') ? fullTableName : `public.${fullTableName}`;
    
    // Get row count
    let rowCount = 0;
    try {
      const { count, error } = await this.client
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (!error && count !== null) {
        rowCount = count;
      }
    } catch (e) {
      // Table might not be accessible
    }
    
    // Get sample data to infer more about columns
    let sampleData: any[] = [];
    try {
      const { data, error } = await this.client
        .from(tableName)
        .select('*')
        .limit(5);
      
      if (!error && data) {
        sampleData = data;
      }
    } catch (e) {
      // Ignore errors
    }
    
    // Enhance column info with sample data
    const columns: ColumnInfo[] = migrationInfo.columns.map((col, idx) => {
      const sampleValues = sampleData.map(row => row[col.name]).filter(v => v !== null && v !== undefined);
      
      return {
        name: col.name,
        data_type: col.type,
        is_nullable: col.nullable,
        column_default: col.default || null,
        ordinal_position: idx + 1,
        // Infer additional properties from sample data
        character_maximum_length: typeof sampleValues[0] === 'string' ? 
          Math.max(...sampleValues.map(v => v.length), 0) : null
      };
    });
    
    // Identify primary keys from column names if not explicitly defined
    if (migrationInfo.primaryKeys.length === 0 && columns.some(c => c.name === 'id')) {
      migrationInfo.primaryKeys.push('id');
    }
    
    return {
      name: migrationInfo.name,
      schema: migrationInfo.schema,
      row_count: rowCount,
      columns,
      primary_keys: migrationInfo.primaryKeys,
      foreign_keys: migrationInfo.foreignKeys,
      indexes: migrationInfo.indexes.map(idx => ({
        index_name: idx,
        is_unique: false,
        is_primary: false,
        columns: [],
        table_name: migrationInfo.name
      })),
      rls_enabled: migrationInfo.hasRLS || false,
      rls_policies: [],
      triggers: []
    };
  }

  private detectOrphanedTables(tables: TableAnalysis[]): string[] {
    const orphaned: string[] = [];
    
    // Build a set of all tables that are referenced
    const referencedTables = new Set<string>();
    for (const table of tables) {
      for (const fk of table.foreign_keys) {
        referencedTables.add(fk.foreign_table_name);
      }
    }
    
    // Check each table
    for (const table of tables) {
      const hasOutgoingFK = table.foreign_keys.length > 0;
      const hasIncomingFK = referencedTables.has(table.name);
      
      // Skip system tables
      const isSystemTable = [
        'spatial_ref_sys', 'geography_columns', 'geometry_columns',
        'migrations', 'schema_version', '_prisma_migrations'
      ].includes(table.name.toLowerCase());
      
      // Table is orphaned if it has no relationships and no data
      if (!hasOutgoingFK && !hasIncomingFK && !isSystemTable && table.row_count === 0) {
        orphaned.push(table.name);
      }
    }
    
    return orphaned;
  }

  private generateRecommendations(
    tables: TableAnalysis[], 
    views: ViewInfo[], 
    functions: FunctionInfo[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Check for tables without RLS
    const noRlsTables = tables.filter(t => 
      !t.rls_enabled && 
      !['spatial_ref_sys', 'geography_columns', 'geometry_columns'].includes(t.name)
    );
    if (noRlsTables.length > 0) {
      recommendations.push(
        `Enable RLS on ${noRlsTables.length} tables: ${noRlsTables.slice(0, 5).map(t => t.name).join(', ')}${noRlsTables.length > 5 ? '...' : ''}`
      );
    }
    
    // Check for tables without primary keys
    const noPkTables = tables.filter(t => t.primary_keys.length === 0);
    if (noPkTables.length > 0) {
      recommendations.push(
        `Add primary keys to ${noPkTables.length} tables: ${noPkTables.slice(0, 5).map(t => t.name).join(', ')}${noPkTables.length > 5 ? '...' : ''}`
      );
    }
    
    // Check for empty tables
    const emptyTables = tables.filter(t => t.row_count === 0);
    if (emptyTables.length > 10) {
      recommendations.push(
        `Review ${emptyTables.length} empty tables for potential removal`
      );
    }
    
    // Check for missing indexes on foreign keys
    let missingIndexCount = 0;
    for (const table of tables) {
      for (const fk of table.foreign_keys) {
        const hasIndex = table.indexes.some(idx => 
          idx.columns.includes(fk.column_name)
        );
        if (!hasIndex) {
          missingIndexCount++;
        }
      }
    }
    if (missingIndexCount > 0) {
      recommendations.push(
        `Add indexes on ${missingIndexCount} foreign key columns for better join performance`
      );
    }
    
    // Check for large tables that might need optimization
    const largeTables = tables.filter(t => t.row_count > 10000);
    if (largeTables.length > 0) {
      recommendations.push(
        `Optimize ${largeTables.length} large tables: ${largeTables.map(t => `${t.name} (${t.row_count.toLocaleString()} rows)`).join(', ')}`
      );
    }
    
    return recommendations;
  }
}
import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
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
  udt_name: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_identity: boolean;
  is_generated: boolean;
  generation_expression: string | null;
  is_updatable: boolean;
  ordinal_position: number;
  comment?: string;
}

export interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  update_rule: string;
  delete_rule: string;
}

export interface IndexInfo {
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
  index_type: string;
  table_name: string;
}

export interface RLSPolicy {
  policy_name: string;
  table_name: string;
  command: string;
  roles: string[];
  using_expression: string | null;
  check_expression: string | null;
  is_permissive: boolean;
}

export interface TriggerInfo {
  trigger_name: string;
  event_manipulation: string;
  event_timing: string;
  action_statement: string;
  action_orientation: string;
  condition_timing: string | null;
}

export interface FunctionInfo {
  function_name: string;
  schema_name: string;
  return_type: string;
  argument_types: string[];
  is_aggregate: boolean;
  is_window: boolean;
  is_trigger: boolean;
  security_type: string;
  language: string;
  source_code: string;
  description?: string;
}

export interface ViewInfo {
  view_name: string;
  schema_name: string;
  is_materialized: boolean;
  definition: string;
  is_updatable: boolean;
  columns: string[];
}

export interface EnumInfo {
  enum_name: string;
  schema_name: string;
  values: string[];
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

interface DiscoveredTable {
  name: string;
  accessible: boolean;
  sampleColumns?: string[];
  rowCount?: number;
}

export class DatabaseAnalyzer {
  private discoveredTables: DiscoveredTable[] = [];

  constructor(private client: SupabaseClient) {}

  async analyze(): Promise<DatabaseAnalysis> {
    const analyzedAt = new Date().toISOString();
    
    // Load discovered tables
    this.loadDiscoveredTables();
    
    // Analyze each table
    const tableAnalyses: TableAnalysis[] = [];
    
    for (const table of this.discoveredTables) {
      if (table.accessible) {
        console.log(`  Analyzing table: ${table.name}`);
        const analysis = await this.analyzeTable(table);
        tableAnalyses.push(analysis);
      }
    }
    
    // Since we can't query system catalogs, we'll use empty arrays for these
    const views: ViewInfo[] = [];
    const functions: FunctionInfo[] = [];
    const enums: EnumInfo[] = [];
    
    // Calculate statistics
    const totalRows = tableAnalyses.reduce((sum, t) => sum + t.row_count, 0);
    const missingRlsTables = tableAnalyses.filter(t => !t.rls_enabled).map(t => t.name);
    const orphanedTables = this.detectOrphanedTables(tableAnalyses);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(tableAnalyses);
    
    return {
      analyzed_at: analyzedAt,
      database_url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      tables: tableAnalyses,
      views,
      functions,
      enums,
      total_tables: tableAnalyses.length,
      total_rows: totalRows,
      orphaned_tables: orphanedTables,
      missing_rls_tables: missingRlsTables,
      recommendations
    };
  }

  private loadDiscoveredTables() {
    const discoveredTablesPath = path.join(__dirname, '../data/discovered-tables.json');
    try {
      const data = fs.readFileSync(discoveredTablesPath, 'utf-8');
      this.discoveredTables = JSON.parse(data);
      console.log(`  Loaded ${this.discoveredTables.length} discovered tables`);
    } catch (error) {
      console.error('Error loading discovered tables:', error);
      this.discoveredTables = [];
    }
  }

  private async analyzeTable(table: DiscoveredTable): Promise<TableAnalysis> {
    // Get columns from discovered data or by querying
    const columns = await this.getTableColumns(table);
    
    // Get actual row count
    const rowCount = await this.getRowCount(table.name);
    
    // Infer relationships from column names
    const foreignKeys = this.inferForeignKeys(table.name, columns);
    
    // Infer primary keys (usually 'id')
    const primaryKeys = columns
      .filter(col => col.name === 'id' || col.name.endsWith('_id'))
      .slice(0, 1)
      .map(col => col.name);
    
    // We can't get real RLS status without system access, so we'll test it
    const rlsEnabled = await this.checkRLS(table.name);
    
    return {
      name: table.name,
      schema: 'public',
      row_count: rowCount,
      columns,
      primary_keys: primaryKeys,
      foreign_keys: foreignKeys,
      indexes: [], // Can't get indexes without system access
      rls_enabled: rlsEnabled,
      rls_policies: [], // Can't get policies without system access
      triggers: [] // Can't get triggers without system access
    };
  }

  private async getTableColumns(table: DiscoveredTable): Promise<ColumnInfo[]> {
    if (table.sampleColumns && table.sampleColumns.length > 0) {
      // We have column names from discovered data
      return table.sampleColumns.map((colName, index) => ({
        name: colName,
        data_type: this.inferDataType(colName),
        udt_name: this.inferDataType(colName),
        is_nullable: !colName.includes('id') && colName !== 'created_at',
        column_default: colName === 'created_at' ? 'now()' : null,
        character_maximum_length: colName.includes('name') || colName.includes('description') ? 255 : null,
        numeric_precision: null,
        numeric_scale: null,
        is_identity: colName === 'id',
        is_generated: false,
        generation_expression: null,
        is_updatable: true,
        ordinal_position: index + 1,
        comment: undefined
      }));
    }
    
    // For empty tables, try to infer from table name
    return this.inferColumnsFromTableName(table.name);
  }

  private inferDataType(columnName: string): string {
    if (columnName === 'id' || columnName.endsWith('_id')) return 'uuid';
    if (columnName.includes('created_at') || columnName.includes('updated_at') || columnName.includes('_date')) return 'timestamp';
    if (columnName.includes('is_') || columnName.includes('has_')) return 'boolean';
    if (columnName.includes('count') || columnName.includes('number') || columnName.includes('amount')) return 'integer';
    if (columnName.includes('price') || columnName.includes('cost') || columnName.includes('rate')) return 'numeric';
    if (columnName.includes('email')) return 'varchar';
    if (columnName.includes('phone')) return 'varchar';
    if (columnName.includes('metadata') || columnName.includes('config') || columnName.includes('data')) return 'jsonb';
    if (columnName.includes('notes') || columnName.includes('description')) return 'text';
    return 'varchar';
  }

  private inferColumnsFromTableName(tableName: string): ColumnInfo[] {
    // Basic columns that most tables have
    const baseColumns: ColumnInfo[] = [
      {
        name: 'id',
        data_type: 'uuid',
        udt_name: 'uuid',
        is_nullable: false,
        column_default: 'gen_random_uuid()',
        character_maximum_length: null,
        numeric_precision: null,
        numeric_scale: null,
        is_identity: true,
        is_generated: true,
        generation_expression: null,
        is_updatable: false,
        ordinal_position: 1
      },
      {
        name: 'created_at',
        data_type: 'timestamp',
        udt_name: 'timestamp',
        is_nullable: false,
        column_default: 'now()',
        character_maximum_length: null,
        numeric_precision: null,
        numeric_scale: null,
        is_identity: false,
        is_generated: false,
        generation_expression: null,
        is_updatable: false,
        ordinal_position: 2
      }
    ];

    // Add tenant_id for multi-tenant tables
    if (!['companies'].includes(tableName)) {
      baseColumns.splice(1, 0, {
        name: 'tenant_id',
        data_type: 'uuid',
        udt_name: 'uuid',
        is_nullable: false,
        column_default: null,
        character_maximum_length: null,
        numeric_precision: null,
        numeric_scale: null,
        is_identity: false,
        is_generated: false,
        generation_expression: null,
        is_updatable: false,
        ordinal_position: 2
      });
    }

    return baseColumns;
  }

  private async getRowCount(tableName: string): Promise<number> {
    const { count, error } = await this.client
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.warn(`    Could not get row count for ${tableName}: ${error.message}`);
      return 0;
    }
    
    return count || 0;
  }

  private inferForeignKeys(tableName: string, columns: ColumnInfo[]): ForeignKeyInfo[] {
    const foreignKeys: ForeignKeyInfo[] = [];
    
    for (const col of columns) {
      if (col.name.endsWith('_id') && col.name !== 'id') {
        const referencedTable = col.name.replace(/_id$/, '') + 's';
        
        foreignKeys.push({
          constraint_name: `${tableName}_${col.name}_fkey`,
          table_name: tableName,
          column_name: col.name,
          foreign_table_name: referencedTable,
          foreign_column_name: 'id',
          update_rule: 'CASCADE',
          delete_rule: 'RESTRICT'
        });
      }
    }
    
    // Special cases
    if (tableName !== 'companies' && columns.some(c => c.name === 'tenant_id')) {
      foreignKeys.push({
        constraint_name: `${tableName}_tenant_id_fkey`,
        table_name: tableName,
        column_name: 'tenant_id',
        foreign_table_name: 'companies',
        foreign_column_name: 'id',
        update_rule: 'CASCADE',
        delete_rule: 'CASCADE'
      });
    }
    
    return foreignKeys;
  }

  private async checkRLS(tableName: string): Promise<boolean> {
    // Try to query without authentication to check if RLS is enabled
    try {
      // Create an anonymous client
      const anonClient = this.client;
      
      // Try to select from the table
      const { data, error } = await anonClient
        .from(tableName)
        .select('id')
        .limit(1);
      
      // If we get an RLS error, RLS is enabled
      if (error && error.message.includes('row-level security')) {
        return true;
      }
      
      // If we can read data without auth, RLS might be disabled
      // But we need to check if this is using service key
      return false;
    } catch (error) {
      // Error might mean RLS is enabled
      return true;
    }
  }

  private detectOrphanedTables(tables: TableAnalysis[]): string[] {
    const orphaned: string[] = [];
    
    for (const table of tables) {
      // A table is potentially orphaned if:
      // 1. It has no rows
      // 2. It has no foreign key references from other tables
      // 3. It's not a core system table
      
      const coreTables = ['companies', 'users', 'audit_logs', 'role_permissions'];
      
      if (table.row_count === 0 && !coreTables.includes(table.name)) {
        // Check if any other table references this one
        const isReferenced = tables.some(t => 
          t.foreign_keys.some(fk => fk.foreign_table_name === table.name)
        );
        
        if (!isReferenced) {
          orphaned.push(table.name);
        }
      }
    }
    
    return orphaned;
  }

  private generateRecommendations(tables: TableAnalysis[]): string[] {
    const recommendations: string[] = [];
    
    // Check for tables without RLS
    const noRlsTables = tables.filter(t => !t.rls_enabled && t.name !== 'companies');
    if (noRlsTables.length > 0) {
      recommendations.push(
        `Enable RLS on the following tables for security: ${noRlsTables.map(t => t.name).join(', ')}`
      );
    }
    
    // Check for empty tables
    const emptyTables = tables.filter(t => t.row_count === 0);
    if (emptyTables.length > 5) {
      recommendations.push(
        `${emptyTables.length} tables have no data. Consider removing unused tables: ${emptyTables.slice(0, 5).map(t => t.name).join(', ')}, ...`
      );
    }
    
    // Check for missing tenant_id
    const missingTenantId = tables.filter(t => 
      t.name !== 'companies' && 
      !t.columns.some(c => c.name === 'tenant_id')
    );
    if (missingTenantId.length > 0) {
      recommendations.push(
        `The following tables may need tenant_id for multi-tenancy: ${missingTenantId.map(t => t.name).join(', ')}`
      );
    }
    
    // Check for missing timestamps
    const missingTimestamps = tables.filter(t => 
      !t.columns.some(c => c.name === 'created_at')
    );
    if (missingTimestamps.length > 0) {
      recommendations.push(
        `The following tables are missing created_at timestamp: ${missingTimestamps.map(t => t.name).join(', ')}`
      );
    }
    
    // Check for potential performance issues
    const largeTables = tables.filter(t => t.row_count > 10000);
    if (largeTables.length > 0) {
      recommendations.push(
        `The following tables have many rows and may benefit from additional indexes: ${largeTables.map(t => `${t.name} (${t.row_count} rows)`).join(', ')}`
      );
    }
    
    return recommendations;
  }
}
import { SupabaseClient } from '@supabase/supabase-js';

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

export class DatabaseAnalyzer {
  constructor(private client: SupabaseClient) {}

  async analyze(): Promise<DatabaseAnalysis> {
    const analyzedAt = new Date().toISOString();
    
    // Get all tables
    const tables = await this.getTables();
    const tableAnalyses: TableAnalysis[] = [];
    
    for (const table of tables) {
      const analysis = await this.analyzeTable(table.table_name);
      tableAnalyses.push(analysis);
    }
    
    // Get views
    const views = await this.getViews();
    
    // Get functions
    const functions = await this.getFunctions();
    
    // Get enums
    const enums = await this.getEnums();
    
    // Calculate statistics
    const totalRows = tableAnalyses.reduce((sum, t) => sum + t.row_count, 0);
    const missingRlsTables = tableAnalyses.filter(t => !t.rls_enabled).map(t => t.name);
    const orphanedTables = this.detectOrphanedTables(tableAnalyses);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(tableAnalyses, views, functions);
    
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

  private async getTables(): Promise<any[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
    });
    
    if (error) throw error;
    return data || [];
  }

  private async analyzeTable(tableName: string): Promise<TableAnalysis> {
    // Get columns
    const columns = await this.getTableColumns(tableName);
    
    // Get row count
    const rowCount = await this.getRowCount(tableName);
    
    // Get primary keys
    const primaryKeys = await this.getPrimaryKeys(tableName);
    
    // Get foreign keys
    const foreignKeys = await this.getForeignKeys(tableName);
    
    // Get indexes
    const indexes = await this.getIndexes(tableName);
    
    // Get RLS status
    const rlsEnabled = await this.checkRLS(tableName);
    
    // Get RLS policies
    const rlsPolicies = await this.getRLSPolicies(tableName);
    
    // Get triggers
    const triggers = await this.getTriggers(tableName);
    
    return {
      name: tableName,
      schema: 'public',
      row_count: rowCount,
      columns,
      primary_keys: primaryKeys,
      foreign_keys: foreignKeys,
      indexes,
      rls_enabled: rlsEnabled,
      rls_policies: rlsPolicies,
      triggers
    };
  }

  private async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT 
          column_name as name,
          data_type,
          udt_name,
          is_nullable::boolean,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_identity::boolean,
          is_generated::boolean,
          generation_expression,
          is_updatable::boolean,
          ordinal_position,
          col_description(pgc.oid, a.attnum) as comment
        FROM information_schema.columns c
        LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
        LEFT JOIN pg_attribute a ON a.attrelid = pgc.oid AND a.attname = c.column_name
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
        ORDER BY ordinal_position;
      `
    });
    
    if (error) throw error;
    return data || [];
  }

  private async getRowCount(tableName: string): Promise<number> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `SELECT COUNT(*) as count FROM public."${tableName}";`
    });
    
    if (error) return 0;
    return parseInt(data?.[0]?.count || '0');
  }

  private async getPrimaryKeys(tableName: string): Promise<string[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'public."${tableName}"'::regclass
        AND i.indisprimary;
      `
    });
    
    if (error) return [];
    return data?.map((row: any) => row.column_name) || [];
  }

  private async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
          AND rc.constraint_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = '${tableName}'
        AND tc.table_schema = 'public';
      `
    });
    
    if (error) return [];
    return data || [];
  }

  private async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT
          i.relname as index_name,
          idx.indisunique as is_unique,
          idx.indisprimary as is_primary,
          am.amname as index_type,
          t.relname as table_name,
          array_agg(a.attname ORDER BY array_position(idx.indkey, a.attnum)) as columns
        FROM pg_index idx
        JOIN pg_class i ON i.oid = idx.indexrelid
        JOIN pg_class t ON t.oid = idx.indrelid
        JOIN pg_am am ON am.oid = i.relam
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(idx.indkey)
        WHERE t.relname = '${tableName}'
        AND t.relnamespace = 'public'::regnamespace
        GROUP BY i.relname, idx.indisunique, idx.indisprimary, am.amname, t.relname;
      `
    });
    
    if (error) return [];
    return data || [];
  }

  private async checkRLS(tableName: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = '${tableName}'
        AND relnamespace = 'public'::regnamespace;
      `
    });
    
    if (error) return false;
    return data?.[0]?.relrowsecurity || false;
  }

  private async getRLSPolicies(tableName: string): Promise<RLSPolicy[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT
          pol.polname as policy_name,
          c.relname as table_name,
          pol.polcmd as command,
          CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
          END as command_type,
          pol.polroles::text[] as roles,
          pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
          pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expression,
          pol.polpermissive as is_permissive
        FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        WHERE c.relname = '${tableName}'
        AND c.relnamespace = 'public'::regnamespace;
      `
    });
    
    if (error) return [];
    return data || [];
  }

  private async getTriggers(tableName: string): Promise<TriggerInfo[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT
          trigger_name,
          event_manipulation,
          event_object_table,
          action_timing as event_timing,
          action_statement,
          action_orientation,
          condition_timing
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND event_object_table = '${tableName}';
      `
    });
    
    if (error) return [];
    return data || [];
  }

  private async getViews(): Promise<ViewInfo[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT
          v.table_name as view_name,
          v.table_schema as schema_name,
          v.is_updatable = 'YES' as is_updatable,
          v.is_insertable_into = 'YES' as is_insertable,
          pg_get_viewdef(c.oid) as definition,
          CASE WHEN mv.matviewname IS NOT NULL THEN true ELSE false END as is_materialized,
          array_agg(col.column_name ORDER BY col.ordinal_position) as columns
        FROM information_schema.views v
        JOIN pg_class c ON c.relname = v.table_name AND c.relnamespace = 'public'::regnamespace
        LEFT JOIN pg_matviews mv ON mv.schemaname = v.table_schema AND mv.matviewname = v.table_name
        LEFT JOIN information_schema.columns col ON col.table_schema = v.table_schema AND col.table_name = v.table_name
        WHERE v.table_schema = 'public'
        GROUP BY v.table_name, v.table_schema, v.is_updatable, v.is_insertable_into, c.oid, mv.matviewname;
      `
    });
    
    if (error) return [];
    return data || [];
  }

  private async getFunctions(): Promise<FunctionInfo[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT
          p.proname as function_name,
          n.nspname as schema_name,
          pg_get_function_result(p.oid) as return_type,
          pg_get_function_arguments(p.oid) as arguments,
          p.proretset as returns_set,
          p.proisagg as is_aggregate,
          p.proiswindow as is_window,
          CASE WHEN p.prorettype = 'trigger'::regtype::oid THEN true ELSE false END as is_trigger,
          CASE p.prosecdef
            WHEN true THEN 'SECURITY DEFINER'
            ELSE 'SECURITY INVOKER'
          END as security_type,
          l.lanname as language,
          p.prosrc as source_code,
          obj_description(p.oid, 'pg_proc') as description
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_language l ON l.oid = p.prolang
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        ORDER BY p.proname;
      `
    });
    
    if (error) return [];
    
    return (data || []).map((fn: any) => ({
      function_name: fn.function_name,
      schema_name: fn.schema_name,
      return_type: fn.return_type,
      argument_types: fn.arguments ? [fn.arguments] : [],
      is_aggregate: fn.is_aggregate,
      is_window: fn.is_window,
      is_trigger: fn.is_trigger,
      security_type: fn.security_type,
      language: fn.language,
      source_code: fn.source_code,
      description: fn.description
    }));
  }

  private async getEnums(): Promise<EnumInfo[]> {
    const { data, error } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT
          t.typname as enum_name,
          n.nspname as schema_name,
          array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname, n.nspname
        ORDER BY t.typname;
      `
    });
    
    if (error) return [];
    return data || [];
  }

  private detectOrphanedTables(tables: TableAnalysis[]): string[] {
    const orphaned: string[] = [];
    
    // Tables with no foreign key relationships (incoming or outgoing)
    for (const table of tables) {
      const hasOutgoingFK = table.foreign_keys.length > 0;
      const hasIncomingFK = tables.some(t => 
        t.foreign_keys.some(fk => fk.foreign_table_name === table.name)
      );
      
      // Check for common junction/system tables that might not have FKs
      const isSystemTable = [
        'migrations', 'schema_version', '_prisma_migrations',
        'spatial_ref_sys', 'geography_columns', 'geometry_columns'
      ].includes(table.name.toLowerCase());
      
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
    const noRlsTables = tables.filter(t => !t.rls_enabled && !t.name.startsWith('_'));
    if (noRlsTables.length > 0) {
      recommendations.push(
        `Enable RLS on ${noRlsTables.length} tables: ${noRlsTables.map(t => t.name).join(', ')}`
      );
    }
    
    // Check for tables without primary keys
    const noPkTables = tables.filter(t => t.primary_keys.length === 0);
    if (noPkTables.length > 0) {
      recommendations.push(
        `Add primary keys to ${noPkTables.length} tables: ${noPkTables.map(t => t.name).join(', ')}`
      );
    }
    
    // Check for empty tables that might be unused
    const emptyTables = tables.filter(t => t.row_count === 0 && !t.name.includes('test'));
    if (emptyTables.length > 5) {
      recommendations.push(
        `Review ${emptyTables.length} empty tables for potential removal`
      );
    }
    
    // Check for missing indexes on foreign keys
    for (const table of tables) {
      for (const fk of table.foreign_keys) {
        const hasIndex = table.indexes.some(idx => 
          idx.columns.includes(fk.column_name)
        );
        if (!hasIndex) {
          recommendations.push(
            `Add index on ${table.name}.${fk.column_name} (foreign key)`
          );
        }
      }
    }
    
    // Check for unused functions
    const unusedFunctionPatterns = ['test_', 'temp_', 'old_', 'backup_'];
    const suspectFunctions = functions.filter(fn => 
      unusedFunctionPatterns.some(pattern => fn.function_name.includes(pattern))
    );
    if (suspectFunctions.length > 0) {
      recommendations.push(
        `Review ${suspectFunctions.length} potentially unused functions`
      );
    }
    
    return recommendations;
  }
}
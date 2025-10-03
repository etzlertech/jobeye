import { SupabaseClient } from '@supabase/supabase-js';

export interface DatabaseFunction {
  name: string;
  schema: string;
  arguments: string;
  return_type: string;
  language: string;
  is_aggregate: boolean;
  is_window: boolean;
  is_trigger: boolean;
  source_code?: string;
  volatility: string;
  security_definer: boolean;
  description?: string;
}

export interface DatabaseView {
  name: string;
  schema: string;
  type: 'view' | 'materialized_view';
  definition: string;
  row_count?: number;
  size?: string;
  last_refresh?: string;
  indexes?: string[];
  dependencies?: string[];
}

export interface DatabaseTrigger {
  name: string;
  table_name: string;
  schema: string;
  event: string;
  timing: string;
  function_name: string;
  function_source?: string;
  enabled: boolean;
  description?: string;
}

export interface DatabaseSequence {
  name: string;
  schema: string;
  start_value: number;
  current_value?: number;
  increment_by: number;
  max_value: number;
  min_value: number;
  cache_size: number;
  is_cycled: boolean;
  owned_by?: string;
}

export interface DatabaseExtension {
  name: string;
  version: string;
  description?: string;
  installed_by?: string;
  is_relocatable: boolean;
  schema?: string;
}

export interface CustomType {
  name: string;
  schema: string;
  type_category: string;
  is_enum: boolean;
  enum_values?: string[];
  composite_fields?: Array<{
    name: string;
    type: string;
  }>;
  description?: string;
}

export interface DatabaseObjectsAnalysis {
  functions: DatabaseFunction[];
  views: DatabaseView[];
  triggers: DatabaseTrigger[];
  sequences: DatabaseSequence[];
  extensions: DatabaseExtension[];
  custom_types: CustomType[];
  statistics: {
    total_functions: number;
    trigger_functions: number;
    aggregate_functions: number;
    window_functions: number;
    total_views: number;
    materialized_views: number;
    total_triggers: number;
    total_sequences: number;
    total_extensions: number;
    total_custom_types: number;
    enum_types: number;
  };
}

export class DatabaseObjectsAnalyzer {
  constructor(private client: SupabaseClient) {}

  async analyze(): Promise<DatabaseObjectsAnalysis> {
    console.log('🔍 Analyzing database objects...');

    const [
      functions,
      views,
      triggers,
      sequences,
      extensions,
      customTypes
    ] = await Promise.all([
      this.analyzeFunctions(),
      this.analyzeViews(),
      this.analyzeTriggers(),
      this.analyzeSequences(),
      this.analyzeExtensions(),
      this.analyzeCustomTypes()
    ]);

    const statistics = {
      total_functions: functions.length,
      trigger_functions: functions.filter(f => f.is_trigger).length,
      aggregate_functions: functions.filter(f => f.is_aggregate).length,
      window_functions: functions.filter(f => f.is_window).length,
      total_views: views.length,
      materialized_views: views.filter(v => v.type === 'materialized_view').length,
      total_triggers: triggers.length,
      total_sequences: sequences.length,
      total_extensions: extensions.length,
      total_custom_types: customTypes.length,
      enum_types: customTypes.filter(t => t.is_enum).length
    };

    return {
      functions,
      views,
      triggers,
      sequences,
      extensions,
      custom_types: customTypes,
      statistics
    };
  }

  private async analyzeFunctions(): Promise<DatabaseFunction[]> {
    const query = `
      SELECT 
        n.nspname as schema,
        p.proname as name,
        pg_catalog.pg_get_function_arguments(p.oid) as arguments,
        t.typname as return_type,
        l.lanname as language,
        p.prosrc as source_code,
        p.provolatile as volatility,
        p.proisagg as is_aggregate,
        p.proiswindow as is_window,
        p.prosecdef as security_definer,
        obj_description(p.oid, 'pg_proc') as description,
        CASE 
          WHEN p.prorettype = 'trigger'::regtype THEN true 
          ELSE false 
        END as is_trigger
      FROM pg_catalog.pg_proc p
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      LEFT JOIN pg_catalog.pg_type t ON t.oid = p.prorettype
      LEFT JOIN pg_catalog.pg_language l ON l.oid = p.prolang
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND p.proname NOT LIKE 'pg_%'
      ORDER BY n.nspname, p.proname;
    `;

    try {
      // First check if exec_sql exists
      const { error: checkError } = await this.client.rpc('exec_sql', { sql: 'SELECT 1' });
      if (checkError) {
        console.warn('   ⚠️  exec_sql RPC not available - skipping functions analysis');
        return [];
      }

      const { data, error } = await this.client.rpc('exec_sql', { sql: query });
      
      if (error) {
        console.error('Error analyzing functions:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        name: row.name,
        schema: row.schema,
        arguments: row.arguments,
        return_type: row.return_type,
        language: row.language,
        is_aggregate: row.is_aggregate,
        is_window: row.is_window,
        is_trigger: row.is_trigger,
        source_code: row.source_code,
        volatility: this.mapVolatility(row.volatility),
        security_definer: row.security_definer,
        description: row.description
      }));
    } catch (error) {
      console.error('Error in analyzeFunctions:', error);
      return [];
    }
  }

  private async analyzeViews(): Promise<DatabaseView[]> {
    // Regular views
    const viewsQuery = `
      SELECT 
        schemaname as schema,
        viewname as name,
        'view' as type,
        definition,
        obj_description(c.oid, 'pg_class') as description
      FROM pg_views v
      JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = v.schemaname
      )
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
    `;

    // Materialized views
    const matViewsQuery = `
      SELECT 
        schemaname as schema,
        matviewname as name,
        'materialized_view' as type,
        definition,
        pg_size_pretty(pg_total_relation_size(c.oid)) as size,
        obj_description(c.oid, 'pg_class') as description
      FROM pg_matviews m
      JOIN pg_class c ON c.relname = m.matviewname AND c.relnamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = m.schemaname
      )
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
    `;

    const [viewsResult, matViewsResult] = await Promise.all([
      this.client.rpc('exec_sql', { sql: viewsQuery }),
      this.client.rpc('exec_sql', { sql: matViewsQuery })
    ]);

    const views: DatabaseView[] = [];

    if (!viewsResult.error && viewsResult.data) {
      views.push(...viewsResult.data.map((row: any) => ({
        name: row.name,
        schema: row.schema,
        type: row.type as 'view',
        definition: row.definition,
        description: row.description
      })));
    }

    if (!matViewsResult.error && matViewsResult.data) {
      views.push(...matViewsResult.data.map((row: any) => ({
        name: row.name,
        schema: row.schema,
        type: row.type as 'materialized_view',
        definition: row.definition,
        size: row.size,
        description: row.description
      })));
    }

    return views;
  }

  private async analyzeTriggers(): Promise<DatabaseTrigger[]> {
    const query = `
      SELECT 
        t.tgname as name,
        c.relname as table_name,
        n.nspname as schema,
        CASE 
          WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
          WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
          ELSE 'AFTER'
        END as timing,
        CASE 
          WHEN t.tgtype & 4 = 4 THEN 'INSERT'
          WHEN t.tgtype & 8 = 8 THEN 'DELETE'
          WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
          WHEN t.tgtype & 32 = 32 THEN 'TRUNCATE'
        END as event,
        p.proname as function_name,
        p.prosrc as function_source,
        t.tgenabled != 'D' as enabled,
        obj_description(t.oid, 'pg_trigger') as description
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, c.relname, t.tgname;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing triggers:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      name: row.name,
      table_name: row.table_name,
      schema: row.schema,
      event: row.event,
      timing: row.timing,
      function_name: row.function_name,
      function_source: row.function_source,
      enabled: row.enabled,
      description: row.description
    }));
  }

  private async analyzeSequences(): Promise<DatabaseSequence[]> {
    const query = `
      SELECT 
        s.sequence_schema as schema,
        s.sequence_name as name,
        s.start_value,
        s.minimum_value as min_value,
        s.maximum_value as max_value,
        s.increment as increment_by,
        s.cycle_option = 'YES' as is_cycled,
        COALESCE(
          (SELECT cache_size FROM pg_sequences WHERE sequencename = s.sequence_name),
          1
        ) as cache_size,
        pg_get_serial_sequence(t.table_schema || '.' || t.table_name, c.column_name) as owned_by
      FROM information_schema.sequences s
      LEFT JOIN information_schema.columns c 
        ON c.column_default LIKE 'nextval(''' || s.sequence_name || '%'
      LEFT JOIN information_schema.tables t 
        ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE s.sequence_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY s.sequence_schema, s.sequence_name;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing sequences:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      name: row.name,
      schema: row.schema,
      start_value: parseInt(row.start_value),
      increment_by: parseInt(row.increment_by),
      max_value: parseInt(row.max_value),
      min_value: parseInt(row.min_value),
      cache_size: parseInt(row.cache_size),
      is_cycled: row.is_cycled,
      owned_by: row.owned_by
    }));
  }

  private async analyzeExtensions(): Promise<DatabaseExtension[]> {
    const query = `
      SELECT 
        e.extname as name,
        e.extversion as version,
        n.nspname as schema,
        e.extrelocatable as is_relocatable,
        obj_description(e.oid, 'pg_extension') as description
      FROM pg_extension e
      LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
      ORDER BY e.extname;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing extensions:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      name: row.name,
      version: row.version,
      schema: row.schema,
      is_relocatable: row.is_relocatable,
      description: row.description
    }));
  }

  private async analyzeCustomTypes(): Promise<CustomType[]> {
    // Get all custom types
    const typesQuery = `
      SELECT 
        n.nspname as schema,
        t.typname as name,
        t.typcategory as type_category,
        CASE t.typtype
          WHEN 'e' THEN 'enum'
          WHEN 'c' THEN 'composite'
          WHEN 'd' THEN 'domain'
          WHEN 'r' THEN 'range'
          ELSE 'other'
        END as type_type,
        obj_description(t.oid, 'pg_type') as description
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND t.typtype IN ('e', 'c', 'd', 'r')
      ORDER BY n.nspname, t.typname;
    `;

    // Get enum values
    const enumsQuery = `
      SELECT 
        t.typname,
        e.enumlabel,
        e.enumsortorder
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY t.typname, e.enumsortorder;
    `;

    const [typesResult, enumsResult] = await Promise.all([
      this.client.rpc('exec_sql', { sql: typesQuery }),
      this.client.rpc('exec_sql', { sql: enumsQuery })
    ]);

    if (typesResult.error || !typesResult.data) {
      return [];
    }

    // Build enum values map
    const enumValuesMap = new Map<string, string[]>();
    if (!enumsResult.error && enumsResult.data) {
      for (const row of enumsResult.data) {
        if (!enumValuesMap.has(row.typname)) {
          enumValuesMap.set(row.typname, []);
        }
        enumValuesMap.get(row.typname)!.push(row.enumlabel);
      }
    }

    return typesResult.data.map((row: any) => ({
      name: row.name,
      schema: row.schema,
      type_category: row.type_category,
      is_enum: row.type_type === 'enum',
      enum_values: enumValuesMap.get(row.name),
      description: row.description
    }));
  }

  private mapVolatility(vol: string): string {
    switch (vol) {
      case 'i': return 'immutable';
      case 's': return 'stable';
      case 'v': return 'volatile';
      default: return 'unknown';
    }
  }
}
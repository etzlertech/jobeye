import { SupabaseClient } from '@supabase/supabase-js';

export interface TableInfo {
  name: string;
  row_count: number;
  data_size?: string;
  index_size?: string;
  total_size?: string;
  rls_enabled?: boolean;
  has_primary_key?: boolean;
  primary_key_columns?: string[];
  columns?: ColumnInfo[];
  foreign_keys?: ForeignKeyInfo[];
  indexes?: IndexInfo[];
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length: number | null;
}

export interface ForeignKeyInfo {
  constraint_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

export interface IndexInfo {
  index_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

export interface LiveDatabaseAnalysis {
  analyzed_at: string;
  database_url: string;
  total_tables: number;
  total_rows: number;
  total_size: string;
  database_size: number;
  tables: TableInfo[];
  recommendations: string[];
}

export class LiveDatabaseAnalyzer {
  private client: SupabaseClient;
  private discoveredTables: string[] = [];

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async analyze(): Promise<LiveDatabaseAnalysis> {
    console.log('\n📊 Analyzing LIVE database...\n');
    
    // First, discover actual tables
    await this.discoverTablesFromDatabase();
    
    if (this.discoveredTables.length === 0) {
      throw new Error('No tables discovered in the database');
    }

    console.log(`✅ Discovered ${this.discoveredTables.length} actual tables in the database\n`);

    // Analyze each discovered table
    const tableAnalyses: TableInfo[] = [];
    let totalRows = 0;
    let totalSize = 0;

    console.log(`📊 Analyzing ${this.discoveredTables.length} tables from LIVE database...`);
    
    for (let i = 0; i < this.discoveredTables.length; i++) {
      const tableName = this.discoveredTables[i];
      
      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${this.discoveredTables.length} tables analyzed...`);
      }

      try {
        const tableInfo = await this.analyzeTable(tableName);
        tableAnalyses.push(tableInfo);
        totalRows += tableInfo.row_count;
        
        if (tableInfo.total_size) {
          const sizeMatch = tableInfo.total_size.match(/(\d+)/);
          if (sizeMatch) {
            totalSize += parseInt(sizeMatch[1]);
          }
        }
      } catch (error) {
        console.error(`  ⚠️  Error analyzing table ${tableName}:`, error.message);
      }
    }

    console.log(`\n✅ Analysis complete. Processed ${tableAnalyses.length} tables with ${totalRows} total rows.\n`);

    // Sort tables by row count
    tableAnalyses.sort((a, b) => b.row_count - a.row_count);

    return {
      analyzed_at: new Date().toISOString(),
      database_url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'unknown',
      total_tables: tableAnalyses.length,
      total_rows: totalRows,
      total_size: this.formatBytes(totalSize),
      database_size: totalSize,
      tables: tableAnalyses,
      recommendations: this.generateRecommendations(tableAnalyses)
    };
  }

  private async discoverTablesFromDatabase(): Promise<void> {
    console.log('🔍 Discovering tables from LIVE database...\n');
    
    // Method 1: Try using exec_sql with information_schema
    const { data: schemaData, error: schemaError } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
    });

    if (!schemaError && schemaData && schemaData.length > 0) {
      console.log('✅ Retrieved table list from information_schema');
      this.discoveredTables = schemaData.map((row: any) => row.table_name);
      return;
    }

    // Method 2: Try REST API OpenAPI spec
    console.log('⚠️  exec_sql not available, trying REST API approach...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
        if (response.ok) {
          const openApiSpec = await response.json();
          
          if (openApiSpec.definitions) {
            const tableNames = Object.keys(openApiSpec.definitions)
              .filter(name => !name.includes('.'))
              .sort();
            
            if (tableNames.length > 0) {
              console.log('✅ Retrieved table list from REST API');
              this.discoveredTables = tableNames;
              return;
            }
          }
        }
      } catch (error) {
        console.error('  ⚠️  REST API approach failed:', error.message);
      }
    }

    // Method 3: As a last resort, probe common table names
    console.log('⚠️  Falling back to probing common table names...');
    
    const commonTables = [
      'tenants', 'companies', 'customers', 'users', 'jobs', 'properties',
      'equipment', 'materials', 'invoices', 'notifications', 'audit_logs'
    ];
    
    const foundTables: string[] = [];
    
    for (const tableName of commonTables) {
      const { error } = await this.client
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        foundTables.push(tableName);
      }
    }
    
    if (foundTables.length > 0) {
      console.log(`⚠️  Found ${foundTables.length} tables through probing (incomplete list)`);
      this.discoveredTables = foundTables;
    } else {
      throw new Error('Could not discover any tables in the database');
    }
  }

  private async analyzeTable(tableName: string): Promise<TableInfo> {
    const tableInfo: TableInfo = {
      name: tableName,
      row_count: 0,
      rls_enabled: false,
      has_primary_key: false,
      columns: [],
      foreign_keys: [],
      indexes: []
    };

    // Get row count
    const { count, error: countError } = await this.client
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      tableInfo.row_count = count || 0;
    }

    // Try to get table metadata if exec_sql is available
    const { data: metadata, error: metaError } = await this.client.rpc('exec_sql', {
      sql: `
        SELECT 
          pg_relation_size('public.${tableName}') as data_size,
          pg_indexes_size('public.${tableName}') as index_size,
          pg_total_relation_size('public.${tableName}') as total_size,
          relrowsecurity as rls_enabled
        FROM pg_class
        WHERE relname = '${tableName}' AND relnamespace = 'public'::regnamespace;
      `
    });

    if (!metaError && metadata && metadata[0]) {
      const meta = metadata[0];
      tableInfo.data_size = this.formatBytes(meta.data_size);
      tableInfo.index_size = this.formatBytes(meta.index_size);
      tableInfo.total_size = this.formatBytes(meta.total_size);
      tableInfo.rls_enabled = meta.rls_enabled;
    }

    // Get column information
    let columns = null;
    try {
      const { data } = await this.client.rpc('exec_sql', {
        sql: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${tableName}'
          ORDER BY ordinal_position;
        `
      });
      columns = data;
    } catch (e) {
      // exec_sql not available
    }

    if (columns) {
      tableInfo.columns = columns;
    }

    // Check for primary key
    let pkData = null;
    try {
      const { data } = await this.client.rpc('exec_sql', {
        sql: `
          SELECT column_name
          FROM information_schema.key_column_usage
          WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
            AND constraint_name LIKE '%_pkey';
        `
      });
      pkData = data;
    } catch (e) {
      // exec_sql not available
    }

    if (pkData && pkData.length > 0) {
      tableInfo.has_primary_key = true;
      tableInfo.primary_key_columns = pkData.map((row: any) => row.column_name);
    }

    // Get foreign keys
    let fkData = null;
    try {
      const { data } = await this.client.rpc('exec_sql', {
        sql: `
          SELECT 
            kcu.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = '${tableName}';
        `
      });
      fkData = data;
    } catch (e) {
      // exec_sql not available
    }

    if (fkData) {
      tableInfo.foreign_keys = fkData;
    }

    return tableInfo;
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private generateRecommendations(tables: TableInfo[]): string[] {
    const recommendations: string[] = [];

    // Empty tables
    const emptyTables = tables.filter(t => t.row_count === 0);
    if (emptyTables.length > 0) {
      recommendations.push(
        `Review ${emptyTables.length} empty tables for potential removal`
      );
    }

    // Tables without primary keys
    const noPkTables = tables.filter(t => !t.has_primary_key && t.row_count > 0);
    if (noPkTables.length > 0) {
      recommendations.push(
        `Add primary keys to ${noPkTables.length} tables: ${noPkTables.slice(0, 5).map(t => t.name).join(', ')}${noPkTables.length > 5 ? '...' : ''}`
      );
    }

    // Tables without RLS
    const noRlsTables = tables.filter(t => !t.rls_enabled && t.row_count > 0);
    if (noRlsTables.length > 0) {
      recommendations.push(
        `Enable RLS on ${noRlsTables.length} tables containing data`
      );
    }

    return recommendations;
  }
}
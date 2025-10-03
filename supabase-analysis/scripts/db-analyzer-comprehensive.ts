import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface ComprehensiveTableInfo {
  name: string;
  schema: string;
  row_count: number;
  table_size: string;
  indexes_size: string;
  total_size: string;
  has_rls: boolean;
  columns: ColumnDetails[];
  primary_keys: string[];
  foreign_keys: ForeignKeyDetails[];
  indexes: IndexDetails[];
  rls_policies: RLSPolicyDetails[];
  code_references?: number;
  unused?: boolean;
}

interface ColumnDetails {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  max_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  is_identity: boolean;
  identity_generation?: string;
}

interface ForeignKeyDetails {
  constraint_name: string;
  column: string;
  references_table: string;
  references_column: string;
  on_update: string;
  on_delete: string;
}

interface IndexDetails {
  name: string;
  type: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string;
  size: string;
}

interface RLSPolicyDetails {
  name: string;
  command: string;
  permissive: string;
  roles: string[];
  check_expression: string;
  with_check?: string;
}

export class ComprehensiveDatabaseAnalyzer {
  private client: SupabaseClient;
  
  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async analyze(): Promise<any> {
    console.log('🚀 Starting COMPREHENSIVE database analysis...\n');
    console.log('📌 This requires custom RPC functions. Run create-db-info-functions.ts first.\n');
    
    try {
      // Get all tables with basic info
      console.log('📊 Getting table information...');
      const { data: tables, error } = await this.client.rpc('get_table_info');
      
      if (error) {
        console.error('❌ Error getting table info:', error);
        console.log('\n⚠️  Make sure to run: npx tsx scripts/create-db-info-functions.ts\n');
        throw error;
      }

      if (!tables || tables.length === 0) {
        throw new Error('No tables found in database');
      }

      console.log(`✅ Found ${tables.length} tables\n`);

      // Get detailed info for each table
      const detailedTables: ComprehensiveTableInfo[] = [];
      let totalColumns = 0;
      let totalIndexes = 0;
      let totalForeignKeys = 0;
      let totalPolicies = 0;

      for (const table of tables) {
        console.log(`📋 Analyzing ${table.table_name}...`);
        
        const tableInfo: ComprehensiveTableInfo = {
          name: table.table_name,
          schema: table.table_schema,
          row_count: parseInt(table.row_count) || 0,
          table_size: table.table_size,
          indexes_size: table.indexes_size,
          total_size: table.total_size,
          has_rls: table.has_rls,
          columns: [],
          primary_keys: [],
          foreign_keys: [],
          indexes: [],
          rls_policies: []
        };

        // Get columns
        const { data: columns } = await this.client.rpc('get_column_info', {
          p_table_name: table.table_name
        });
        if (columns) {
          tableInfo.columns = columns.map((col: any) => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            default: col.column_default,
            max_length: col.character_maximum_length,
            numeric_precision: col.numeric_precision,
            numeric_scale: col.numeric_scale,
            is_identity: col.is_identity === 'YES',
            identity_generation: col.identity_generation
          }));
          totalColumns += columns.length;
        }

        // Get foreign keys
        const { data: fkeys } = await this.client.rpc('get_foreign_keys', {
          p_table_name: table.table_name
        });
        if (fkeys) {
          tableInfo.foreign_keys = fkeys.map((fk: any) => ({
            constraint_name: fk.constraint_name,
            column: fk.column_name,
            references_table: fk.foreign_table_name,
            references_column: fk.foreign_column_name,
            on_update: fk.on_update,
            on_delete: fk.on_delete
          }));
          totalForeignKeys += fkeys.length;
        }

        // Get indexes
        const { data: indexes } = await this.client.rpc('get_indexes', {
          p_table_name: table.table_name
        });
        if (indexes) {
          tableInfo.indexes = indexes.map((idx: any) => ({
            name: idx.index_name,
            type: idx.index_type,
            is_unique: idx.is_unique,
            is_primary: idx.is_primary,
            columns: idx.columns,
            size: idx.index_size
          }));
          
          // Extract primary key columns
          const pkIndex = indexes.find((idx: any) => idx.is_primary);
          if (pkIndex) {
            tableInfo.primary_keys = pkIndex.columns.split(', ');
          }
          totalIndexes += indexes.length;
        }

        // Get RLS policies
        const { data: policies } = await this.client.rpc('get_rls_policies', {
          p_table_name: table.table_name
        });
        if (policies) {
          tableInfo.rls_policies = policies.map((pol: any) => ({
            name: pol.policy_name,
            command: pol.cmd,
            permissive: pol.permissive,
            roles: pol.roles || [],
            check_expression: pol.qual || '',
            with_check: pol.with_check
          }));
          totalPolicies += policies.length;
        }

        detailedTables.push(tableInfo);
      }

      console.log('\n✅ Analysis complete!\n');

      // Generate comprehensive analysis
      return {
        metadata: {
          analyzed_at: new Date().toISOString(),
          database_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          analyzer_version: '2.0',
          has_introspection_functions: true
        },
        summary: {
          total_tables: detailedTables.length,
          total_rows: detailedTables.reduce((sum, t) => sum + t.row_count, 0),
          total_columns: totalColumns,
          total_indexes: totalIndexes,
          total_foreign_keys: totalForeignKeys,
          total_policies: totalPolicies,
          tables_with_data: detailedTables.filter(t => t.row_count > 0).length,
          tables_with_rls: detailedTables.filter(t => t.has_rls).length,
          tables_with_policies: detailedTables.filter(t => t.rls_policies.length > 0).length
        },
        tables: detailedTables,
        insights: this.generateInsights(detailedTables),
        recommendations: this.generateRecommendations(detailedTables)
      };

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }

  private generateInsights(tables: ComprehensiveTableInfo[]): any {
    return {
      largest_tables: tables
        .filter(t => t.row_count > 0)
        .sort((a, b) => b.row_count - a.row_count)
        .slice(0, 10)
        .map(t => ({ name: t.name, rows: t.row_count, size: t.total_size })),
      
      tables_without_primary_key: tables
        .filter(t => t.primary_keys.length === 0)
        .map(t => t.name),
      
      tables_without_indexes: tables
        .filter(t => t.indexes.length === 0)
        .map(t => t.name),
      
      tables_with_rls_but_no_policies: tables
        .filter(t => t.has_rls && t.rls_policies.length === 0)
        .map(t => t.name),
      
      orphaned_tables: tables
        .filter(t => t.row_count === 0 && t.foreign_keys.length === 0)
        .map(t => t.name),
      
      relationship_map: this.buildRelationshipMap(tables)
    };
  }

  private buildRelationshipMap(tables: ComprehensiveTableInfo[]): any {
    const map: Record<string, any> = {};
    
    for (const table of tables) {
      if (table.foreign_keys.length > 0) {
        map[table.name] = {
          references: table.foreign_keys.map(fk => ({
            table: fk.references_table,
            via: `${fk.column} → ${fk.references_column}`
          })),
          referenced_by: []
        };
      }
    }

    // Build reverse references
    for (const table of tables) {
      for (const fk of table.foreign_keys) {
        if (map[fk.references_table]) {
          map[fk.references_table].referenced_by.push({
            table: table.name,
            via: `${fk.column} ← ${fk.references_column}`
          });
        }
      }
    }

    return map;
  }

  private generateRecommendations(tables: ComprehensiveTableInfo[]): string[] {
    const recommendations: string[] = [];

    // Missing primary keys
    const noPK = tables.filter(t => t.primary_keys.length === 0 && t.row_count > 0);
    if (noPK.length > 0) {
      recommendations.push(
        `🔑 Add primary keys to ${noPK.length} tables: ${noPK.slice(0, 5).map(t => t.name).join(', ')}${noPK.length > 5 ? '...' : ''}`
      );
    }

    // RLS without policies
    const rlsNoPolicies = tables.filter(t => t.has_rls && t.rls_policies.length === 0);
    if (rlsNoPolicies.length > 0) {
      recommendations.push(
        `🔒 Add RLS policies to ${rlsNoPolicies.length} tables with RLS enabled but no policies`
      );
    }

    // Tables without RLS
    const noRLS = tables.filter(t => !t.has_rls && t.row_count > 0);
    if (noRLS.length > 0) {
      recommendations.push(
        `🛡️ Enable RLS on ${noRLS.length} tables containing data`
      );
    }

    // Large tables without indexes
    const largeNoIndex = tables.filter(t => t.row_count > 1000 && t.indexes.filter(i => !i.is_primary).length === 0);
    if (largeNoIndex.length > 0) {
      recommendations.push(
        `📈 Add indexes to ${largeNoIndex.length} large tables with 1000+ rows`
      );
    }

    // Orphaned tables
    const orphaned = tables.filter(t => t.row_count === 0 && t.foreign_keys.length === 0);
    if (orphaned.length > 5) {
      recommendations.push(
        `🗑️ Consider removing ${orphaned.length} empty orphaned tables`
      );
    }

    return recommendations;
  }
}
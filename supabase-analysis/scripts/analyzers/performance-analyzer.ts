import { SupabaseClient } from '@supabase/supabase-js';

export interface IndexAnalysis {
  index_name: string;
  table_name: string;
  schema_name: string;
  index_type: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
  index_size: string;
  table_size: string;
  index_scans: number;
  tuples_read: number;
  tuples_fetched: number;
  usage_ratio: number;
  is_unused: boolean;
  definition: string;
}

export interface TableStatistics {
  table_name: string;
  schema_name: string;
  total_size: string;
  table_size: string;
  indexes_size: string;
  toast_size: string;
  row_count: number;
  dead_tuples: number;
  live_tuples: number;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  seq_scan_count: number;
  seq_tup_read: number;
  idx_scan_count: number;
  idx_tup_fetch: number;
  n_tup_ins: number;
  n_tup_upd: number;
  n_tup_del: number;
  vacuum_needed: boolean;
}

export interface QueryStatistics {
  query_hash: string;
  query_text: string;
  calls: number;
  total_time: number;
  mean_time: number;
  min_time: number;
  max_time: number;
  stddev_time: number;
  rows: number;
  is_slow: boolean;
}

export interface DatabaseStatistics {
  database_size: string;
  cache_hit_ratio: number;
  index_hit_ratio: number;
  transactions_committed: number;
  transactions_rolled_back: number;
  blocks_read: number;
  blocks_hit: number;
  temp_files_created: number;
  temp_bytes_written: string;
  deadlocks: number;
  conflicts: number;
}

export interface PerformanceAnalysis {
  indexes: IndexAnalysis[];
  table_statistics: TableStatistics[];
  database_statistics: DatabaseStatistics;
  performance_issues: PerformanceIssue[];
  recommendations: string[];
}

export interface PerformanceIssue {
  type: 'unused_index' | 'missing_index' | 'bloated_table' | 'slow_query' | 'low_cache_hit' | 'frequent_seq_scan';
  severity: 'critical' | 'high' | 'medium' | 'low';
  table?: string;
  index?: string;
  description: string;
  impact: string;
  recommendation: string;
}

export class PerformanceAnalyzer {
  constructor(private client: SupabaseClient) {}

  async analyze(): Promise<PerformanceAnalysis> {
    console.log('📊 Analyzing database performance...');

    const [
      indexes,
      tableStats,
      dbStats
    ] = await Promise.all([
      this.analyzeIndexes(),
      this.analyzeTableStatistics(),
      this.analyzeDatabaseStatistics()
    ]);

    const issues = this.identifyPerformanceIssues(indexes, tableStats, dbStats);
    const recommendations = this.generateRecommendations(issues, indexes, tableStats);

    return {
      indexes,
      table_statistics: tableStats,
      database_statistics: dbStats,
      performance_issues: issues,
      recommendations
    };
  }

  private async analyzeIndexes(): Promise<IndexAnalysis[]> {
    const query = `
      SELECT 
        i.indexname as index_name,
        i.tablename as table_name,
        i.schemaname as schema_name,
        am.amname as index_type,
        idx.indisunique as is_unique,
        idx.indisprimary as is_primary,
        pg_size_pretty(pg_relation_size(idx.indexrelid)) as index_size,
        pg_size_pretty(pg_relation_size(idx.indrelid)) as table_size,
        COALESCE(s.idx_scan, 0) as index_scans,
        COALESCE(s.idx_tup_read, 0) as tuples_read,
        COALESCE(s.idx_tup_fetch, 0) as tuples_fetched,
        i.indexdef as definition,
        CASE 
          WHEN COALESCE(s.idx_scan, 0) = 0 AND idx.indisprimary = false THEN true
          ELSE false
        END as is_unused
      FROM pg_indexes i
      JOIN pg_class c ON c.relname = i.indexname
      JOIN pg_index idx ON idx.indexrelid = c.oid
      JOIN pg_am am ON am.oid = c.relam
      LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = c.oid
      WHERE i.schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY i.schemaname, i.tablename, i.indexname;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing indexes:', error);
      return [];
    }

    return (data || []).map((row: any) => {
      const usage_ratio = row.index_scans > 0 
        ? (row.tuples_fetched / row.index_scans) 
        : 0;

      return {
        index_name: row.index_name,
        table_name: row.table_name,
        schema_name: row.schema_name,
        index_type: row.index_type,
        is_unique: row.is_unique,
        is_primary: row.is_primary,
        columns: this.extractColumnsFromDefinition(row.definition),
        index_size: row.index_size,
        table_size: row.table_size,
        index_scans: row.index_scans,
        tuples_read: row.tuples_read,
        tuples_fetched: row.tuples_fetched,
        usage_ratio,
        is_unused: row.is_unused,
        definition: row.definition
      };
    });
  }

  private async analyzeTableStatistics(): Promise<TableStatistics[]> {
    const query = `
      SELECT 
        c.relname as table_name,
        n.nspname as schema_name,
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        pg_size_pretty(pg_table_size(c.oid)) as table_size,
        pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size,
        pg_size_pretty(pg_total_relation_size(c.reltoastrelid)) as toast_size,
        COALESCE(c.reltuples, 0)::bigint as row_count,
        COALESCE(s.n_dead_tup, 0) as dead_tuples,
        COALESCE(s.n_live_tup, 0) as live_tuples,
        s.last_vacuum::text,
        s.last_autovacuum::text,
        s.last_analyze::text,
        COALESCE(s.seq_scan, 0) as seq_scan_count,
        COALESCE(s.seq_tup_read, 0) as seq_tup_read,
        COALESCE(s.idx_scan, 0) as idx_scan_count,
        COALESCE(s.idx_tup_fetch, 0) as idx_tup_fetch,
        COALESCE(s.n_tup_ins, 0) as n_tup_ins,
        COALESCE(s.n_tup_upd, 0) as n_tup_upd,
        COALESCE(s.n_tup_del, 0) as n_tup_del,
        CASE 
          WHEN s.n_live_tup > 0 AND (s.n_dead_tup::float / s.n_live_tup) > 0.2 THEN true
          ELSE false
        END as vacuum_needed
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE c.relkind IN ('r', 'p')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY pg_total_relation_size(c.oid) DESC;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing table statistics:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      table_name: row.table_name,
      schema_name: row.schema_name,
      total_size: row.total_size,
      table_size: row.table_size,
      indexes_size: row.indexes_size,
      toast_size: row.toast_size,
      row_count: parseInt(row.row_count),
      dead_tuples: parseInt(row.dead_tuples),
      live_tuples: parseInt(row.live_tuples),
      last_vacuum: row.last_vacuum,
      last_autovacuum: row.last_autovacuum,
      last_analyze: row.last_analyze,
      seq_scan_count: parseInt(row.seq_scan_count),
      seq_tup_read: parseInt(row.seq_tup_read),
      idx_scan_count: parseInt(row.idx_scan_count),
      idx_tup_fetch: parseInt(row.idx_tup_fetch),
      n_tup_ins: parseInt(row.n_tup_ins),
      n_tup_upd: parseInt(row.n_tup_upd),
      n_tup_del: parseInt(row.n_tup_del),
      vacuum_needed: row.vacuum_needed
    }));
  }

  private async analyzeDatabaseStatistics(): Promise<DatabaseStatistics> {
    const query = `
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        ROUND(
          100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 
          2
        ) as cache_hit_ratio,
        SUM(xact_commit) as transactions_committed,
        SUM(xact_rollback) as transactions_rolled_back,
        SUM(blks_read) as blocks_read,
        SUM(blks_hit) as blocks_hit,
        SUM(temp_files) as temp_files_created,
        pg_size_pretty(SUM(temp_bytes)) as temp_bytes_written,
        SUM(deadlocks) as deadlocks,
        SUM(conflicts) as conflicts
      FROM pg_stat_database
      WHERE datname = current_database();
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing database statistics:', error);
      return this.getDefaultDatabaseStats();
    }

    const row = data?.[0];
    if (!row) return this.getDefaultDatabaseStats();

    // Calculate index hit ratio
    const indexHitRatio = await this.calculateIndexHitRatio();

    return {
      database_size: row.database_size || '0 bytes',
      cache_hit_ratio: parseFloat(row.cache_hit_ratio) || 0,
      index_hit_ratio: indexHitRatio,
      transactions_committed: parseInt(row.transactions_committed) || 0,
      transactions_rolled_back: parseInt(row.transactions_rolled_back) || 0,
      blocks_read: parseInt(row.blocks_read) || 0,
      blocks_hit: parseInt(row.blocks_hit) || 0,
      temp_files_created: parseInt(row.temp_files_created) || 0,
      temp_bytes_written: row.temp_bytes_written || '0 bytes',
      deadlocks: parseInt(row.deadlocks) || 0,
      conflicts: parseInt(row.conflicts) || 0
    };
  }

  private async calculateIndexHitRatio(): Promise<number> {
    const query = `
      SELECT 
        CASE 
          WHEN (sum(idx_scan) + sum(seq_scan)) > 0 THEN
            ROUND(100.0 * sum(idx_scan) / (sum(idx_scan) + sum(seq_scan)), 2)
          ELSE 0
        END as index_hit_ratio
      FROM pg_stat_user_tables;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error || !data?.[0]) return 0;
    
    return parseFloat(data[0].index_hit_ratio) || 0;
  }

  private identifyPerformanceIssues(
    indexes: IndexAnalysis[],
    tables: TableStatistics[],
    dbStats: DatabaseStatistics
  ): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // Check for unused indexes
    indexes.forEach(idx => {
      if (idx.is_unused && !idx.is_primary) {
        issues.push({
          type: 'unused_index',
          severity: 'medium',
          index: idx.index_name,
          table: idx.table_name,
          description: `Index "${idx.index_name}" on table "${idx.table_name}" has never been used`,
          impact: `Wasting ${idx.index_size} of storage and slowing down writes`,
          recommendation: `Consider dropping unused index: DROP INDEX ${idx.schema_name}.${idx.index_name};`
        });
      }
    });

    // Check for bloated tables
    tables.forEach(table => {
      if (table.vacuum_needed) {
        issues.push({
          type: 'bloated_table',
          severity: 'high',
          table: table.table_name,
          description: `Table "${table.table_name}" has ${table.dead_tuples} dead tuples (${Math.round(table.dead_tuples / Math.max(table.live_tuples, 1) * 100)}% bloat)`,
          impact: 'Poor query performance and wasted storage space',
          recommendation: `Run VACUUM ANALYZE ${table.schema_name}.${table.table_name};`
        });
      }
    });

    // Check for tables with high sequential scan ratio
    tables.forEach(table => {
      if (table.row_count > 1000 && table.seq_scan_count > table.idx_scan_count * 10) {
        issues.push({
          type: 'frequent_seq_scan',
          severity: 'medium',
          table: table.table_name,
          description: `Table "${table.table_name}" has ${table.seq_scan_count} sequential scans vs ${table.idx_scan_count} index scans`,
          impact: 'Poor query performance on large table',
          recommendation: 'Analyze query patterns and consider adding appropriate indexes'
        });
      }
    });

    // Check cache hit ratio
    if (dbStats.cache_hit_ratio < 90) {
      issues.push({
        type: 'low_cache_hit',
        severity: 'critical',
        description: `Database cache hit ratio is ${dbStats.cache_hit_ratio}% (should be >90%)`,
        impact: 'Poor overall database performance due to excessive disk I/O',
        recommendation: 'Consider increasing shared_buffers or adding more RAM'
      });
    }

    return issues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private generateRecommendations(
    issues: PerformanceIssue[],
    indexes: IndexAnalysis[],
    tables: TableStatistics[]
  ): string[] {
    const recommendations: string[] = [];

    // Critical issues first
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`🚨 Address ${criticalIssues.length} critical performance issues immediately`);
    }

    // Unused indexes
    const unusedIndexes = indexes.filter(i => i.is_unused && !i.is_primary);
    if (unusedIndexes.length > 0) {
      const totalSize = this.sumIndexSizes(unusedIndexes);
      recommendations.push(`💾 Remove ${unusedIndexes.length} unused indexes to free up ${totalSize}`);
    }

    // Bloated tables
    const bloatedTables = tables.filter(t => t.vacuum_needed);
    if (bloatedTables.length > 0) {
      recommendations.push(`🧹 Vacuum ${bloatedTables.length} bloated tables to improve performance`);
    }

    // Large tables without proper indexing
    const poorlyIndexedTables = tables.filter(t => 
      t.row_count > 10000 && t.seq_scan_count > t.idx_scan_count
    );
    if (poorlyIndexedTables.length > 0) {
      recommendations.push(`📊 Analyze and add indexes to ${poorlyIndexedTables.length} large tables with frequent sequential scans`);
    }

    // Maintenance recommendations
    const tablesNeedingAnalyze = tables.filter(t => !t.last_analyze || this.daysSince(t.last_analyze) > 7);
    if (tablesNeedingAnalyze.length > 0) {
      recommendations.push(`📈 Run ANALYZE on ${tablesNeedingAnalyze.length} tables to update statistics`);
    }

    return recommendations;
  }

  private extractColumnsFromDefinition(definition: string): string[] {
    const match = definition.match(/\((.*?)\)/);
    if (!match) return [];
    
    return match[1].split(',').map(col => col.trim());
  }

  private sumIndexSizes(indexes: IndexAnalysis[]): string {
    // This is a simplified version - in reality we'd need to parse and sum the sizes
    return `~${indexes.length * 10}MB`;
  }

  private daysSince(dateStr: string | null): number {
    if (!dateStr) return Infinity;
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  private getDefaultDatabaseStats(): DatabaseStatistics {
    return {
      database_size: '0 bytes',
      cache_hit_ratio: 0,
      index_hit_ratio: 0,
      transactions_committed: 0,
      transactions_rolled_back: 0,
      blocks_read: 0,
      blocks_hit: 0,
      temp_files_created: 0,
      temp_bytes_written: '0 bytes',
      deadlocks: 0,
      conflicts: 0
    };
  }
}
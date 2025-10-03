import { SupabaseClient } from '@supabase/supabase-js';

export interface RealtimePublication {
  publication_name: string;
  table_name: string;
  schema_name: string;
  publish_insert: boolean;
  publish_update: boolean;
  publish_delete: boolean;
  created_at?: string;
  row_count: number;
  estimated_message_rate?: number;
}

export interface RealtimeChannel {
  name: string;
  tables: string[];
  broadcast_enabled: boolean;
  presence_enabled: boolean;
  estimated_subscribers?: number;
}

export interface RealtimeAnalysis {
  publications: RealtimePublication[];
  potential_channels: RealtimeChannel[];
  statistics: {
    total_publications: number;
    tables_with_realtime: number;
    insert_enabled_count: number;
    update_enabled_count: number;
    delete_enabled_count: number;
    high_traffic_tables: number;
    total_estimated_messages: number;
  };
  issues: RealtimeIssue[];
  recommendations: string[];
}

export interface RealtimeIssue {
  type: 'high_traffic' | 'no_filters' | 'all_operations' | 'large_payload' | 'unused_publication';
  severity: 'high' | 'medium' | 'low';
  table?: string;
  description: string;
  impact: string;
  recommendation: string;
}

export class RealtimeAnalyzer {
  constructor(private client: SupabaseClient) {}

  async analyze(tables: any[]): Promise<RealtimeAnalysis> {
    console.log('📡 Analyzing Realtime subscriptions...');

    // Get realtime publications
    const publications = await this.analyzePublications(tables);
    
    // Analyze potential channels based on table relationships
    const potentialChannels = this.analyzePotentialChannels(tables, publications);
    
    // Identify issues
    const issues = this.identifyIssues(publications, tables);
    
    // Generate statistics
    const statistics = this.generateStatistics(publications);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, publications, statistics);

    return {
      publications,
      potential_channels: potentialChannels,
      statistics,
      issues,
      recommendations
    };
  }

  private async analyzePublications(tables: any[]): Promise<RealtimePublication[]> {
    // First, try to get actual publication info
    const publicationsQuery = `
      SELECT 
        p.pubname as publication_name,
        t.schemaname as schema_name,
        t.tablename as table_name,
        p.pubinsert as publish_insert,
        p.pubupdate as publish_update,
        p.pubdelete as publish_delete
      FROM pg_publication p
      CROSS JOIN pg_publication_tables t
      WHERE t.pubname = p.pubname
        AND p.pubname = 'supabase_realtime'
      ORDER BY t.schemaname, t.tablename;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: publicationsQuery });
    
    if (error) {
      // Fallback to checking the realtime schema
      return this.analyzeRealtimeFallback(tables);
    }

    // Enhance with table data
    const tableMap = new Map(tables.map(t => [`${t.schema}.${t.name}`, t]));
    
    return (data || []).map((row: any) => {
      const tableKey = `${row.schema_name}.${row.table_name}`;
      const table = tableMap.get(tableKey);
      
      return {
        publication_name: row.publication_name,
        table_name: row.table_name,
        schema_name: row.schema_name,
        publish_insert: row.publish_insert,
        publish_update: row.publish_update,
        publish_delete: row.publish_delete,
        row_count: table?.row_count || 0,
        estimated_message_rate: this.estimateMessageRate(table)
      };
    });
  }

  private async analyzeRealtimeFallback(tables: any[]): Promise<RealtimePublication[]> {
    // Try alternative method - check replica identity
    const replicaQuery = `
      SELECT 
        c.relname as table_name,
        n.nspname as schema_name,
        c.relreplident as replica_identity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND c.relreplident != 'n'
      ORDER BY n.nspname, c.relname;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: replicaQuery });
    
    if (error || !data) return [];

    const tableMap = new Map(tables.map(t => [`${t.schema}.${t.name}`, t]));
    
    return data.map((row: any) => {
      const tableKey = `${row.schema_name}.${row.table_name}`;
      const table = tableMap.get(tableKey);
      
      return {
        publication_name: 'supabase_realtime',
        table_name: row.table_name,
        schema_name: row.schema_name,
        publish_insert: true,
        publish_update: true,
        publish_delete: true,
        row_count: table?.row_count || 0,
        estimated_message_rate: this.estimateMessageRate(table)
      };
    });
  }

  private estimateMessageRate(table: any): number {
    if (!table) return 0;
    
    // Estimate based on table activity (very rough estimate)
    // In reality, you'd want to analyze pg_stat_user_tables for actual rates
    const size = table.row_count || 0;
    
    if (size > 100000) return 1000; // High traffic
    if (size > 10000) return 100;   // Medium traffic
    if (size > 1000) return 10;     // Low traffic
    return 1;                       // Minimal traffic
  }

  private analyzePotentialChannels(
    tables: any[],
    publications: RealtimePublication[]
  ): RealtimeChannel[] {
    const channels: RealtimeChannel[] = [];
    
    // Group tables by common patterns
    const patterns = [
      { name: 'user-activity', pattern: /user|profile|session/ },
      { name: 'chat-messages', pattern: /message|chat|conversation/ },
      { name: 'notifications', pattern: /notification|alert|queue/ },
      { name: 'jobs-tracking', pattern: /job|task|work|assignment/ },
      { name: 'inventory-updates', pattern: /inventory|stock|equipment|material/ },
      { name: 'location-tracking', pattern: /location|position|gps|tracking/ }
    ];

    const publishedTables = new Set(publications.map(p => p.table_name));

    patterns.forEach(({ name, pattern }) => {
      const matchingTables = tables
        .filter(t => pattern.test(t.name) && publishedTables.has(t.name))
        .map(t => t.name);
      
      if (matchingTables.length > 0) {
        channels.push({
          name,
          tables: matchingTables,
          broadcast_enabled: false,
          presence_enabled: name.includes('chat') || name.includes('activity'),
          estimated_subscribers: this.estimateSubscribers(name)
        });
      }
    });

    return channels;
  }

  private estimateSubscribers(channelName: string): number {
    // Rough estimates based on channel type
    const estimates: Record<string, number> = {
      'user-activity': 100,
      'chat-messages': 50,
      'notifications': 200,
      'jobs-tracking': 30,
      'inventory-updates': 10,
      'location-tracking': 20
    };
    
    return estimates[channelName] || 10;
  }

  private identifyIssues(
    publications: RealtimePublication[],
    tables: any[]
  ): RealtimeIssue[] {
    const issues: RealtimeIssue[] = [];
    
    publications.forEach(pub => {
      const table = tables.find(t => t.name === pub.table_name);
      
      // Check for high traffic tables
      if (pub.estimated_message_rate && pub.estimated_message_rate > 100) {
        issues.push({
          type: 'high_traffic',
          severity: 'high',
          table: pub.table_name,
          description: `Table "${pub.table_name}" may generate ${pub.estimated_message_rate} messages/second`,
          impact: 'High realtime traffic can impact performance and costs',
          recommendation: 'Consider using filters or throttling for high-frequency updates'
        });
      }
      
      // Check for tables publishing all operations
      if (pub.publish_insert && pub.publish_update && pub.publish_delete) {
        issues.push({
          type: 'all_operations',
          severity: 'medium',
          table: pub.table_name,
          description: `Table "${pub.table_name}" publishes all operation types`,
          impact: 'May send unnecessary messages for operations not needed by clients',
          recommendation: 'Consider limiting to only required operations (e.g., only inserts for logs)'
        });
      }
      
      // Check for large payload potential
      if (table && table.columns && table.columns.length > 20) {
        issues.push({
          type: 'large_payload',
          severity: 'medium',
          table: pub.table_name,
          description: `Table "${pub.table_name}" has ${table.columns.length} columns`,
          impact: 'Large payloads increase bandwidth usage and latency',
          recommendation: 'Consider creating views with only necessary columns for realtime'
        });
      }
      
      // Check for potentially unused publications
      if (pub.row_count === 0) {
        issues.push({
          type: 'unused_publication',
          severity: 'low',
          table: pub.table_name,
          description: `Table "${pub.table_name}" has realtime enabled but no data`,
          impact: 'Unnecessary realtime configuration',
          recommendation: 'Remove realtime publication if table is not actively used'
        });
      }
    });
    
    return issues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private generateStatistics(
    publications: RealtimePublication[]
  ): RealtimeAnalysis['statistics'] {
    const insertEnabled = publications.filter(p => p.publish_insert).length;
    const updateEnabled = publications.filter(p => p.publish_update).length;
    const deleteEnabled = publications.filter(p => p.publish_delete).length;
    const highTraffic = publications.filter(p => 
      p.estimated_message_rate && p.estimated_message_rate > 100
    ).length;
    const totalMessages = publications.reduce((sum, p) => 
      sum + (p.estimated_message_rate || 0), 0
    );

    return {
      total_publications: publications.length,
      tables_with_realtime: publications.length,
      insert_enabled_count: insertEnabled,
      update_enabled_count: updateEnabled,
      delete_enabled_count: deleteEnabled,
      high_traffic_tables: highTraffic,
      total_estimated_messages: Math.round(totalMessages)
    };
  }

  private generateRecommendations(
    issues: RealtimeIssue[],
    publications: RealtimePublication[],
    statistics: RealtimeAnalysis['statistics']
  ): string[] {
    const recommendations: string[] = [];
    
    // High traffic concerns
    if (statistics.high_traffic_tables > 0) {
      recommendations.push(
        `⚡ Optimize ${statistics.high_traffic_tables} high-traffic tables with filters or throttling`
      );
    }
    
    // Cost optimization
    if (statistics.total_estimated_messages > 1000) {
      recommendations.push(
        '💰 Consider implementing client-side filtering to reduce realtime message costs'
      );
    }
    
    // Selective operations
    const allOpsCount = publications.filter(p => 
      p.publish_insert && p.publish_update && p.publish_delete
    ).length;
    if (allOpsCount > publications.length / 2) {
      recommendations.push(
        '🎯 Configure tables to publish only necessary operations (INSERT, UPDATE, or DELETE)'
      );
    }
    
    // Security considerations
    if (publications.length > 0) {
      recommendations.push(
        '🔒 Ensure RLS policies are properly configured for all realtime-enabled tables'
      );
    }
    
    // Performance tips
    if (publications.some(p => p.row_count > 100000)) {
      recommendations.push(
        '📊 For large tables, consider using database triggers to publish to specific channels'
      );
    }
    
    // Monitoring
    recommendations.push(
      '📡 Set up monitoring for realtime connection counts and message rates'
    );
    
    return recommendations;
  }
}
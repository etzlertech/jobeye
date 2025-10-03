import { SupabaseClient } from '@supabase/supabase-js';
import { LiveDatabaseAnalyzer } from './db-analyzer-live';
import { StorageAnalyzer } from './storage-analyzer';
import { DatabaseObjectsAnalyzer } from './analyzers/database-objects-analyzer';
import { PerformanceAnalyzer } from './analyzers/performance-analyzer';
import { SecurityAnalyzer } from './analyzers/security-analyzer';
import { EdgeFunctionsAnalyzer } from './analyzers/edge-functions-analyzer';
import { RealtimeAnalyzer } from './analyzers/realtime-analyzer';

export interface EnhancedDatabaseAnalysis {
  basic: any; // From LiveDatabaseAnalyzer
  storage: any; // From StorageAnalyzer
  objects: any; // From DatabaseObjectsAnalyzer
  performance: any; // From PerformanceAnalyzer
  security: any; // From SecurityAnalyzer
  edge_functions: any; // From EdgeFunctionsAnalyzer
  realtime: any; // From RealtimeAnalyzer
  metadata: {
    analyzed_at: string;
    analysis_version: string;
    total_analysis_time: number;
    warnings: string[];
  };
}

export class EnhancedDatabaseAnalyzer {
  private basicAnalyzer: LiveDatabaseAnalyzer;
  private storageAnalyzer: StorageAnalyzer;
  private objectsAnalyzer: DatabaseObjectsAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private securityAnalyzer: SecurityAnalyzer;
  private edgeFunctionsAnalyzer: EdgeFunctionsAnalyzer;
  private realtimeAnalyzer: RealtimeAnalyzer;

  constructor(
    private client: SupabaseClient,
    private projectRef?: string,
    private managementApiKey?: string
  ) {
    this.basicAnalyzer = new LiveDatabaseAnalyzer(client);
    this.storageAnalyzer = new StorageAnalyzer(client);
    this.objectsAnalyzer = new DatabaseObjectsAnalyzer(client);
    this.performanceAnalyzer = new PerformanceAnalyzer(client);
    this.securityAnalyzer = new SecurityAnalyzer(client);
    this.edgeFunctionsAnalyzer = new EdgeFunctionsAnalyzer(client, projectRef, managementApiKey);
    this.realtimeAnalyzer = new RealtimeAnalyzer(client);
  }

  async analyze(): Promise<EnhancedDatabaseAnalysis> {
    console.log('🚀 Starting Enhanced Supabase Analysis');
    console.log('=====================================\n');

    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Run basic analysis first (we need table data for other analyzers)
      console.log('1️⃣ Running basic database analysis...');
      const basicAnalysis = await this.basicAnalyzer.analyze();
      console.log(`   ✅ Found ${basicAnalysis.tables.length} tables\n`);

      // Run all other analyses in parallel
      console.log('2️⃣ Running enhanced analyses in parallel...');
      const [
        storageAnalysis,
        objectsAnalysis,
        performanceAnalysis,
        securityAnalysis,
        edgeFunctionsAnalysis,
        realtimeAnalysis
      ] = await Promise.allSettled([
        this.runWithWarning('Storage', () => this.storageAnalyzer.analyze(), warnings),
        this.runWithWarning('Database Objects', () => this.objectsAnalyzer.analyze(), warnings),
        this.runWithWarning('Performance', () => this.performanceAnalyzer.analyze(), warnings),
        this.runWithWarning('Security', () => this.securityAnalyzer.analyze(basicAnalysis.tables), warnings),
        this.runWithWarning('Edge Functions', () => this.edgeFunctionsAnalyzer.analyze(), warnings),
        this.runWithWarning('Realtime', () => this.realtimeAnalyzer.analyze(basicAnalysis.tables), warnings)
      ]);

      const totalTime = Date.now() - startTime;

      // Display summary
      this.displayAnalysisSummary({
        basic: basicAnalysis,
        objects: objectsAnalysis.status === 'fulfilled' ? objectsAnalysis.value : null,
        performance: performanceAnalysis.status === 'fulfilled' ? performanceAnalysis.value : null,
        security: securityAnalysis.status === 'fulfilled' ? securityAnalysis.value : null,
        edge_functions: edgeFunctionsAnalysis.status === 'fulfilled' ? edgeFunctionsAnalysis.value : null,
        realtime: realtimeAnalysis.status === 'fulfilled' ? realtimeAnalysis.value : null
      });

      return {
        basic: basicAnalysis,
        storage: storageAnalysis.status === 'fulfilled' ? storageAnalysis.value : null,
        objects: objectsAnalysis.status === 'fulfilled' ? objectsAnalysis.value : null,
        performance: performanceAnalysis.status === 'fulfilled' ? performanceAnalysis.value : null,
        security: securityAnalysis.status === 'fulfilled' ? securityAnalysis.value : null,
        edge_functions: edgeFunctionsAnalysis.status === 'fulfilled' ? edgeFunctionsAnalysis.value : null,
        realtime: realtimeAnalysis.status === 'fulfilled' ? realtimeAnalysis.value : null,
        metadata: {
          analyzed_at: new Date().toISOString(),
          analysis_version: '2.0.0',
          total_analysis_time: totalTime,
          warnings
        }
      };
    } catch (error) {
      console.error('Fatal error during analysis:', error);
      throw error;
    }
  }

  private async runWithWarning<T>(
    name: string,
    fn: () => Promise<T>,
    warnings: string[]
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const message = `${name} analysis failed: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(`   ⚠️  ${message}`);
      warnings.push(message);
      throw error;
    }
  }

  private displayAnalysisSummary(results: any) {
    console.log('\n📊 Analysis Summary');
    console.log('==================\n');

    // Basic stats
    const { basic } = results;
    console.log('🗄️ Database Overview:');
    console.log(`   • Tables: ${basic.tables.length}`);
    console.log(`   • Total Rows: ${basic.total_rows.toLocaleString()}`);
    console.log(`   • Database Size: ${this.formatBytes(basic.database_size)}`);

    // Objects stats
    if (results.objects) {
      const { statistics } = results.objects;
      console.log('\n🔧 Database Objects:');
      console.log(`   • Functions: ${statistics.total_functions} (${statistics.trigger_functions} triggers)`);
      console.log(`   • Views: ${statistics.total_views} (${statistics.materialized_views} materialized)`);
      console.log(`   • Triggers: ${statistics.total_triggers}`);
      console.log(`   • Extensions: ${statistics.total_extensions}`);
      console.log(`   • Custom Types: ${statistics.total_custom_types} (${statistics.enum_types} enums)`);
    }

    // Performance stats
    if (results.performance) {
      const { database_statistics, performance_issues } = results.performance;
      console.log('\n⚡ Performance Metrics:');
      console.log(`   • Cache Hit Ratio: ${database_statistics.cache_hit_ratio}%`);
      console.log(`   • Index Hit Ratio: ${database_statistics.index_hit_ratio}%`);
      console.log(`   • Performance Issues: ${performance_issues.length}`);
      
      const criticalPerf = performance_issues.filter((i: any) => i.severity === 'critical').length;
      if (criticalPerf > 0) {
        console.log(`   • ⚠️  Critical Issues: ${criticalPerf}`);
      }
    }

    // Security stats
    if (results.security) {
      const { security_summary, vulnerabilities } = results.security;
      console.log('\n🔒 Security Analysis:');
      console.log(`   • Tables with RLS: ${security_summary.tables_with_rls}`);
      console.log(`   • Tables without RLS: ${security_summary.tables_without_rls}`);
      console.log(`   • Total Policies: ${security_summary.total_policies}`);
      console.log(`   • Security Issues: ${vulnerabilities.length}`);
      
      if (security_summary.critical_vulnerabilities > 0) {
        console.log(`   • 🚨 Critical Vulnerabilities: ${security_summary.critical_vulnerabilities}`);
      }
    }

    // Edge Functions stats
    if (results.edge_functions) {
      const { statistics } = results.edge_functions;
      console.log('\n⚡ Edge Functions:');
      console.log(`   • Total Functions: ${statistics.total_functions}`);
      console.log(`   • Deployed: ${statistics.deployed_functions}`);
      
      if (statistics.total_functions === 0) {
        console.log('   • ℹ️  No Edge Functions found');
      }
    }

    // Realtime stats
    if (results.realtime) {
      const { statistics } = results.realtime;
      console.log('\n📡 Realtime Configuration:');
      console.log(`   • Tables with Realtime: ${statistics.tables_with_realtime}`);
      console.log(`   • High Traffic Tables: ${statistics.high_traffic_tables}`);
      console.log(`   • Est. Messages/sec: ${statistics.total_estimated_messages}`);
    }

    console.log('\n✅ Enhanced analysis complete!\n');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
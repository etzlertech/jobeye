import { SupabaseClient } from '@supabase/supabase-js';
import { LiveDatabaseAnalyzer, LiveDatabaseAnalysis } from './db-analyzer-live-fixed';
import { DatabaseObjectsAnalyzer } from './analyzers/database-objects-analyzer';
import { PerformanceAnalyzer } from './analyzers/performance-analyzer';
import { SecurityAnalyzer } from './analyzers/security-analyzer';
import { EdgeFunctionsAnalyzer } from './analyzers/edge-functions-analyzer';
import { RealtimeAnalyzer } from './analyzers/realtime-analyzer';
import { StorageAnalyzer } from './storage-analyzer';

export interface EnhancedDatabaseAnalysis {
  metadata: {
    analyzed_at: string;
    analysis_version: string;
    total_analysis_time: number;
    warnings: string[];
  };
  basic: LiveDatabaseAnalysis;
  objects?: any;
  performance?: any;
  security?: any;
  edge_functions?: any;
  realtime?: any;
  storage?: any;
}

export class EnhancedDatabaseAnalyzer {
  private client: SupabaseClient;
  private projectRef?: string;
  private managementApiKey?: string;
  private warnings: string[] = [];

  constructor(
    client: SupabaseClient,
    projectRef?: string,
    managementApiKey?: string
  ) {
    this.client = client;
    this.projectRef = projectRef;
    this.managementApiKey = managementApiKey;
  }

  async analyze(): Promise<EnhancedDatabaseAnalysis> {
    const startTime = Date.now();

    console.log('🚀 Starting Enhanced Supabase Analysis');
    console.log('=====================================\n');

    try {
      // Run basic analysis with fixed analyzer
      console.log('1️⃣ Running basic database analysis...');
      const basicAnalyzer = new LiveDatabaseAnalyzer(this.client);
      const basicAnalysis = await basicAnalyzer.analyze();
      console.log(`   ✅ Found ${basicAnalysis.total_tables} tables`);

      // Run enhanced analyses in parallel
      console.log('\n2️⃣ Running enhanced analyses in parallel...');
      const [
        objectsAnalysis,
        performanceAnalysis,
        securityAnalysis,
        edgeFunctionsAnalysis,
        realtimeAnalysis,
        storageAnalysis
      ] = await Promise.all([
        this.analyzeObjects(),
        this.analyzePerformance(),
        this.analyzeSecurity(),
        this.analyzeEdgeFunctions(),
        this.analyzeRealtime(),
        this.analyzeStorage()
      ]);

      const totalTime = Date.now() - startTime;

      console.log('\n📊 Analysis Summary');
      console.log('==================\n');
      console.log('🗄️ Database Overview:');
      console.log(`   • Tables: ${basicAnalysis.total_tables}`);
      console.log(`   • Total Rows: ${basicAnalysis.total_rows.toLocaleString()}`);
      console.log(`   • Database Size: ${basicAnalysis.total_size}`);

      if (objectsAnalysis) {
        console.log('\n🔧 Database Objects:');
        console.log(`   • Functions: ${objectsAnalysis.statistics.total_functions} (${objectsAnalysis.statistics.trigger_functions} triggers)`);
        console.log(`   • Views: ${objectsAnalysis.statistics.total_views} (${objectsAnalysis.statistics.materialized_views} materialized)`);
        console.log(`   • Triggers: ${objectsAnalysis.statistics.total_triggers}`);
        console.log(`   • Extensions: ${objectsAnalysis.statistics.total_extensions}`);
        console.log(`   • Custom Types: ${objectsAnalysis.statistics.total_custom_types} (${objectsAnalysis.statistics.enum_types} enums)`);
      }

      if (performanceAnalysis) {
        console.log('\n⚡ Performance Metrics:');
        console.log(`   • Cache Hit Ratio: ${performanceAnalysis.database_statistics.cache_hit_ratio}%`);
        console.log(`   • Index Hit Ratio: ${performanceAnalysis.database_statistics.index_hit_ratio}%`);
        console.log(`   • Performance Issues: ${performanceAnalysis.performance_issues.length}`);
        const critical = performanceAnalysis.performance_issues.filter((i: any) => i.severity === 'critical').length;
        if (critical > 0) {
          console.log(`   • ⚠️  Critical Issues: ${critical}`);
        }
      }

      if (securityAnalysis) {
        console.log('\n🔒 Security Analysis:');
        console.log(`   • Tables with RLS: ${securityAnalysis.security_summary.tables_with_rls}`);
        console.log(`   • Tables without RLS: ${securityAnalysis.security_summary.tables_without_rls}`);
        console.log(`   • Total Policies: ${securityAnalysis.security_summary.total_policies}`);
        console.log(`   • Security Issues: ${securityAnalysis.vulnerabilities.length}`);
      }

      if (edgeFunctionsAnalysis) {
        console.log('\n⚡ Edge Functions:');
        console.log(`   • Total Functions: ${edgeFunctionsAnalysis.statistics.total_functions}`);
        console.log(`   • Deployed: ${edgeFunctionsAnalysis.statistics.deployed_functions}`);
        if (edgeFunctionsAnalysis.statistics.total_functions === 0) {
          console.log('   • ℹ️  No Edge Functions found');
        }
      }

      if (realtimeAnalysis) {
        console.log('\n📡 Realtime Configuration:');
        console.log(`   • Tables with Realtime: ${realtimeAnalysis.statistics.tables_with_realtime}`);
        console.log(`   • High Traffic Tables: ${realtimeAnalysis.statistics.high_traffic_tables}`);
        console.log(`   • Est. Messages/sec: ${realtimeAnalysis.statistics.total_estimated_messages}`);
      }

      console.log('\n✅ Enhanced analysis complete!');

      return {
        metadata: {
          analyzed_at: new Date().toISOString(),
          analysis_version: '2.0.0',
          total_analysis_time: totalTime,
          warnings: this.warnings
        },
        basic: basicAnalysis,
        objects: objectsAnalysis,
        performance: performanceAnalysis,
        security: securityAnalysis,
        edge_functions: edgeFunctionsAnalysis,
        realtime: realtimeAnalysis,
        storage: storageAnalysis
      };

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }

  private async analyzeObjects() {
    try {
      console.log('🔍 Analyzing database objects...');
      const analyzer = new DatabaseObjectsAnalyzer(this.client);
      return await analyzer.analyze();
    } catch (error) {
      this.warnings.push(`Database objects analysis failed: ${error.message}`);
      return null;
    }
  }

  private async analyzePerformance() {
    try {
      console.log('📊 Analyzing database performance...');
      const analyzer = new PerformanceAnalyzer(this.client);
      return await analyzer.analyze();
    } catch (error) {
      this.warnings.push(`Performance analysis failed: ${error.message}`);
      return null;
    }
  }

  private async analyzeSecurity() {
    try {
      console.log('🔒 Analyzing database security...');
      const analyzer = new SecurityAnalyzer(this.client);
      return await analyzer.analyze();
    } catch (error) {
      this.warnings.push(`Security analysis failed: ${error.message}`);
      return null;
    }
  }

  private async analyzeEdgeFunctions() {
    try {
      console.log('⚡ Analyzing Edge Functions...');
      const analyzer = new EdgeFunctionsAnalyzer(
        this.client,
        this.projectRef,
        this.managementApiKey
      );
      return await analyzer.analyze();
    } catch (error) {
      this.warnings.push(`Edge Functions analysis failed: ${error.message}`);
      return null;
    }
  }

  private async analyzeRealtime() {
    try {
      console.log('📡 Analyzing Realtime subscriptions...');
      const analyzer = new RealtimeAnalyzer(this.client);
      return await analyzer.analyze();
    } catch (error) {
      this.warnings.push(`Realtime analysis failed: ${error.message}`);
      return null;
    }
  }

  private async analyzeStorage() {
    try {
      const storageAnalyzer = new StorageAnalyzer(this.client);
      return await storageAnalyzer.analyze();
    } catch (error) {
      this.warnings.push(`Storage analysis failed: ${error.message}`);
      return null;
    }
  }
}
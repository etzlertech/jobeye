#!/usr/bin/env npx tsx

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { LiveDatabaseAnalyzer, DatabaseAnalysis } from './db-analyzer-live';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export class FixedLiveDatabaseAnalyzer extends LiveDatabaseAnalyzer {
  private discoveredTables: Set<string> = new Set();
  
  constructor(private client: SupabaseClient) {
    super(client);
  }

  /**
   * Properly discover tables using multiple methods
   */
  private async discoverTables(): Promise<void> {
    console.log('\n🔍 Discovering tables from LIVE database...');
    
    // Method 1: Try using exec_sql with information_schema
    try {
      console.log('  Attempting to query information_schema...');
      const { data: tables, error } = await this.client.rpc('exec_sql', {
        sql: `
          SELECT 
            table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `
      });

      if (!error && tables && Array.isArray(tables)) {
        console.log(`  ✅ Found ${tables.length} tables via information_schema`);
        tables.forEach((row: any) => {
          this.discoveredTables.add(row.table_name);
        });
        return;
      } else if (error) {
        console.log(`  ⚠️  exec_sql not available: ${error.message}`);
      }
    } catch (e) {
      console.log('  ⚠️  exec_sql method failed');
    }

    // Method 2: Query OpenAPI spec from Supabase REST API
    try {
      console.log('  Attempting to fetch OpenAPI spec...');
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });
      
      if (response.ok) {
        const openapi = await response.json();
        const paths = Object.keys(openapi.paths || {});
        
        const tables = paths
          .filter(path => path !== '/' && path.startsWith('/'))
          .map(path => path.substring(1))
          .filter(name => !name.includes('/'));
        
        console.log(`  ✅ Found ${tables.length} tables via OpenAPI spec`);
        tables.forEach(table => this.discoveredTables.add(table));
        return;
      }
    } catch (e) {
      console.log('  ⚠️  OpenAPI method failed');
    }

    // Method 3: Probe common table names (fallback)
    console.log('  Falling back to probing common table names...');
    const commonTables = [
      // Core tables that commonly exist
      'companies', 'users', 'profiles', 'tenants',
      'jobs', 'customers', 'properties', 'equipment', 
      'materials', 'teams', 'schedules', 'routes',
      'voice_sessions', 'vision_verifications',
      'media_assets', 'documents', 'notifications',
      'audit_logs', 'system_logs'
    ];

    let found = 0;
    for (const tableName of commonTables) {
      try {
        const { error } = await this.client
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          this.discoveredTables.add(tableName);
          found++;
        }
      } catch (e) {
        // Table doesn't exist
      }
    }
    
    console.log(`  ✅ Found ${found} tables via probing`);
  }

  async analyze(): Promise<DatabaseAnalysis> {
    const analyzedAt = new Date().toISOString();
    
    // First discover all accessible tables
    await this.discoverTables();
    
    console.log(`\n📊 Analyzing ${this.discoveredTables.size} tables from LIVE database...`);
    
    const tableAnalyses = [];
    let totalRows = 0;
    let analyzed = 0;
    
    // Call parent's analyzeTable method for each discovered table
    for (const tableName of Array.from(this.discoveredTables).sort()) {
      analyzed++;
      if (analyzed % 10 === 0) {
        console.log(`  Progress: ${analyzed}/${this.discoveredTables.size} tables analyzed...`);
      }
      
      try {
        const analysis = await (this as any).analyzeTable(tableName);
        tableAnalyses.push(analysis);
        totalRows += analysis.row_count;
      } catch (error) {
        console.error(`  ⚠️  Failed to analyze ${tableName}:`, error);
      }
    }
    
    console.log(`\n✅ Analysis complete. Processed ${tableAnalyses.length} tables with ${totalRows} total rows.`);
    
    // Calculate statistics
    const missingRlsTables = tableAnalyses
      .filter(t => !t.rls_enabled)
      .map(t => t.name);
    const orphanedTables = (this as any).detectOrphanedTables(tableAnalyses);
    
    // Generate recommendations
    const recommendations = (this as any).generateRecommendations(tableAnalyses);
    
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
}

// Main execution
async function main() {
  console.log('🚀 Starting FIXED Live Database Analysis...');
  console.log(`📍 Target: ${supabaseUrl}`);
  
  const client = createClient(supabaseUrl, supabaseServiceKey);
  const analyzer = new FixedLiveDatabaseAnalyzer(client);
  
  try {
    const analysis = await analyzer.analyze();
    
    // Save results
    const fs = await import('fs/promises');
    const outputPath = './supabase-analysis/output/live-database-analysis-fixed.json';
    await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));
    
    console.log(`\n💾 Analysis saved to: ${outputPath}`);
    console.log('\n📊 Summary:');
    console.log(`  - Total tables: ${analysis.total_tables}`);
    console.log(`  - Total rows: ${analysis.total_rows.toLocaleString()}`);
    console.log(`  - Orphaned tables: ${analysis.orphaned_tables.length}`);
    console.log(`  - Missing RLS: ${analysis.missing_rls_tables.length}`);
    
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
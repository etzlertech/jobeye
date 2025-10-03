#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { DatabaseAnalyzer } from './db-analyzer-v2';
import { StorageAnalyzer } from './storage-analyzer';
import { ReportGenerator } from './report-generator';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

async function main() {
  console.log('🔍 Starting comprehensive Supabase analysis (v2)...\n');

  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Initialize analyzers
    const dbAnalyzer = new DatabaseAnalyzer(client);
    const storageAnalyzer = new StorageAnalyzer(client);
    const reportGenerator = new ReportGenerator();

    // Run database analysis
    console.log('📊 Analyzing database schema...');
    const dbAnalysis = await dbAnalyzer.analyze();
    
    // Run storage analysis
    console.log('\n📁 Analyzing storage buckets...');
    const storageAnalysis = await storageAnalyzer.analyze();
    
    // Generate reports
    console.log('\n📝 Generating reports...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(__dirname, '../reports');
    
    // Save to latest
    const latestDir = path.join(reportsDir, 'latest');
    await fs.mkdir(latestDir, { recursive: true });
    
    await reportGenerator.generateYAML(dbAnalysis, path.join(latestDir, 'database-analysis.yaml'));
    await reportGenerator.generateYAML(storageAnalysis, path.join(latestDir, 'storage-analysis.yaml'));
    await reportGenerator.generateMarkdown(
      { database: dbAnalysis, storage: storageAnalysis },
      path.join(latestDir, 'full-report.md')
    );
    
    // Archive with timestamp
    const archiveDir = path.join(reportsDir, 'archive', timestamp);
    await fs.mkdir(archiveDir, { recursive: true });
    await fs.cp(latestDir, archiveDir, { recursive: true });
    
    console.log('\n✅ Analysis complete!');
    console.log(`📍 Reports saved to: ${latestDir}`);
    console.log(`📍 Archived copy: ${archiveDir}`);
    
    // Print summary
    console.log('\n📊 Summary:');
    console.log(`- Total tables: ${dbAnalysis.total_tables}`);
    console.log(`- Total rows: ${dbAnalysis.total_rows}`);
    console.log(`- Tables missing RLS: ${dbAnalysis.missing_rls_tables.length}`);
    console.log(`- Orphaned tables: ${dbAnalysis.orphaned_tables.length}`);
    console.log(`- Storage buckets: ${storageAnalysis.buckets.length}`);
    console.log(`- Total files: ${storageAnalysis.total_files}`);
    
    if (dbAnalysis.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      dbAnalysis.recommendations.slice(0, 3).forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
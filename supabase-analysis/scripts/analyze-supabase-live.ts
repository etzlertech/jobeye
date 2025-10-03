#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { LiveDatabaseAnalyzer } from './db-analyzer-live-fixed';
import { StorageAnalyzer } from './storage-analyzer';
import { ReportGeneratorFixed as ReportGenerator } from './report-generator-fixed';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

async function main() {
  console.log('🔍 Starting LIVE Supabase database analysis...\n');
  console.log('This will analyze the actual live database, not migration files.\n');

  const client = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Initialize analyzers
    const dbAnalyzer = new LiveDatabaseAnalyzer(client);
    const storageAnalyzer = new StorageAnalyzer(client);
    const reportGenerator = new ReportGenerator();

    // Run database analysis
    console.log('📊 Analyzing LIVE database...');
    const dbAnalysis = await dbAnalyzer.analyze();
    
    // Run storage analysis
    console.log('\n📁 Analyzing storage buckets...');
    const storageAnalysis = await storageAnalyzer.analyze();
    
    // Generate reports
    console.log('\n📝 Generating comprehensive reports...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(process.cwd(), 'supabase-analysis', 'reports');
    
    // Save to latest
    const latestDir = path.join(reportsDir, 'latest');
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
    
    // Summary
    console.log('\n📊 LIVE DATABASE Summary:');
    console.log(`- Total tables analyzed: ${dbAnalysis.total_tables}`);
    console.log(`- Total rows in database: ${dbAnalysis.total_rows.toLocaleString()}`);
    console.log(`- Tables with data: ${dbAnalysis.tables.filter(t => t.row_count > 0).length}`);
    console.log(`- Empty tables: ${dbAnalysis.tables.filter(t => t.row_count === 0).length}`);
    console.log(`- Storage buckets: ${storageAnalysis.total_buckets}`);
    console.log(`- Total files in storage: ${storageAnalysis.total_files}`);
    
    // Show tables with most data
    const topTables = dbAnalysis.tables
      .filter(t => t.row_count > 0)
      .sort((a, b) => b.row_count - a.row_count)
      .slice(0, 10);
    
    if (topTables.length > 0) {
      console.log('\n📈 Top tables by row count:');
      topTables.forEach(t => {
        console.log(`  ${t.name}: ${t.row_count.toLocaleString()} rows`);
      });
    }
    
    if (dbAnalysis.recommendations.length > 0) {
      console.log('\n🎯 Top Recommendations:');
      dbAnalysis.recommendations.slice(0, 3).forEach((rec, idx) => {
        console.log(`${idx + 1}. ${rec}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
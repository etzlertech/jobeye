#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { DatabaseAnalyzer } from './db-analyzer';
import { StorageAnalyzer } from './storage-analyzer';
import { ReportGenerator } from './report-generator';
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
  console.log('🔍 Starting comprehensive Supabase analysis...\n');

  const client = createClient(supabaseUrl, supabaseServiceKey);
  
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
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
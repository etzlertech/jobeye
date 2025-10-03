#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { DetailedDatabaseAnalyzer, DetailedReportGenerator } from './db-analyzer-detailed';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting DETAILED Supabase Database Analysis');
  console.log('==============================================\n');
  
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
  
  try {
    // Run detailed analysis
    const analyzer = new DetailedDatabaseAnalyzer(client);
    const analysis = await analyzer.analyze();
    
    // Generate reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(process.cwd(), 'supabase-analysis', 'detailed-reports', timestamp);
    
    const reportGenerator = new DetailedReportGenerator();
    await reportGenerator.generateReport(analysis, outputDir);
    
    console.log('\n📊 Analysis Summary:');
    console.log(`   • Total Tables: ${analysis.total_tables}`);
    console.log(`   • Total Rows: ${analysis.total_rows.toLocaleString()}`);
    console.log(`   • Total Columns: ${analysis.summary.total_columns}`);
    console.log(`   • Total Relationships: ${analysis.summary.total_relationships}`);
    
    console.log('\n🎯 Key Findings:');
    analysis.recommendations.forEach((rec: string, idx: number) => {
      console.log(`   ${idx + 1}. ${rec}`);
    });
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
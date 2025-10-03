#!/usr/bin/env npx tsx
/**
 * Enhanced Supabase Database Analysis Tool
 * 
 * This tool provides comprehensive analysis of your Supabase database including:
 * - All standard database objects (tables, views, functions, triggers, etc.)
 * - Performance metrics and optimization opportunities
 * - Security analysis with detailed RLS and permissions review
 * - Edge Functions analysis (if configured)
 * - Realtime subscriptions configuration
 * - And much more!
 * 
 * Usage: npm run analyze:supabase:enhanced
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';
import { EnhancedDatabaseAnalyzer } from './db-analyzer-enhanced';
import { EnhancedReportGenerator } from './report-generator-enhanced';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const managementApiKey = process.env.SUPABASE_MANAGEMENT_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Optional variables for full analysis:');
  console.error('   - SUPABASE_PROJECT_REF (for Edge Functions analysis)');
  console.error('   - SUPABASE_MANAGEMENT_API_KEY (for deployment info)');
  process.exit(1);
}

async function archivePreviousReports(): Promise<void> {
  const baseDir = path.join(process.cwd(), 'supabase-analysis/reports');
  const latestDir = path.join(baseDir, 'latest');
  const archiveDir = path.join(baseDir, 'archive');

  try {
    // Check if latest directory exists
    await fs.access(latestDir);
    
    // Create archive directory if it doesn't exist
    await fs.mkdir(archiveDir, { recursive: true });
    
    // Move latest to archive with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const archivePath = path.join(archiveDir, timestamp);
    
    await fs.rename(latestDir, archivePath);
    console.log(`📁 Archived previous reports to: archive/${timestamp}/\n`);
  } catch (error) {
    // Latest directory doesn't exist, nothing to archive
  }
}

async function main() {
  console.log('🚀 Enhanced Supabase Database Analysis Tool v2.0');
  console.log('===============================================\n');

  const client = createClient(supabaseUrl, supabaseKey);

  // Archive previous reports
  await archivePreviousReports();

  // Create analyzers
  const analyzer = new EnhancedDatabaseAnalyzer(client, projectRef, managementApiKey);
  const reportGenerator = new EnhancedReportGenerator();

  // Run enhanced analysis
  const analysis = await analyzer.analyze();

  // Generate enhanced reports
  const outputDir = path.join(process.cwd(), 'supabase-analysis/reports/latest');
  await reportGenerator.generateReports(analysis, outputDir);

  // Display final summary
  console.log('\n📁 Reports Generated:');
  console.log('   • enhanced-analysis.yaml - Complete analysis data (AI-friendly)');
  console.log('   • enhanced-report.md - Comprehensive human-readable report');
  console.log('   • security-report.md - Detailed security analysis');
  console.log('   • performance-report.md - Performance optimization guide');
  console.log('   • action-plan.md - Prioritized action items');
  console.log(`\nLocation: ${outputDir}`);

  // Display top recommendations
  console.log('\n🎯 Top Recommendations:');
  const allRecommendations: string[] = [];
  
  if (analysis.security?.recommendations) {
    allRecommendations.push(...analysis.security.recommendations.slice(0, 2));
  }
  if (analysis.performance?.recommendations) {
    allRecommendations.push(...analysis.performance.recommendations.slice(0, 2));
  }
  
  allRecommendations.slice(0, 5).forEach((rec, idx) => {
    console.log(`   ${idx + 1}. ${rec}`);
  });

  console.log('\n✅ Enhanced analysis complete!');
}

// Run the analysis
main().catch(error => {
  console.error('\n❌ Analysis failed:', error);
  process.exit(1);
});
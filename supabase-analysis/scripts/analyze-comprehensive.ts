#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { ComprehensiveDatabaseAnalyzer } from './db-analyzer-comprehensive';
import * as fs from 'fs/promises';
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
  console.log('🚀 Starting COMPREHENSIVE Supabase Database Analysis');
  console.log('================================================\n');
  
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
  
  try {
    // Run comprehensive analysis
    const analyzer = new ComprehensiveDatabaseAnalyzer(client);
    const analysis = await analyzer.analyze();
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(process.cwd(), 'supabase-analysis', 'comprehensive-reports', timestamp);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write JSON report
    await fs.writeFile(
      path.join(outputDir, 'comprehensive-analysis.json'),
      JSON.stringify(analysis, null, 2),
      'utf8'
    );
    
    // Write detailed markdown report
    await generateMarkdownReport(analysis, outputDir);
    
    console.log(`\n📁 Reports saved to: ${outputDir}`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

async function generateMarkdownReport(analysis: any, outputDir: string): Promise<void> {
  const sections: string[] = [];
  
  sections.push(`# COMPREHENSIVE Database Analysis Report

Generated: ${analysis.metadata.analyzed_at}
Database: ${analysis.metadata.database_url}

## Executive Summary

- **Total Tables**: ${analysis.summary.total_tables}
- **Total Rows**: ${analysis.summary.total_rows.toLocaleString()}
- **Total Columns**: ${analysis.summary.total_columns}
- **Total Indexes**: ${analysis.summary.total_indexes}
- **Total Foreign Keys**: ${analysis.summary.total_foreign_keys}
- **Total RLS Policies**: ${analysis.summary.total_policies}
- **Tables with Data**: ${analysis.summary.tables_with_data}
- **Tables with RLS**: ${analysis.summary.tables_with_rls}
- **Tables with Policies**: ${analysis.summary.tables_with_policies}

## Key Insights

### Largest Tables by Row Count
${analysis.insights.largest_tables.map((t: any) => `- **${t.name}**: ${t.rows.toLocaleString()} rows (${t.size})`).join('\n')}

### Tables Without Primary Keys
${analysis.insights.tables_without_primary_key.length > 0 
  ? analysis.insights.tables_without_primary_key.map((t: string) => `- ${t}`).join('\n')
  : 'None - all tables have primary keys ✅'}

### Tables Without Indexes
${analysis.insights.tables_without_indexes.length > 0
  ? analysis.insights.tables_without_indexes.map((t: string) => `- ${t}`).join('\n')
  : 'None - all tables have indexes ✅'}

### Tables with RLS but No Policies
${analysis.insights.tables_with_rls_but_no_policies.length > 0
  ? analysis.insights.tables_with_rls_but_no_policies.map((t: string) => `- ${t}`).join('\n')
  : 'None ✅'}

## Detailed Table Information
`);

  // Add detailed table information
  for (const table of analysis.tables) {
    if (table.columns.length === 0) continue; // Skip tables without column info
    
    sections.push(`
### 📊 ${table.name}

- **Row Count**: ${table.row_count.toLocaleString()}
- **Table Size**: ${table.table_size}
- **Index Size**: ${table.indexes_size}
- **Total Size**: ${table.total_size}
- **RLS Enabled**: ${table.has_rls ? '✅' : '❌'}
- **Primary Keys**: ${table.primary_keys.join(', ') || 'None'}

#### Columns (${table.columns.length})

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|`);

    for (const col of table.columns) {
      const notes = [];
      if (table.primary_keys.includes(col.name)) notes.push('PK');
      if (col.name.endsWith('_id') && col.name !== 'id') notes.push('FK');
      
      sections.push(
        `| ${col.name} | ${col.type} | ${col.nullable ? 'YES' : 'NO'} | ${col.default || '-'} | ${col.is_identity ? 'YES' : '-'} | ${notes.join(', ') || '-'} |`
      );
    }

    if (table.foreign_keys.length > 0) {
      sections.push(`
#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|`);

      for (const fk of table.foreign_keys) {
        sections.push(
          `| ${fk.constraint_name} | ${fk.column} | ${fk.references_table}.${fk.references_column} | ${fk.on_update} | ${fk.on_delete} |`
        );
      }
    }

    if (table.indexes.length > 0) {
      sections.push(`
#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|`);

      for (const idx of table.indexes) {
        sections.push(
          `| ${idx.name} | ${idx.type} | ${idx.is_unique ? '✅' : '-'} | ${idx.is_primary ? '✅' : '-'} | ${idx.columns} | ${idx.size} |`
        );
      }
    }

    if (table.rls_policies.length > 0) {
      sections.push(`
#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|`);

      for (const policy of table.rls_policies) {
        sections.push(
          `| ${policy.name} | ${policy.command} | ${policy.permissive} | ${policy.roles.join(', ')} | \`${policy.check_expression}\` |`
        );
      }
    }

    sections.push('\n---\n');
  }

  // Add recommendations
  sections.push(`
## Recommendations

${analysis.recommendations.map((rec: string, idx: number) => `${idx + 1}. ${rec}`).join('\n')}

## Relationship Map

\`\`\`yaml
${JSON.stringify(analysis.insights.relationship_map, null, 2)}
\`\`\`
`);

  await fs.writeFile(
    path.join(outputDir, 'comprehensive-database-report.md'),
    sections.join('\n'),
    'utf8'
  );
}

main().catch(console.error);
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LiveDatabaseAnalysis } from './db-analyzer-live-fixed';

export class ReportGeneratorFixed {
  async generateYAML(data: any, filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    const yamlContent = yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      sortKeys: false,
      noRefs: true
    });
    
    await fs.writeFile(filePath, yamlContent, 'utf8');
  }

  async generateMarkdown(data: { database: LiveDatabaseAnalysis; storage: any }, filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    const markdown = this.buildMarkdownReport(data.database, data.storage);
    await fs.writeFile(filePath, markdown, 'utf8');
  }

  private buildMarkdownReport(database: LiveDatabaseAnalysis, storage: any): string {
    const sections: string[] = [];

    // Header
    sections.push(`# Supabase Live Database Analysis Report

Generated: ${database.analyzed_at}
Database: ${database.database_url}

## Executive Summary

### Database Overview
- **Total Tables**: ${database.total_tables}
- **Total Rows**: ${database.total_rows.toLocaleString()}
- **Database Size**: ${database.total_size}
- **Tables with Data**: ${database.tables.filter(t => t.row_count > 0).length}
- **Empty Tables**: ${database.tables.filter(t => t.row_count === 0).length}

### Storage Overview
- **Total Buckets**: ${storage.total_buckets}
- **Total Files**: ${storage.total_files.toLocaleString()}
- **Total Size**: ${this.formatBytes(storage.total_size)}
- **Public Buckets**: ${storage.public_buckets?.length || 0}
- **Empty Buckets**: ${storage.empty_buckets?.length || 0}

## Database Tables

### Tables by Row Count

| Table Name | Row Count | RLS Enabled | Has Primary Key |
|------------|-----------|-------------|-----------------|`);

    // Add top 20 tables by row count
    const topTables = database.tables
      .filter(t => t.row_count > 0)
      .slice(0, 20);

    for (const table of topTables) {
      sections.push(
        `| ${table.name} | ${table.row_count.toLocaleString()} | ${table.rls_enabled ? '✅' : '❌'} | ${table.has_primary_key ? '✅' : '❌'} |`
      );
    }

    // Empty tables summary
    const emptyTables = database.tables.filter(t => t.row_count === 0);
    sections.push(`

### Empty Tables (${emptyTables.length})

${emptyTables.map(t => `- ${t.name}`).join('\n')}

## Storage Buckets

| Bucket Name | Files | Total Size | Public |
|-------------|-------|------------|--------|`);

    // Add storage buckets
    for (const bucket of storage.buckets || []) {
      sections.push(
        `| ${bucket.name} | ${bucket.file_count} | ${this.formatBytes(bucket.total_size)} | ${bucket.is_public ? '✅' : '❌'} |`
      );
    }

    // Recommendations
    sections.push(`

## Recommendations

${database.recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')}

## Next Steps

1. **Database Cleanup**:
   - Review and potentially remove ${emptyTables.length} empty tables
   - Enable RLS on tables containing sensitive data

2. **Performance**:
   - Add primary keys to tables without them
   - Consider indexes for frequently queried columns

3. **Security**:
   - Enable RLS on all production tables
   - Review public storage buckets for sensitive content

4. **Monitoring**:
   - Set up alerts for table growth
   - Monitor storage usage trends
`);

    return sections.join('\n');
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
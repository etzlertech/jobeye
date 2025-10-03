import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DatabaseAnalysis, TableAnalysis } from './db-analyzer';
import { StorageAnalysis, BucketAnalysis } from './storage-analyzer';

export interface FullAnalysis {
  database: DatabaseAnalysis;
  storage: StorageAnalysis;
}

export class ReportGenerator {
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

  async generateMarkdown(analysis: FullAnalysis, filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    const markdown = this.buildMarkdownReport(analysis);
    await fs.writeFile(filePath, markdown, 'utf8');
  }

  private buildMarkdownReport(analysis: FullAnalysis): string {
    const { database, storage } = analysis;
    const sections: string[] = [];
    
    // Header
    sections.push(`# Supabase Analysis Report

Generated: ${database.analyzed_at}
Database: ${database.database_url}

## Executive Summary

### Database Overview
- **Total Tables**: ${database.total_tables}
- **Total Rows**: ${database.total_rows.toLocaleString()}
- **Tables without RLS**: ${database.missing_rls_tables.length}
- **Orphaned Tables**: ${database.orphaned_tables.length}
- **Views**: ${database.views.length}
- **Functions**: ${database.functions.length}
- **Enums**: ${database.enums.length}

### Storage Overview  
- **Total Buckets**: ${storage.total_buckets}
- **Total Files**: ${storage.total_files.toLocaleString()}
- **Total Size**: ${this.formatBytes(storage.total_size)}
- **Public Buckets**: ${storage.public_buckets.length}
- **Empty Buckets**: ${storage.empty_buckets.length}

## AI Agent Instructions

This report provides comprehensive analysis of the Supabase database and storage. Use this information to:

1. **Identify Cleanup Opportunities**:
   - Remove orphaned tables listed in section 2.5
   - Delete unused functions with 'test_', 'temp_', or 'backup_' prefixes
   - Clean up empty storage buckets
   - Archive or remove large files that haven't been accessed recently

2. **Security Improvements**:
   - Enable RLS on all tables listed in section 2.4
   - Review public storage buckets for sensitive data
   - Add missing RLS policies to storage buckets

3. **Performance Optimizations**:
   - Add indexes to foreign key columns without indexes
   - Review tables with high row counts for partitioning needs
   - Optimize large files in storage

4. **Schema Mapping**:
   - Use the detailed table schemas in section 2.1 for API development
   - Reference foreign key relationships for join operations
   - Check column constraints when implementing validation

`);

    // Database Details
    sections.push(this.buildDatabaseSection(database));
    
    // Storage Details
    sections.push(this.buildStorageSection(storage));
    
    // Recommendations
    sections.push(this.buildRecommendationsSection(database, storage));
    
    // Appendices
    sections.push(this.buildAppendixSection(database, storage));
    
    return sections.join('\n\n');
  }

  private buildDatabaseSection(database: DatabaseAnalysis): string {
    const sections: string[] = ['## Database Analysis'];
    
    // Tables with detailed schema
    sections.push(`### 2.1 Tables (${database.tables.length} total)

| Table Name | Rows | Columns | RLS | Primary Key | Description |
|------------|------|---------|-----|-------------|-------------|`);
    
    for (const table of database.tables.sort((a, b) => b.row_count - a.row_count)) {
      const rlsStatus = table.rls_enabled ? '✅' : '❌';
      const pk = table.primary_keys.join(', ') || 'None';
      sections.push(
        `| ${table.name} | ${table.row_count.toLocaleString()} | ${table.columns.length} | ${rlsStatus} | ${pk} | ${this.getTablePurpose(table)} |`
      );
    }
    
    // Column details for each table
    sections.push('\n### 2.2 Table Schemas\n');
    
    for (const table of database.tables.sort((a, b) => a.name.localeCompare(b.name))) {
      sections.push(`#### ${table.name}`);
      sections.push(`\n**Row Count**: ${table.row_count.toLocaleString()} | **RLS**: ${table.rls_enabled ? 'Enabled' : 'Disabled'}`);
      
      if (table.columns.length > 0) {
        sections.push(`\n**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|`);
        
        for (const col of table.columns) {
          const nullable = col.is_nullable ? 'Yes' : 'No';
          const defaultVal = col.column_default || '-';
          const description = col.comment || this.inferColumnPurpose(col.name, col.data_type);
          sections.push(
            `| ${col.name} | ${col.data_type} | ${nullable} | ${defaultVal} | ${description} |`
          );
        }
      }
      
      if (table.foreign_keys.length > 0) {
        sections.push(`\n**Foreign Keys**:`);
        for (const fk of table.foreign_keys) {
          sections.push(`- ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name} (${fk.delete_rule})`);
        }
      }
      
      if (table.indexes.length > 0) {
        sections.push(`\n**Indexes**:`);
        for (const idx of table.indexes) {
          const unique = idx.is_unique ? 'UNIQUE' : '';
          const primary = idx.is_primary ? 'PRIMARY' : '';
          const type = [primary, unique].filter(Boolean).join(' ') || 'INDEX';
          sections.push(`- ${idx.index_name}: ${type} on (${idx.columns.join(', ')})`);
        }
      }
      
      if (table.rls_policies.length > 0) {
        sections.push(`\n**RLS Policies**:`);
        for (const policy of table.rls_policies) {
          sections.push(`- ${policy.policy_name}: ${policy.command} (${policy.is_permissive ? 'PERMISSIVE' : 'RESTRICTIVE'})`);
        }
      }
      
      sections.push('');
    }
    
    // Views
    if (database.views.length > 0) {
      sections.push(`### 2.3 Views (${database.views.length} total)\n`);
      for (const view of database.views) {
        const type = view.is_materialized ? 'MATERIALIZED VIEW' : 'VIEW';
        sections.push(`#### ${view.view_name} (${type})`);
        sections.push(`Columns: ${view.columns.join(', ')}`);
        sections.push('');
      }
    }
    
    // Missing RLS Tables
    if (database.missing_rls_tables.length > 0) {
      sections.push(`### 2.4 Tables Without RLS (${database.missing_rls_tables.length} total)\n`);
      sections.push('⚠️ **Security Risk**: These tables do not have Row Level Security enabled:\n');
      for (const table of database.missing_rls_tables) {
        sections.push(`- ${table}`);
      }
    }
    
    // Orphaned Tables
    if (database.orphaned_tables.length > 0) {
      sections.push(`### 2.5 Orphaned Tables (${database.orphaned_tables.length} total)\n`);
      sections.push('🧹 **Cleanup Candidates**: These tables have no relationships and no data:\n');
      for (const table of database.orphaned_tables) {
        sections.push(`- ${table}`);
      }
    }
    
    // Functions
    if (database.functions.length > 0) {
      sections.push(`### 2.6 Functions (${database.functions.length} total)\n`);
      sections.push('| Function | Returns | Language | Security | Purpose |');
      sections.push('|----------|---------|----------|----------|---------|');
      
      for (const func of database.functions) {
        const purpose = this.inferFunctionPurpose(func.function_name);
        sections.push(
          `| ${func.function_name} | ${func.return_type} | ${func.language} | ${func.security_type} | ${purpose} |`
        );
      }
    }
    
    return sections.join('\n');
  }

  private buildStorageSection(storage: StorageAnalysis): string {
    const sections: string[] = ['## Storage Analysis'];
    
    // Bucket Summary
    sections.push(`### 3.1 Storage Buckets (${storage.buckets.length} total)\n`);
    sections.push('| Bucket | Public | Files | Size | RLS Policies | Status |');
    sections.push('|--------|--------|-------|------|--------------|--------|');
    
    for (const bucket of storage.buckets) {
      const isPublic = bucket.is_public ? '🌐 Yes' : '🔒 No';
      const size = this.formatBytes(bucket.total_size);
      const policies = bucket.rls_policies.length;
      const status = bucket.total_files === 0 ? '📭 Empty' : '📬 In Use';
      
      sections.push(
        `| ${bucket.name} | ${isPublic} | ${bucket.total_files} | ${size} | ${policies} | ${status} |`
      );
    }
    
    // File Type Distribution
    if (Object.keys(storage.file_type_distribution).length > 0) {
      sections.push('\n### 3.2 File Type Distribution\n');
      const sorted = Object.entries(storage.file_type_distribution)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20);
      
      sections.push('| Extension | Count | Percentage |');
      sections.push('|-----------|-------|------------|');
      
      for (const [ext, count] of sorted) {
        const percentage = ((count / storage.total_files) * 100).toFixed(1);
        sections.push(`| .${ext} | ${count} | ${percentage}% |`);
      }
    }
    
    // Large Files
    if (storage.large_files.length > 0) {
      sections.push(`\n### 3.3 Large Files (Top ${storage.large_files.length})\n`);
      sections.push('| File Path | Size | Type | Last Accessed |');
      sections.push('|-----------|------|------|---------------|');
      
      for (const file of storage.large_files) {
        const size = this.formatBytes(file.size);
        const type = file.mime_type || 'Unknown';
        const accessed = file.last_accessed_at || 'Never';
        sections.push(`| ${file.path} | ${size} | ${type} | ${accessed} |`);
      }
    }
    
    // Bucket Details
    sections.push('\n### 3.4 Bucket Details\n');
    
    for (const bucket of storage.buckets) {
      sections.push(`#### ${bucket.name}`);
      sections.push(`- **Public Access**: ${bucket.is_public ? 'Yes' : 'No'}`);
      sections.push(`- **Total Files**: ${bucket.total_files}`);
      sections.push(`- **Total Size**: ${this.formatBytes(bucket.total_size)}`);
      
      if (bucket.allowed_mime_types) {
        sections.push(`- **Allowed Types**: ${bucket.allowed_mime_types.join(', ')}`);
      }
      
      if (bucket.file_size_limit) {
        sections.push(`- **Size Limit**: ${this.formatBytes(bucket.file_size_limit)}`);
      }
      
      if (bucket.folders.length > 0) {
        sections.push('\n**Folder Structure**:');
        for (const folder of bucket.folders.slice(0, 10)) {
          sections.push(`- ${folder.path} (${folder.file_count} files, ${this.formatBytes(folder.total_size)})`);
        }
        if (bucket.folders.length > 10) {
          sections.push(`- ... and ${bucket.folders.length - 10} more folders`);
        }
      }
      
      sections.push('');
    }
    
    return sections.join('\n');
  }

  private buildRecommendationsSection(database: DatabaseAnalysis, storage: StorageAnalysis): string {
    const sections: string[] = ['## Recommendations'];
    
    sections.push('### 4.1 Database Recommendations\n');
    if (database.recommendations.length > 0) {
      for (const rec of database.recommendations) {
        sections.push(`- ${rec}`);
      }
    } else {
      sections.push('- No critical issues found');
    }
    
    sections.push('\n### 4.2 Storage Recommendations\n');
    if (storage.recommendations.length > 0) {
      for (const rec of storage.recommendations) {
        sections.push(`- ${rec}`);
      }
    } else {
      sections.push('- No critical issues found');
    }
    
    sections.push('\n### 4.3 Priority Actions\n');
    sections.push(this.generatePriorityActions(database, storage));
    
    return sections.join('\n');
  }

  private buildAppendixSection(database: DatabaseAnalysis, storage: StorageAnalysis): string {
    const sections: string[] = ['## Appendices'];
    
    // API Mapping Helper
    sections.push('### A.1 API Endpoint Mapping Guide\n');
    sections.push('Based on the analysis, here are suggested API endpoints for each major table:\n');
    
    const apiTables = database.tables
      .filter(t => t.row_count > 0 && !t.name.startsWith('_'))
      .sort((a, b) => b.row_count - a.row_count)
      .slice(0, 20);
    
    for (const table of apiTables) {
      const singular = this.singularize(table.name);
      sections.push(`**${table.name}**:`);
      sections.push(`- GET /api/${table.name} - List all ${table.name}`);
      sections.push(`- GET /api/${table.name}/:id - Get single ${singular}`);
      sections.push(`- POST /api/${table.name} - Create new ${singular}`);
      sections.push(`- PUT /api/${table.name}/:id - Update ${singular}`);
      sections.push(`- DELETE /api/${table.name}/:id - Delete ${singular}`);
      
      // Add filter suggestions based on foreign keys
      if (table.foreign_keys.length > 0) {
        sections.push(`- Filters: ${table.foreign_keys.map(fk => `?${fk.column_name}=value`).join(', ')}`);
      }
      sections.push('');
    }
    
    // Cleanup Script Template
    sections.push('### A.2 Cleanup Script Template\n');
    sections.push('```typescript');
    sections.push('// Cleanup script for orphaned tables and unused resources');
    sections.push('import { createClient } from "@supabase/supabase-js";');
    sections.push('');
    sections.push('const client = createClient(url, serviceKey);');
    sections.push('');
    
    if (database.orphaned_tables.length > 0) {
      sections.push('// Remove orphaned tables');
      for (const table of database.orphaned_tables) {
        sections.push(`// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ${table};" });`);
      }
      sections.push('');
    }
    
    if (storage.empty_buckets.length > 0) {
      sections.push('// Remove empty buckets');
      for (const bucket of storage.empty_buckets) {
        sections.push(`// await client.storage.deleteBucket("${bucket}");`);
      }
    }
    
    sections.push('```');
    
    return sections.join('\n');
  }

  private getTablePurpose(table: TableAnalysis): string {
    const name = table.name.toLowerCase();
    
    // Common patterns
    if (name.includes('user')) return 'User management';
    if (name.includes('auth')) return 'Authentication';
    if (name.includes('job')) return 'Job tracking';
    if (name.includes('customer')) return 'Customer data';
    if (name.includes('equipment')) return 'Equipment tracking';
    if (name.includes('material')) return 'Material inventory';
    if (name.includes('voice')) return 'Voice interactions';
    if (name.includes('vision')) return 'Vision/image processing';
    if (name.includes('log')) return 'System logging';
    if (name.includes('audit')) return 'Audit trail';
    if (name.includes('config')) return 'Configuration';
    if (name.includes('setting')) return 'Settings storage';
    if (name.includes('migration')) return 'Database migrations';
    
    return 'Domain data';
  }

  private inferColumnPurpose(name: string, dataType: string): string {
    const n = name.toLowerCase();
    
    // IDs
    if (n === 'id') return 'Primary identifier';
    if (n.endsWith('_id')) return 'Foreign key reference';
    
    // Timestamps
    if (n.includes('created_at')) return 'Record creation timestamp';
    if (n.includes('updated_at')) return 'Last modification timestamp';
    if (n.includes('deleted_at')) return 'Soft delete timestamp';
    
    // User tracking
    if (n.includes('created_by')) return 'User who created record';
    if (n.includes('updated_by')) return 'User who last modified';
    
    // Common fields
    if (n === 'name') return 'Display name';
    if (n === 'description') return 'Detailed description';
    if (n === 'status') return 'Current status/state';
    if (n === 'type') return 'Classification type';
    if (n === 'email') return 'Email address';
    if (n === 'phone') return 'Phone number';
    if (n === 'address') return 'Physical address';
    
    // Based on data type
    if (dataType === 'boolean') return 'Flag/toggle';
    if (dataType === 'jsonb' || dataType === 'json') return 'Structured data';
    if (dataType.includes('timestamp')) return 'Date/time value';
    if (dataType.includes('numeric') || dataType.includes('int')) return 'Numeric value';
    
    return 'Data field';
  }

  private inferFunctionPurpose(name: string): string {
    const n = name.toLowerCase();
    
    if (n.includes('trigger')) return 'Database trigger';
    if (n.includes('validate')) return 'Data validation';
    if (n.includes('calculate')) return 'Calculation/computation';
    if (n.includes('process')) return 'Data processing';
    if (n.includes('generate')) return 'Data generation';
    if (n.includes('cleanup')) return 'Data cleanup';
    if (n.includes('migrate')) return 'Data migration';
    if (n.includes('auth')) return 'Authentication helper';
    if (n.includes('rls')) return 'RLS helper';
    
    return 'Business logic';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private singularize(word: string): string {
    // Simple singularization
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s')) return word.slice(0, -1);
    return word;
  }

  private generatePriorityActions(database: DatabaseAnalysis, storage: StorageAnalysis): string {
    const actions: string[] = [];
    
    // Critical security issues
    if (database.missing_rls_tables.length > 5) {
      actions.push(`1. **Enable RLS on ${database.missing_rls_tables.length} tables** - Critical security risk`);
    }
    
    // Performance issues
    const largeTables = database.tables.filter(t => t.row_count > 10000);
    if (largeTables.length > 0) {
      actions.push(`2. **Optimize ${largeTables.length} large tables** - Add indexes and consider partitioning`);
    }
    
    // Cleanup opportunities
    const cleanupItems = database.orphaned_tables.length + storage.empty_buckets.length;
    if (cleanupItems > 0) {
      actions.push(`3. **Clean up ${cleanupItems} unused resources** - Free up space and reduce clutter`);
    }
    
    // Storage optimization
    if (storage.large_files.length > 10) {
      const totalSize = storage.large_files.reduce((sum, f) => sum + f.size, 0);
      actions.push(`4. **Optimize storage** - ${storage.large_files.length} large files using ${this.formatBytes(totalSize)}`);
    }
    
    if (actions.length === 0) {
      actions.push('- No critical actions required. System is well-maintained.');
    }
    
    return actions.join('\n');
  }
}
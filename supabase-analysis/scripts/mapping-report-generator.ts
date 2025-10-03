import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MappingAnalysis, TableMapping, CodeQualityIssue } from './mapping-analyzer';

export class MappingReportGenerator {
  async generateReports(analysis: MappingAnalysis, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    // Generate YAML report
    await this.generateYAML(analysis, path.join(outputDir, 'db-code-mapping.yaml'));
    
    // Generate unused tables YAML
    await this.generateUnusedTablesYAML(analysis, path.join(outputDir, 'unused-tables.yaml'));
    
    // Generate Markdown report
    await this.generateMarkdown(analysis, path.join(outputDir, 'mapping-report.md'));
    
    console.log(`\n✅ Mapping reports generated in: ${outputDir}`);
  }

  private async generateYAML(analysis: MappingAnalysis, filePath: string): Promise<void> {
    const yamlContent = yaml.dump(analysis, {
      indent: 2,
      lineWidth: 120,
      sortKeys: false,
      noRefs: true
    });
    
    await fs.writeFile(filePath, yamlContent, 'utf8');
  }

  private async generateUnusedTablesYAML(analysis: MappingAnalysis, filePath: string): Promise<void> {
    const unusedData = {
      analyzed_at: analysis.analyzedAt,
      total_unused: analysis.unmappedTables,
      unused_with_data: analysis.unmappedTableDetails.filter(t => t.rowCount > 0),
      unused_empty: analysis.unmappedTableDetails.filter(t => t.rowCount === 0),
      cleanup_sql: this.generateCleanupSQL(analysis.unmappedTableDetails.filter(t => t.rowCount === 0))
    };
    
    const yamlContent = yaml.dump(unusedData, {
      indent: 2,
      lineWidth: 120,
      sortKeys: false
    });
    
    await fs.writeFile(filePath, yamlContent, 'utf8');
  }

  private generateCleanupSQL(emptyTables: any[]): string[] {
    return emptyTables.map(table => `DROP TABLE IF EXISTS public.${table.name};`);
  }

  private async generateMarkdown(analysis: MappingAnalysis, filePath: string): Promise<void> {
    const markdown = this.buildMarkdownReport(analysis);
    await fs.writeFile(filePath, markdown, 'utf8');
  }

  private buildMarkdownReport(analysis: MappingAnalysis): string {
    const sections: string[] = [];

    // Header
    sections.push(`# Database to Codebase Mapping Report

Generated: ${analysis.analyzedAt}
Codebase Path: ${analysis.codebasePath}

## Executive Summary

### Overview
- **Total Database Tables**: ${analysis.totalTables}
- **Tables with Code References**: ${analysis.mappedTables} (${Math.round(analysis.mappedTables / analysis.totalTables * 100)}%)
- **Unused Tables**: ${analysis.unmappedTables} (${Math.round(analysis.unmappedTables / analysis.totalTables * 100)}%)
- **Code Quality Issues**: ${analysis.codeQualityIssues.length}

### Key Findings
${this.generateKeyFindings(analysis)}

## Table Usage Analysis
`);

    // Hot tables (most referenced)
    const hotTables = Object.values(analysis.tableMappings)
      .sort((a, b) => b.totalReferences - a.totalReferences)
      .slice(0, 10);

    if (hotTables.length > 0) {
      sections.push(`### Most Referenced Tables

| Table | References | Patterns | Operations |
|-------|------------|----------|------------|`);
      
      for (const table of hotTables) {
        const patterns = table.accessPatterns.map(p => p.pattern).join(', ');
        const operations = table.operations.slice(0, 3).join(', ') + 
          (table.operations.length > 3 ? '...' : '');
        
        sections.push(
          `| ${table.tableName} | ${table.totalReferences} | ${patterns} | ${operations} |`
        );
      }
    }

    // Code quality issues
    if (analysis.codeQualityIssues.length > 0) {
      sections.push(`\n### Code Quality Issues

| Severity | Type | Table | Description |
|----------|------|-------|-------------|`);
      
      for (const issue of analysis.codeQualityIssues.slice(0, 15)) {
        const severity = issue.severity === 'high' ? '🔴 High' :
                        issue.severity === 'medium' ? '🟡 Medium' : '🟢 Low';
        
        sections.push(
          `| ${severity} | ${this.formatIssueType(issue.type)} | ${issue.table} | ${issue.description} |`
        );
      }
    }

    // Unused tables
    sections.push(`\n## Unused Tables Analysis

### Summary
- **Total Unused**: ${analysis.unmappedTables} tables
- **With Data**: ${analysis.unmappedTableDetails.filter(t => t.rowCount > 0).length} tables
- **Empty**: ${analysis.unmappedTableDetails.filter(t => t.rowCount === 0).length} tables

### Unused Tables with Data (Requires Review)
`);

    const unusedWithData = analysis.unmappedTableDetails
      .filter(t => t.rowCount > 0)
      .sort((a, b) => b.rowCount - a.rowCount);

    if (unusedWithData.length > 0) {
      sections.push(`| Table | Row Count | Likely Reason |
|-------|-----------|---------------|`);
      
      for (const table of unusedWithData) {
        sections.push(
          `| ${table.name} | ${table.rowCount.toLocaleString()} | ${this.formatReason(table.reason)} |`
        );
      }
    } else {
      sections.push('*No unused tables with data found.*');
    }

    // Table details
    sections.push(`\n## Detailed Table Mappings

Click on a table name to see detailed usage information.
`);

    // Group tables by domain/pattern
    const tablesByDomain = this.groupTablesByDomain(analysis.tableMappings);
    
    for (const [domain, tables] of Object.entries(tablesByDomain)) {
      sections.push(`\n### ${domain} Tables\n`);
      
      for (const tableName of tables.sort()) {
        const mapping = analysis.tableMappings[tableName];
        if (!mapping) continue;
        
        sections.push(`<details>
<summary><b>${tableName}</b> (${mapping.totalReferences} references)</summary>

#### Access Patterns
${this.formatAccessPatterns(mapping)}

#### File Locations
${this.formatFileLocations(mapping)}

#### Operations Used
${mapping.operations.length > 0 ? '`' + mapping.operations.join('`, `') + '`' : '*No specific operations tracked*'}

#### Table Relationships
${this.formatRelationships(mapping)}

</details>
`);
      }
    }

    // Recommendations
    sections.push(`\n## Recommendations

### Priority Actions
`);

    analysis.recommendations.forEach((rec, idx) => {
      sections.push(`${idx + 1}. ${rec}`);
    });

    // Cleanup opportunities
    const emptyUnused = analysis.unmappedTableDetails.filter(t => t.rowCount === 0);
    if (emptyUnused.length > 0) {
      sections.push(`\n### Cleanup Script

\`\`\`sql
-- Empty tables with no code references (${emptyUnused.length} tables)
${emptyUnused.slice(0, 10).map(t => `DROP TABLE IF EXISTS public.${t.name};`).join('\n')}${
  emptyUnused.length > 10 ? `\n-- ... and ${emptyUnused.length - 10} more tables` : ''
}
\`\`\`
`);
    }

    // Access pattern recommendations
    sections.push(`\n### Access Pattern Improvements

Based on the analysis, consider these architectural improvements:
`);

    const directAccessTables = Object.values(analysis.tableMappings)
      .filter(m => m.accessPatterns.some(p => p.pattern === 'direct'))
      .sort((a, b) => b.totalReferences - a.totalReferences)
      .slice(0, 5);

    if (directAccessTables.length > 0) {
      sections.push(`\n#### Create Repositories For:
${directAccessTables.map(t => `- \`${t.tableName}\` (${t.totalReferences} direct references)`).join('\n')}`);
    }

    // Footer
    sections.push(`\n---

## Appendix

### Understanding Access Patterns

- **Repository**: Table is accessed through a dedicated repository class (best practice)
- **Service**: Table is accessed through service layer (good for business logic)
- **API**: Table is accessed directly in API routes (consider moving to service/repository)
- **Direct**: Table is accessed directly using Supabase client (should be refactored)

### Understanding Code Quality Issues

- **Direct Access**: Database queries outside of repository pattern
- **Missing Repository**: No dedicated repository for frequently used table
- **Inconsistent Pattern**: Table accessed through multiple different patterns
- **Missing Types**: No TypeScript types defined for table structure
`);

    return sections.join('\n');
  }

  private generateKeyFindings(analysis: MappingAnalysis): string {
    const findings: string[] = [];

    // High severity issues
    const highSeverityCount = analysis.codeQualityIssues.filter(i => i.severity === 'high').length;
    if (highSeverityCount > 0) {
      findings.push(`- ⚠️ **${highSeverityCount} high-severity code quality issues** requiring immediate attention`);
    }

    // Unused tables with data
    const unusedWithData = analysis.unmappedTableDetails.filter(t => t.rowCount > 0).length;
    if (unusedWithData > 0) {
      findings.push(`- 📊 **${unusedWithData} tables contain data but have no code references**`);
    }

    // Direct access pattern
    const directAccessCount = Object.values(analysis.tableMappings)
      .filter(m => m.accessPatterns.some(p => p.pattern === 'direct')).length;
    if (directAccessCount > 10) {
      findings.push(`- 🔧 **${directAccessCount} tables use direct database access** instead of repository pattern`);
    }

    // Success patterns
    const repoPatternCount = Object.values(analysis.tableMappings)
      .filter(m => m.accessPatterns.some(p => p.pattern === 'repository')).length;
    if (repoPatternCount > 0) {
      findings.push(`- ✅ **${repoPatternCount} tables follow repository pattern** (good practice)`);
    }

    return findings.length > 0 ? findings.join('\n') : '- No critical findings';
  }

  private formatIssueType(type: CodeQualityIssue['type']): string {
    const typeMap = {
      'direct_access': 'Direct DB Access',
      'missing_repository': 'No Repository',
      'inconsistent_pattern': 'Inconsistent Access',
      'missing_types': 'No Type Definitions'
    };
    return typeMap[type] || type;
  }

  private formatReason(reason: string): string {
    const reasonMap = {
      'no_references': 'No code references found',
      'deprecated': 'Likely deprecated (name pattern)',
      'migration_only': 'Migration artifact (empty, no FKs)'
    };
    return reasonMap[reason] || reason;
  }

  private groupTablesByDomain(mappings: Record<string, TableMapping>): Record<string, string[]> {
    const domains: Record<string, string[]> = {
      'User Management': [],
      'Customer & Properties': [],
      'Jobs & Work': [],
      'Equipment & Materials': [],
      'Voice & AI': [],
      'Vision & Media': [],
      'Notifications': [],
      'System & Audit': [],
      'Other': []
    };

    for (const tableName of Object.keys(mappings)) {
      const name = tableName.toLowerCase();
      
      if (name.includes('user') || name.includes('auth') || name.includes('role') || name.includes('permission')) {
        domains['User Management'].push(tableName);
      } else if (name.includes('customer') || name.includes('property') || name.includes('tenant')) {
        domains['Customer & Properties'].push(tableName);
      } else if (name.includes('job') || name.includes('work') || name.includes('task')) {
        domains['Jobs & Work'].push(tableName);
      } else if (name.includes('equipment') || name.includes('material') || name.includes('inventory')) {
        domains['Equipment & Materials'].push(tableName);
      } else if (name.includes('voice') || name.includes('ai') || name.includes('intent') || name.includes('conversation')) {
        domains['Voice & AI'].push(tableName);
      } else if (name.includes('vision') || name.includes('media') || name.includes('image') || name.includes('photo')) {
        domains['Vision & Media'].push(tableName);
      } else if (name.includes('notification') || name.includes('queue')) {
        domains['Notifications'].push(tableName);
      } else if (name.includes('audit') || name.includes('log') || name.includes('system')) {
        domains['System & Audit'].push(tableName);
      } else {
        domains['Other'].push(tableName);
      }
    }

    // Remove empty domains
    return Object.fromEntries(
      Object.entries(domains).filter(([_, tables]) => tables.length > 0)
    );
  }

  private formatAccessPatterns(mapping: TableMapping): string {
    if (mapping.accessPatterns.length === 0) return '*No access patterns detected*';
    
    const patterns = mapping.accessPatterns
      .sort((a, b) => b.count - a.count)
      .map(p => `- **${this.capitalizeFirst(p.pattern)}**: ${p.count} file${p.count > 1 ? 's' : ''}`);
    
    return patterns.join('\n');
  }

  private formatFileLocations(mapping: TableMapping): string {
    if (mapping.locations.length === 0) return '*No file locations found*';
    
    // Group by file type
    const byType = new Map<string, typeof mapping.locations>();
    for (const loc of mapping.locations) {
      if (!byType.has(loc.type)) {
        byType.set(loc.type, []);
      }
      byType.get(loc.type)!.push(loc);
    }

    const output: string[] = [];
    
    for (const [type, locations] of byType) {
      output.push(`\n**${this.capitalizeFirst(type)}:**`);
      const samples = locations.slice(0, 3);
      for (const loc of samples) {
        const ops = loc.operations.length > 0 ? ` (${loc.operations.join(', ')})` : '';
        output.push(`- \`${loc.file}:${loc.line}\`${ops}`);
      }
      if (locations.length > 3) {
        output.push(`- *... and ${locations.length - 3} more locations*`);
      }
    }

    return output.join('\n');
  }

  private formatRelationships(mapping: TableMapping): string {
    const parts: string[] = [];
    
    if (mapping.relationships.references.length > 0) {
      parts.push(`- **References**: ${mapping.relationships.references.join(', ')}`);
    }
    
    if (mapping.relationships.referencedBy.length > 0) {
      parts.push(`- **Referenced by**: ${mapping.relationships.referencedBy.join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join('\n') : '*No foreign key relationships*';
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
  }
}
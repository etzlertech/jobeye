import type { AnalysisReport, Recommendation } from '../models/analysis-report.model';
import type { RedundancyFinding } from '../models/redundancy.model';
import type { DatabaseTableMapping } from '../models/database-table-mapping.model';
import { RedundancyType } from '../models/redundancy.model';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ReportOptions {
  format?: 'markdown' | 'json';
  includeDetails?: boolean;
  outputPath?: string;
}

export class ReportGeneratorService {
  async generateReport(
    analysis: AnalysisReport,
    options: ReportOptions = {}
  ): Promise<string> {
    const format = options.format || 'markdown';

    if (format === 'json') {
      return this.generateJsonReport(analysis);
    }

    return this.generateMarkdownReport(analysis, options);
  }

  private generateJsonReport(analysis: AnalysisReport): string {
    return JSON.stringify(analysis, null, 2);
  }

  private generateMarkdownReport(
    analysis: AnalysisReport,
    options: ReportOptions
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(this.generateHeader(analysis));

    // Executive Summary
    sections.push(this.generateExecutiveSummary(analysis));

    // Findings by Category
    sections.push(this.generateFindingsByCategory(analysis));

    // Recommendations
    sections.push(this.generateRecommendations(analysis));

    // Detailed Findings
    if (options.includeDetails !== false) {
      sections.push(this.generateDetailedFindings(analysis));
    }

    // Footer
    sections.push(this.generateFooter(analysis));

    return sections.join('\n\n');
  }

  private generateHeader(analysis: AnalysisReport): string {
    return `# Redundancy Analysis Report

**Project**: ${analysis.projectName}  
**Analysis ID**: ${analysis.id}  
**Date**: ${analysis.analysisDate.toISOString().split('T')[0]}  
**Total Files Analyzed**: ${analysis.totalFiles}  
**Total Database Tables**: ${analysis.totalTables}`;
  }

  private generateExecutiveSummary(analysis: AnalysisReport): string {
    const { summary } = analysis;
    
    return `## Executive Summary

- **Total redundant code**: ${summary.totalRedundancy.toLocaleString()} lines
- **Critical findings**: ${summary.criticalFindings}
- **Tables without CRUD**: ${summary.tablesWithoutCrud}
- **Unused code percentage**: ${summary.unusedCodePercentage.toFixed(1)}%
- **Estimated cleanup effort**: ${this.estimateCleanupEffort(analysis)} days

### Key Issues Identified
${this.generateKeyIssues(analysis)}

### Immediate Actions Required
${this.generateImmediateActions(analysis)}`;
  }

  private generateKeyIssues(analysis: AnalysisReport): string {
    const issues: string[] = [];

    // Count findings by type
    const findingCounts = new Map<string, number>();
    analysis.findings.forEach((f) => {
      findingCounts.set(f.type, (findingCounts.get(f.type) || 0) + 1);
    });

    findingCounts.forEach((count, type) => {
      if (count > 0) {
        issues.push(`- **${this.formatFindingType(type)}**: ${count} instances found`);
      }
    });

    return issues.length > 0 ? issues.join('\n') : '- No significant issues found';
  }

  private formatFindingType(type: string): string {
    const typeMap: Record<string, string> = {
      [RedundancyType.EXACT_DUPLICATE]: 'Exact Duplicates',
      [RedundancyType.SIMILAR_LOGIC]: 'Similar Logic',
      [RedundancyType.OVERLAPPING_FEATURE]: 'Overlapping Features',
      [RedundancyType.UNUSED_CODE]: 'Unused Code',
      [RedundancyType.ABANDONED_TABLE]: 'Abandoned Tables',
      [RedundancyType.DUPLICATE_API]: 'Duplicate APIs',
    };
    return typeMap[type] || type;
  }

  private generateImmediateActions(analysis: AnalysisReport): string {
    const highPriorityRecs = analysis.recommendations
      .filter((r) => r.priority === 'high')
      .slice(0, 3);

    if (highPriorityRecs.length === 0) {
      return '- No critical actions required';
    }

    return highPriorityRecs
      .map((r) => `- ${r.action}`)
      .join('\n');
  }

  private estimateCleanupEffort(analysis: AnalysisReport): number {
    // Rough estimate: 100 LoC per day
    const days = Math.ceil(analysis.summary.totalRedundancy / 100);
    return Math.max(1, days);
  }

  private generateFindingsByCategory(analysis: AnalysisReport): string {
    const sections: string[] = ['## Findings by Category'];

    // Group findings by type
    const findingsByType = new Map<RedundancyType, RedundancyFinding[]>();
    analysis.findings.forEach((f) => {
      const list = findingsByType.get(f.type) || [];
      list.push(f);
      findingsByType.set(f.type, list);
    });

    let categoryIndex = 1;
    
    // Duplicate Implementations
    const duplicates = findingsByType.get(RedundancyType.EXACT_DUPLICATE) || [];
    const similar = findingsByType.get(RedundancyType.SIMILAR_LOGIC) || [];
    if (duplicates.length > 0 || similar.length > 0) {
      sections.push(this.generateDuplicateSection([...duplicates, ...similar], categoryIndex++));
    }

    // Overlapping Features
    const overlapping = findingsByType.get(RedundancyType.OVERLAPPING_FEATURE) || [];
    if (overlapping.length > 0) {
      sections.push(this.generateOverlappingSection(overlapping, categoryIndex++));
    }

    // Unused Code
    const unused = findingsByType.get(RedundancyType.UNUSED_CODE) || [];
    if (unused.length > 0) {
      sections.push(this.generateUnusedSection(unused, categoryIndex++));
    }

    // Abandoned Tables
    const abandoned = findingsByType.get(RedundancyType.ABANDONED_TABLE) || [];
    if (abandoned.length > 0) {
      sections.push(this.generateAbandonedTablesSection(abandoned, categoryIndex++));
    }

    return sections.join('\n\n');
  }

  private generateDuplicateSection(findings: RedundancyFinding[], index: number): string {
    const highPriority = findings.filter((f) => f.severity === 'high');
    
    let section = `### ${index}. Duplicate Implementations

Found ${findings.length} instances of duplicate or highly similar code.`;

    if (highPriority.length > 0) {
      section += '\n\n#### High Priority Duplicates\n';
      highPriority.slice(0, 5).forEach((f) => {
        section += `\n**${f.primaryLocation.snippet}**\n`;
        section += `- Primary: \`${f.primaryLocation.filePath}\` (${f.impactScore.scale} LoC)\n`;
        f.duplicateLocations.forEach((d) => {
          section += `- Duplicate: \`${d.filePath}\` (lines ${d.startLine}-${d.endLine})\n`;
        });
        section += `- **Recommendation**: ${f.recommendation}\n`;
        section += `- **Impact**: Remove ~${f.estimatedSavings} lines of duplicate code\n`;
      });
    }

    return section;
  }

  private generateOverlappingSection(findings: RedundancyFinding[], index: number): string {
    return `### ${index}. Overlapping Features

Found ${findings.length} instances of overlapping functionality across different domains.

${findings.slice(0, 5).map((f) => 
  `- **${f.primaryLocation.snippet}** overlaps with ${f.duplicateLocations.length} other implementations`
).join('\n')}`;
  }

  private generateUnusedSection(findings: RedundancyFinding[], index: number): string {
    const totalUnusedLines = findings.reduce((sum, f) => sum + f.estimatedSavings, 0);
    
    return `### ${index}. Unused Code

Found ${findings.length} unused code segments totaling ${totalUnusedLines.toLocaleString()} lines.

Top unused modules:
${findings.slice(0, 5).map((f) => 
  `- \`${f.primaryLocation.filePath}\`: ${f.primaryLocation.snippet} (${f.estimatedSavings} lines)`
).join('\n')}`;
  }

  private generateAbandonedTablesSection(findings: RedundancyFinding[], index: number): string {
    // Group by domain/prefix
    const tableGroups = new Map<string, RedundancyFinding[]>();
    
    findings.forEach((f) => {
      const tableName = f.primaryLocation.snippet;
      const prefix = tableName.split('_')[0];
      const group = tableGroups.get(prefix) || [];
      group.push(f);
      tableGroups.set(prefix, group);
    });

    let section = `### ${index}. Abandoned Tables (No CRUD Operations)\n\n`;

    tableGroups.forEach((tables, prefix) => {
      section += `- **${prefix}_*** (${tables.length} tables, 0 repositories)\n`;
    });

    section += `\n**Total**: ${findings.length} tables without application code`;

    return section;
  }

  private generateRecommendations(analysis: AnalysisReport): string {
    let section = '## Recommendations\n';

    // Group by priority
    const byPriority = {
      high: analysis.recommendations.filter((r) => r.priority === 'high'),
      medium: analysis.recommendations.filter((r) => r.priority === 'medium'),
      low: analysis.recommendations.filter((r) => r.priority === 'low'),
    };

    if (byPriority.high.length > 0) {
      section += '\n### High Priority\n';
      byPriority.high.forEach((r, i) => {
        section += this.formatRecommendation(r, i + 1);
      });
    }

    if (byPriority.medium.length > 0) {
      section += '\n### Medium Priority\n';
      byPriority.medium.forEach((r, i) => {
        section += this.formatRecommendation(r, i + 1);
      });
    }

    if (byPriority.low.length > 0) {
      section += '\n### Low Priority\n';
      byPriority.low.forEach((r, i) => {
        section += this.formatRecommendation(r, i + 1);
      });
    }

    return section;
  }

  private formatRecommendation(rec: Recommendation, index: number): string {
    return `
${index}. **${rec.action}**
   - **Priority**: ${rec.priority}
   - **Impact**: ${rec.impact}
   - **Effort**: ${rec.effort}
   - **Related Findings**: ${rec.relatedFindings.length} items
`;
  }

  private generateDetailedFindings(analysis: AnalysisReport): string {
    let section = '## Detailed Findings\n';

    analysis.findings.forEach((finding, index) => {
      if (index < 20) { // Limit to first 20 for readability
        section += `\n### Finding ${index + 1}: ${this.formatFindingType(finding.type)}\n`;
        section += `- **Severity**: ${finding.severity}\n`;
        section += `- **Primary Location**: \`${finding.primaryLocation.filePath}\` (lines ${finding.primaryLocation.startLine}-${finding.primaryLocation.endLine})\n`;
        section += `- **Duplicates**: ${finding.duplicateLocations.length} instances\n`;
        section += `- **Estimated Savings**: ${finding.estimatedSavings} lines\n`;
        section += `- **Impact Score**: Scale=${finding.impactScore.scale}, Risk=${finding.impactScore.risk}, Quality=${finding.impactScore.quality}\n`;
        section += `- **Recommendation**: ${finding.recommendation}\n`;
      }
    });

    if (analysis.findings.length > 20) {
      section += `\n... and ${analysis.findings.length - 20} more findings`;
    }

    return section;
  }

  private generateFooter(analysis: AnalysisReport): string {
    return `---

*Generated by Redundancy Analyzer v1.0.0*  
*Analysis completed in ${this.getAnalysisDuration(analysis)}*`;
  }

  private getAnalysisDuration(analysis: AnalysisReport): string {
    // In a real implementation, we'd track start/end times
    return 'N/A';
  }

  async saveReport(
    report: string,
    outputPath: string,
    filename?: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const reportFilename = filename || `redundancy-analysis-${timestamp}.md`;
    const fullPath = path.join(outputPath, reportFilename);

    await fs.mkdir(outputPath, { recursive: true });
    await fs.writeFile(fullPath, report, 'utf-8');

    return fullPath;
  }
}
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import type { AnalysisReport } from '../models/analysis-report.model';
import type { RedundancyFinding } from '../models/redundancy.model';

export class OutputHandler {
  async saveReport(
    report: AnalysisReport,
    outputDir: string,
    format: 'markdown' | 'json' = 'markdown'
  ): Promise<string> {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `redundancy-report-${timestamp}.${format === 'json' ? 'json' : 'md'}`;
    const filePath = path.join(outputDir, filename);

    // Generate content based on format
    const content = format === 'json' 
      ? this.generateJsonReport(report)
      : this.generateMarkdownReport(report);

    // Write to file
    await fs.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  private generateMarkdownReport(report: AnalysisReport): string {
    const lines: string[] = [];

    // Header
    lines.push('# Redundancy Analysis Report');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Analysis ID: ${report.id}`);
    lines.push('');

    // Summary
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`- **Total Files Analyzed**: ${report.summary.totalFiles.toLocaleString()}`);
    lines.push(`- **Total Lines of Code**: ${report.summary.totalLinesOfCode.toLocaleString()}`);
    lines.push(`- **Redundant Code Found**: ${report.summary.totalRedundancy.toLocaleString()} lines`);
    lines.push(`- **Critical Findings**: ${report.summary.criticalFindings}`);
    lines.push(`- **High Priority Issues**: ${report.summary.highPriorityIssues}`);
    lines.push(`- **Tables Without CRUD**: ${report.summary.tablesWithoutCrud}`);
    lines.push(`- **Duplicate API Endpoints**: ${report.summary.duplicateEndpoints}`);
    lines.push('');

    // Metrics
    lines.push('## Impact Metrics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Scale (LoC affected) | ${report.metrics.totalScale.toLocaleString()} |`);
    lines.push(`| Average Risk Score | ${report.metrics.averageRisk.toFixed(1)} |`);
    lines.push(`| Average Quality Score | ${report.metrics.averageQuality.toFixed(1)}% |`);
    lines.push('');

    // Critical Findings
    const criticalFindings = report.findings.filter(f => f.severity === 'high');
    if (criticalFindings.length > 0) {
      lines.push('## Critical Findings');
      lines.push('');
      criticalFindings.forEach((finding, index) => {
        lines.push(`### ${index + 1}. ${this.formatFindingTitle(finding)}`);
        lines.push('');
        lines.push(`**Type**: ${this.formatRedundancyType(finding.type)}`);
        lines.push(`**Severity**: ${finding.severity.toUpperCase()}`);
        lines.push(`**Impact**: Scale=${finding.impactScore.scale} | Risk=${finding.impactScore.risk} | Quality=${finding.impactScore.quality}%`);
        lines.push('');
        lines.push('**Description**:');
        lines.push(finding.description);
        lines.push('');
        if (finding.locations.length > 0) {
          lines.push('**Locations**:');
          finding.locations.forEach(loc => {
            lines.push(`- ${loc}`);
          });
          lines.push('');
        }
        if (finding.suggestedAction) {
          lines.push('**Suggested Action**:');
          lines.push(finding.suggestedAction);
          lines.push('');
        }
      });
    }

    // All Findings by Category
    lines.push('## All Findings by Category');
    lines.push('');

    const findingsByType = this.groupFindingsByType(report.findings);
    Object.entries(findingsByType).forEach(([type, findings]) => {
      lines.push(`### ${this.formatRedundancyType(type)} (${findings.length} issues)`);
      lines.push('');
      
      findings.forEach(finding => {
        lines.push(`- **${finding.locations[0] || 'Multiple locations'}**`);
        lines.push(`  - Severity: ${finding.severity}`);
        lines.push(`  - Impact: ${finding.impactScore.scale} LoC`);
        lines.push(`  - ${finding.description.substring(0, 100)}...`);
      });
      lines.push('');
    });

    // Database Analysis
    lines.push('## Database Analysis');
    lines.push('');
    lines.push('### Tables Without Repository Implementation');
    lines.push('');
    const abandonedTables = report.findings
      .filter(f => f.type === 'ABANDONED_TABLE')
      .map(f => f.relatedItems?.[0])
      .filter(Boolean);
    
    if (abandonedTables.length > 0) {
      lines.push('| Table Name | Status |');
      lines.push('|------------|--------|');
      abandonedTables.forEach(table => {
        lines.push(`| ${table} | No CRUD operations |`);
      });
    } else {
      lines.push('No abandoned tables found.');
    }
    lines.push('');

    // Recommendations
    lines.push('## Recommendations');
    lines.push('');
    lines.push('### Immediate Actions (High Priority)');
    const highPriorityActions = report.findings
      .filter(f => f.severity === 'high' && f.suggestedAction)
      .slice(0, 5);
    
    highPriorityActions.forEach((finding, index) => {
      lines.push(`${index + 1}. ${finding.suggestedAction}`);
    });
    lines.push('');

    lines.push('### Long-term Improvements');
    lines.push('1. Implement a module consolidation strategy for duplicate functionality');
    lines.push('2. Create repository implementations for all active database tables');
    lines.push('3. Remove or archive unused code modules');
    lines.push('4. Standardize API endpoint patterns to avoid duplication');
    lines.push('5. Establish code review practices to prevent future redundancy');
    lines.push('');

    // Footer
    lines.push('---');
    lines.push(`Report generated by Redundancy Analyzer v1.0.0 on ${new Date().toISOString()}`);

    return lines.join('\n');
  }

  private generateJsonReport(report: AnalysisReport): string {
    return JSON.stringify(report, null, 2);
  }

  private formatRedundancyType(type: string): string {
    const typeMap: Record<string, string> = {
      'EXACT_DUPLICATE': 'Exact Duplicate Code',
      'SIMILAR_LOGIC': 'Similar Logic',
      'OVERLAPPING_FEATURE': 'Overlapping Features',
      'UNUSED_CODE': 'Unused Code',
      'ABANDONED_TABLE': 'Abandoned Database Table',
      'DUPLICATE_API': 'Duplicate API Endpoint',
    };
    return typeMap[type] || type;
  }

  private formatFindingTitle(finding: RedundancyFinding): string {
    switch (finding.type) {
      case 'EXACT_DUPLICATE':
        return `Duplicate: ${finding.locations[0]} and ${finding.locations[1]}`;
      case 'SIMILAR_LOGIC':
        return `Similar Code: ${finding.locations[0]}`;
      case 'OVERLAPPING_FEATURE':
        return `Overlapping Feature: ${finding.relatedItems?.join(', ')}`;
      case 'UNUSED_CODE':
        return `Unused Module: ${finding.locations[0]}`;
      case 'ABANDONED_TABLE':
        return `Abandoned Table: ${finding.relatedItems?.[0]}`;
      case 'DUPLICATE_API':
        return `Duplicate API: ${finding.relatedItems?.join(', ')}`;
      default:
        return finding.description.substring(0, 50);
    }
  }

  private groupFindingsByType(findings: RedundancyFinding[]): Record<string, RedundancyFinding[]> {
    const grouped: Record<string, RedundancyFinding[]> = {};
    
    findings.forEach(finding => {
      if (!grouped[finding.type]) {
        grouped[finding.type] = [];
      }
      grouped[finding.type].push(finding);
    });

    return grouped;
  }

  async printSummary(report: AnalysisReport): void {
    console.log(chalk.yellow('\n📊 Analysis Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(`Total files analyzed: ${chalk.cyan(report.summary.totalFiles.toLocaleString())}`);
    console.log(`Total lines of code: ${chalk.cyan(report.summary.totalLinesOfCode.toLocaleString())}`);
    console.log(`Redundant code found: ${chalk.red(report.summary.totalRedundancy.toLocaleString())} lines`);
    
    console.log(chalk.gray('─'.repeat(50)));
    
    if (report.summary.criticalFindings > 0) {
      console.log(chalk.red(`⚠️  Critical findings: ${report.summary.criticalFindings}`));
    }
    
    if (report.summary.highPriorityIssues > 0) {
      console.log(chalk.yellow(`⚡ High priority issues: ${report.summary.highPriorityIssues}`));
    }
    
    if (report.summary.tablesWithoutCrud > 0) {
      console.log(chalk.yellow(`🗄️  Tables without CRUD: ${report.summary.tablesWithoutCrud}`));
    }
    
    if (report.summary.duplicateEndpoints > 0) {
      console.log(chalk.yellow(`🔗 Duplicate API endpoints: ${report.summary.duplicateEndpoints}`));
    }
    
    console.log(chalk.gray('─'.repeat(50)));
  }
}
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { EnhancedDatabaseAnalysis } from './db-analyzer-enhanced';

export class EnhancedReportGenerator {
  async generateReports(analysis: EnhancedDatabaseAnalysis, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    // Generate comprehensive YAML report
    await this.generateYAML(analysis, path.join(outputDir, 'enhanced-analysis.yaml'));
    
    // Generate comprehensive Markdown report
    await this.generateMarkdown(analysis, path.join(outputDir, 'enhanced-report.md'));
    
    // Generate focused reports
    await this.generateSecurityReport(analysis, path.join(outputDir, 'security-report.md'));
    await this.generatePerformanceReport(analysis, path.join(outputDir, 'performance-report.md'));
    
    // Generate actionable reports
    await this.generateActionPlan(analysis, path.join(outputDir, 'action-plan.md'));
    
    console.log(`✅ Enhanced reports generated in: ${outputDir}`);
  }

  private async generateYAML(analysis: EnhancedDatabaseAnalysis, filePath: string): Promise<void> {
    const yamlContent = yaml.dump(analysis, {
      indent: 2,
      lineWidth: 120,
      sortKeys: false,
      noRefs: true
    });
    
    await fs.writeFile(filePath, yamlContent, 'utf8');
  }

  private async generateMarkdown(analysis: EnhancedDatabaseAnalysis, filePath: string): Promise<void> {
    const markdown = this.buildComprehensiveReport(analysis);
    await fs.writeFile(filePath, markdown, 'utf8');
  }

  private buildComprehensiveReport(analysis: EnhancedDatabaseAnalysis): string {
    const sections: string[] = [];

    // Header
    sections.push(`# Enhanced Supabase Database Analysis Report

Generated: ${analysis.metadata.analyzed_at}
Analysis Version: ${analysis.metadata.analysis_version}
Total Analysis Time: ${(analysis.metadata.total_analysis_time / 1000).toFixed(2)}s

## Executive Summary

### 🎯 Key Metrics
- **Database Size**: ${this.formatBytes(analysis.basic.database_size)}
- **Total Tables**: ${analysis.basic.tables.length}
- **Total Rows**: ${analysis.basic.total_rows.toLocaleString()}
- **Storage Used**: ${analysis.storage?.total_size || 'N/A'}
`);

    // Critical Issues Summary
    const criticalIssues = this.getCriticalIssues(analysis);
    if (criticalIssues.length > 0) {
      sections.push(`### 🚨 Critical Issues Requiring Immediate Attention

${criticalIssues.map(issue => `- ${issue}`).join('\n')}
`);
    }

    // Database Objects Overview
    if (analysis.objects) {
      sections.push(`## 📦 Database Objects Overview

### Functions & Procedures
- **Total Functions**: ${analysis.objects.statistics.total_functions}
- **Trigger Functions**: ${analysis.objects.statistics.trigger_functions}
- **Aggregate Functions**: ${analysis.objects.statistics.aggregate_functions}
- **Window Functions**: ${analysis.objects.statistics.window_functions}

### Views & Materialized Views
- **Regular Views**: ${analysis.objects.statistics.total_views - analysis.objects.statistics.materialized_views}
- **Materialized Views**: ${analysis.objects.statistics.materialized_views}

### Other Objects
- **Triggers**: ${analysis.objects.statistics.total_triggers}
- **Sequences**: ${analysis.objects.statistics.total_sequences}
- **Extensions**: ${analysis.objects.statistics.total_extensions}
- **Custom Types**: ${analysis.objects.statistics.total_custom_types} (${analysis.objects.statistics.enum_types} enums)
`);
    }

    // Performance Analysis
    if (analysis.performance) {
      sections.push(`## ⚡ Performance Analysis

### Database Performance Metrics
- **Cache Hit Ratio**: ${analysis.performance.database_statistics.cache_hit_ratio}% ${this.getPerformanceIndicator(analysis.performance.database_statistics.cache_hit_ratio)}
- **Index Hit Ratio**: ${analysis.performance.database_statistics.index_hit_ratio}% ${this.getPerformanceIndicator(analysis.performance.database_statistics.index_hit_ratio)}
- **Database Size**: ${analysis.performance.database_statistics.database_size}
- **Deadlocks**: ${analysis.performance.database_statistics.deadlocks}

### Performance Issues (${analysis.performance.performance_issues.length} total)
${this.formatPerformanceIssues(analysis.performance.performance_issues)}
`);
    }

    // Security Analysis
    if (analysis.security) {
      sections.push(`## 🔒 Security Analysis

### Security Summary
- **Total Roles**: ${analysis.security.security_summary.total_roles} (${analysis.security.security_summary.superuser_roles} superusers)
- **Tables with RLS**: ${analysis.security.security_summary.tables_with_rls}/${analysis.basic.tables.length}
- **Tables without RLS**: ${analysis.security.security_summary.tables_without_rls} ⚠️
- **Total RLS Policies**: ${analysis.security.security_summary.total_policies}

### Security Vulnerabilities (${analysis.security.vulnerabilities.length} total)
${this.formatSecurityIssues(analysis.security.vulnerabilities)}
`);
    }

    // Edge Functions Analysis
    if (analysis.edge_functions) {
      sections.push(`## ⚡ Edge Functions Analysis

### Overview
- **Total Functions**: ${analysis.edge_functions.statistics.total_functions}
- **Deployed Functions**: ${analysis.edge_functions.statistics.deployed_functions}
- **Average Function Size**: ${this.formatBytes(analysis.edge_functions.statistics.avg_function_size)}

${analysis.edge_functions.functions.length > 0 ? this.formatEdgeFunctions(analysis.edge_functions.functions) : '*No Edge Functions found in the project.*'}
`);
    }

    // Realtime Analysis
    if (analysis.realtime) {
      sections.push(`## 📡 Realtime Subscriptions Analysis

### Configuration
- **Tables with Realtime**: ${analysis.realtime.statistics.tables_with_realtime}
- **High Traffic Tables**: ${analysis.realtime.statistics.high_traffic_tables}
- **Estimated Messages/sec**: ${analysis.realtime.statistics.total_estimated_messages}

${analysis.realtime.publications.length > 0 ? this.formatRealtimePublications(analysis.realtime.publications) : '*No Realtime publications configured.*'}
`);
    }

    // Recommendations
    sections.push(`## 💡 Consolidated Recommendations

${this.generateConsolidatedRecommendations(analysis)}
`);

    // Warnings
    if (analysis.metadata.warnings.length > 0) {
      sections.push(`## ⚠️ Analysis Warnings

The following warnings were encountered during analysis:

${analysis.metadata.warnings.map(w => `- ${w}`).join('\n')}
`);
    }

    return sections.join('\n');
  }

  private async generateSecurityReport(analysis: EnhancedDatabaseAnalysis, filePath: string): Promise<void> {
    if (!analysis.security) {
      return;
    }

    const sections: string[] = [];
    
    sections.push(`# Security Analysis Report

Generated: ${analysis.metadata.analyzed_at}

## Executive Summary

${this.generateSecurityExecutiveSummary(analysis.security)}

## Detailed Findings

### Tables Without RLS (${analysis.security.security_summary.tables_without_rls} total)

${this.formatTablesWithoutRLS(analysis.basic.tables, analysis.security.rls_policies)}

### Security Vulnerabilities by Severity

${this.formatSecurityVulnerabilitiesBySeverity(analysis.security.vulnerabilities)}

### Role Analysis

${this.formatRoleAnalysis(analysis.security.roles)}

### RLS Policy Details

${this.formatRLSPolicyDetails(analysis.security.rls_policies)}

## Security Hardening Checklist

${this.generateSecurityChecklist(analysis)}
`);

    await fs.writeFile(filePath, sections.join('\n'), 'utf8');
  }

  private async generatePerformanceReport(analysis: EnhancedDatabaseAnalysis, filePath: string): Promise<void> {
    if (!analysis.performance) {
      return;
    }

    const sections: string[] = [];
    
    sections.push(`# Performance Analysis Report

Generated: ${analysis.metadata.analyzed_at}

## Executive Summary

${this.generatePerformanceExecutiveSummary(analysis.performance)}

## Index Analysis

### Unused Indexes
${this.formatUnusedIndexes(analysis.performance.indexes)}

### Missing Index Opportunities
${this.formatMissingIndexOpportunities(analysis.performance)}

## Table Performance

### Tables Needing Maintenance
${this.formatTablesMaintenance(analysis.performance.table_statistics)}

### High Activity Tables
${this.formatHighActivityTables(analysis.performance.table_statistics)}

## Performance Optimization Plan

${this.generatePerformanceOptimizationPlan(analysis.performance)}
`);

    await fs.writeFile(filePath, sections.join('\n'), 'utf8');
  }

  private async generateActionPlan(analysis: EnhancedDatabaseAnalysis, filePath: string): Promise<void> {
    const sections: string[] = [];
    
    sections.push(`# Action Plan

Generated: ${analysis.metadata.analyzed_at}

## 🚨 Immediate Actions (Critical)

${this.generateImmediateActions(analysis)}

## 📅 Short-term Actions (This Week)

${this.generateShortTermActions(analysis)}

## 📆 Long-term Improvements (This Month)

${this.generateLongTermActions(analysis)}

## 📊 Monitoring Setup

${this.generateMonitoringRecommendations(analysis)}

## 🎯 Success Metrics

${this.generateSuccessMetrics(analysis)}
`);

    await fs.writeFile(filePath, sections.join('\n'), 'utf8');
  }

  // Helper methods
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getPerformanceIndicator(ratio: number): string {
    if (ratio >= 95) return '✅';
    if (ratio >= 90) return '⚠️';
    return '❌';
  }

  private getCriticalIssues(analysis: EnhancedDatabaseAnalysis): string[] {
    const issues: string[] = [];

    if (analysis.security) {
      const criticalSecurity = analysis.security.vulnerabilities.filter(v => v.severity === 'critical');
      criticalSecurity.forEach(v => {
        issues.push(`🔒 Security: ${v.description}`);
      });
    }

    if (analysis.performance) {
      const criticalPerf = analysis.performance.performance_issues.filter(i => i.severity === 'critical');
      criticalPerf.forEach(i => {
        issues.push(`⚡ Performance: ${i.description}`);
      });
    }

    return issues;
  }

  private formatPerformanceIssues(issues: any[]): string {
    if (issues.length === 0) return '*No performance issues detected.*';

    const byType = new Map<string, any[]>();
    issues.forEach(issue => {
      if (!byType.has(issue.type)) {
        byType.set(issue.type, []);
      }
      byType.get(issue.type)!.push(issue);
    });

    const formatted: string[] = [];
    byType.forEach((typeIssues, type) => {
      formatted.push(`\n#### ${this.formatIssueType(type)} (${typeIssues.length})`);
      typeIssues.slice(0, 3).forEach(issue => {
        formatted.push(`- ${issue.description}`);
        formatted.push(`  - Impact: ${issue.impact}`);
        formatted.push(`  - Fix: ${issue.recommendation}`);
      });
      if (typeIssues.length > 3) {
        formatted.push(`- *... and ${typeIssues.length - 3} more*`);
      }
    });

    return formatted.join('\n');
  }

  private formatIssueType(type: string): string {
    const typeMap: Record<string, string> = {
      'unused_index': '🗑️ Unused Indexes',
      'missing_index': '❌ Missing Indexes',
      'bloated_table': '🧹 Bloated Tables',
      'slow_query': '🐌 Slow Queries',
      'low_cache_hit': '💾 Low Cache Hit',
      'frequent_seq_scan': '📊 Frequent Sequential Scans'
    };
    return typeMap[type] || type;
  }

  private formatSecurityIssues(vulnerabilities: any[]): string {
    if (vulnerabilities.length === 0) return '*No security vulnerabilities detected.*';

    const bySeverity = new Map<string, any[]>();
    vulnerabilities.forEach(vuln => {
      if (!bySeverity.has(vuln.severity)) {
        bySeverity.set(vuln.severity, []);
      }
      bySeverity.get(vuln.severity)!.push(vuln);
    });

    const formatted: string[] = [];
    ['critical', 'high', 'medium', 'low'].forEach(severity => {
      const severityVulns = bySeverity.get(severity) || [];
      if (severityVulns.length > 0) {
        const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📝';
        formatted.push(`\n#### ${icon} ${severity.toUpperCase()} (${severityVulns.length})`);
        severityVulns.slice(0, 5).forEach(vuln => {
          formatted.push(`- ${vuln.description}`);
          formatted.push(`  - Risk: ${vuln.risk}`);
          formatted.push(`  - Fix: ${vuln.recommendation}`);
        });
      }
    });

    return formatted.join('\n');
  }

  private formatEdgeFunctions(functions: any[]): string {
    const sections: string[] = ['### Edge Functions Details\n'];
    
    functions.forEach(func => {
      sections.push(`#### ${func.name}`);
      sections.push(`- Status: ${func.deployed ? '✅ Deployed' : '❌ Not Deployed'}`);
      if (func.size) sections.push(`- Size: ${this.formatBytes(func.size)}`);
      if (func.description) sections.push(`- Description: ${func.description}`);
      if (func.deployed) {
        sections.push(`- Invocations: ${func.invocationCount || 0}`);
        sections.push(`- Error Rate: ${func.errorRate || 0}%`);
        sections.push(`- Avg Duration: ${func.avgDuration || 0}ms`);
      }
      sections.push('');
    });

    return sections.join('\n');
  }

  private formatRealtimePublications(publications: any[]): string {
    const sections: string[] = ['### Realtime Publications\n'];
    
    const highTraffic = publications.filter(p => p.estimated_message_rate > 100);
    if (highTraffic.length > 0) {
      sections.push('#### High Traffic Tables');
      highTraffic.forEach(pub => {
        sections.push(`- **${pub.table_name}**: ~${pub.estimated_message_rate} msgs/sec`);
      });
      sections.push('');
    }

    sections.push('#### All Publications');
    sections.push('| Table | Insert | Update | Delete | Est. Traffic |');
    sections.push('|-------|--------|--------|--------|--------------|');
    
    publications.slice(0, 10).forEach(pub => {
      sections.push(`| ${pub.table_name} | ${pub.publish_insert ? '✅' : '❌'} | ${pub.publish_update ? '✅' : '❌'} | ${pub.publish_delete ? '✅' : '❌'} | ${pub.estimated_message_rate}/sec |`);
    });

    if (publications.length > 10) {
      sections.push(`| *... and ${publications.length - 10} more* | | | | |`);
    }

    return sections.join('\n');
  }

  private generateConsolidatedRecommendations(analysis: EnhancedDatabaseAnalysis): string {
    const allRecommendations: { source: string; recommendations: string[] }[] = [];

    if (analysis.basic.recommendations) {
      allRecommendations.push({ source: 'Database', recommendations: analysis.basic.recommendations });
    }
    if (analysis.performance?.recommendations) {
      allRecommendations.push({ source: 'Performance', recommendations: analysis.performance.recommendations });
    }
    if (analysis.security?.recommendations) {
      allRecommendations.push({ source: 'Security', recommendations: analysis.security.recommendations });
    }
    if (analysis.edge_functions?.recommendations) {
      allRecommendations.push({ source: 'Edge Functions', recommendations: analysis.edge_functions.recommendations });
    }
    if (analysis.realtime?.recommendations) {
      allRecommendations.push({ source: 'Realtime', recommendations: analysis.realtime.recommendations });
    }

    const formatted: string[] = [];
    allRecommendations.forEach(({ source, recommendations }) => {
      if (recommendations.length > 0) {
        formatted.push(`### ${source} Recommendations`);
        recommendations.forEach(rec => {
          formatted.push(`- ${rec}`);
        });
        formatted.push('');
      }
    });

    return formatted.join('\n');
  }

  // Additional helper methods for specialized reports...
  private generateSecurityExecutiveSummary(security: any): string {
    const critical = security.vulnerabilities.filter((v: any) => v.severity === 'critical').length;
    const high = security.vulnerabilities.filter((v: any) => v.severity === 'high').length;
    
    const status = critical > 0 ? '🚨 CRITICAL' : high > 0 ? '⚠️ NEEDS ATTENTION' : '✅ GOOD';
    
    return `
**Security Status**: ${status}

- **Critical Issues**: ${critical}
- **High Priority Issues**: ${high}
- **Tables without RLS**: ${security.security_summary.tables_without_rls}
- **Superuser Roles**: ${security.security_summary.superuser_roles}
`;
  }

  private formatTablesWithoutRLS(tables: any[], policies: any[]): string {
    const tablesWithPolicies = new Set(policies.map((p: any) => p.table_name));
    const tablesWithoutRLS = tables.filter(t => !t.rls_enabled && t.row_count > 0);
    
    if (tablesWithoutRLS.length === 0) return '*All tables with data have RLS enabled.*';
    
    const formatted: string[] = [];
    formatted.push('| Table | Row Count | Risk Level |');
    formatted.push('|-------|-----------|------------|');
    
    tablesWithoutRLS
      .sort((a, b) => b.row_count - a.row_count)
      .slice(0, 20)
      .forEach(table => {
        const risk = table.row_count > 1000 ? 'HIGH' : table.row_count > 100 ? 'MEDIUM' : 'LOW';
        formatted.push(`| ${table.name} | ${table.row_count.toLocaleString()} | ${risk} |`);
      });
    
    return formatted.join('\n');
  }

  private formatSecurityVulnerabilitiesBySeverity(vulnerabilities: any[]): string {
    const sections: string[] = [];
    
    ['critical', 'high', 'medium', 'low'].forEach(severity => {
      const sevVulns = vulnerabilities.filter(v => v.severity === severity);
      if (sevVulns.length > 0) {
        sections.push(`### ${severity.toUpperCase()} Severity (${sevVulns.length})\n`);
        sevVulns.forEach(vuln => {
          sections.push(`**${vuln.type}**: ${vuln.description}`);
          sections.push(`- Table/Role: ${vuln.table || vuln.role || 'N/A'}`);
          sections.push(`- Risk: ${vuln.risk}`);
          sections.push(`- Recommendation: ${vuln.recommendation}\n`);
        });
      }
    });
    
    return sections.join('\n');
  }

  private formatRoleAnalysis(roles: any[]): string {
    const sections: string[] = [];
    
    const superusers = roles.filter(r => r.is_superuser);
    sections.push(`**Superuser Roles** (${superusers.length}):`);
    superusers.forEach(role => {
      sections.push(`- ${role.role_name}: ${role.owns_objects} owned objects`);
    });
    
    sections.push('\n**Login-enabled Roles**:');
    roles.filter(r => r.can_login && !r.is_superuser).forEach(role => {
      sections.push(`- ${role.role_name}: ${role.connection_limit === -1 ? 'unlimited' : role.connection_limit} connections`);
    });
    
    return sections.join('\n');
  }

  private formatRLSPolicyDetails(policies: any[]): string {
    const byTable = new Map<string, any[]>();
    policies.forEach(policy => {
      if (!byTable.has(policy.table_name)) {
        byTable.set(policy.table_name, []);
      }
      byTable.get(policy.table_name)!.push(policy);
    });
    
    const sections: string[] = [];
    byTable.forEach((tablePolicies, table) => {
      sections.push(`**${table}** (${tablePolicies.length} policies):`);
      tablePolicies.forEach(policy => {
        sections.push(`- ${policy.policy_name} (${policy.command}): ${policy.is_permissive ? 'PERMISSIVE' : 'RESTRICTIVE'}`);
      });
      sections.push('');
    });
    
    return sections.join('\n');
  }

  private generateSecurityChecklist(analysis: any): string {
    const checklist: string[] = [];
    
    checklist.push('- [ ] Enable RLS on all tables containing user data');
    checklist.push('- [ ] Review and tighten overly permissive RLS policies');
    checklist.push('- [ ] Remove unnecessary superuser roles');
    checklist.push('- [ ] Implement least-privilege access for all roles');
    checklist.push('- [ ] Review PUBLIC grants and remove if unnecessary');
    checklist.push('- [ ] Enable audit logging for sensitive tables');
    checklist.push('- [ ] Implement column-level encryption for PII data');
    checklist.push('- [ ] Set up monitoring for failed authentication attempts');
    checklist.push('- [ ] Review and update all default passwords');
    checklist.push('- [ ] Document all RLS policies and their business logic');
    
    return checklist.join('\n');
  }

  private generatePerformanceExecutiveSummary(performance: any): string {
    const cacheStatus = performance.database_statistics.cache_hit_ratio >= 90 ? '✅ GOOD' : '❌ POOR';
    const indexStatus = performance.database_statistics.index_hit_ratio >= 90 ? '✅ GOOD' : '⚠️ NEEDS IMPROVEMENT';
    
    return `
**Performance Status**: ${cacheStatus === '✅ GOOD' && indexStatus === '✅ GOOD' ? '✅ HEALTHY' : '⚠️ NEEDS OPTIMIZATION'}

- **Cache Hit Ratio**: ${performance.database_statistics.cache_hit_ratio}% ${cacheStatus}
- **Index Hit Ratio**: ${performance.database_statistics.index_hit_ratio}% ${indexStatus}
- **Unused Indexes**: ${performance.indexes.filter((i: any) => i.is_unused).length}
- **Tables Needing Vacuum**: ${performance.table_statistics.filter((t: any) => t.vacuum_needed).length}
`;
  }

  private formatUnusedIndexes(indexes: any[]): string {
    const unused = indexes.filter(idx => idx.is_unused && !idx.is_primary);
    
    if (unused.length === 0) return '*No unused indexes found.*';
    
    const sections: string[] = [];
    sections.push(`Found ${unused.length} unused indexes consuming storage:\n`);
    sections.push('| Index | Table | Size | Drop Statement |');
    sections.push('|-------|-------|------|----------------|');
    
    unused.slice(0, 10).forEach(idx => {
      sections.push(`| ${idx.index_name} | ${idx.table_name} | ${idx.index_size} | \`DROP INDEX ${idx.schema_name}.${idx.index_name};\` |`);
    });
    
    return sections.join('\n');
  }

  private formatMissingIndexOpportunities(performance: any): string {
    const highSeqScan = performance.table_statistics.filter((t: any) => 
      t.row_count > 1000 && t.seq_scan_count > t.idx_scan_count * 10
    );
    
    if (highSeqScan.length === 0) return '*No obvious missing index opportunities detected.*';
    
    const sections: string[] = [];
    sections.push('Tables with high sequential scan rates:\n');
    sections.push('| Table | Rows | Seq Scans | Index Scans | Recommendation |');
    sections.push('|-------|------|-----------|-------------|----------------|');
    
    highSeqScan.slice(0, 10).forEach((table: any) => {
      sections.push(`| ${table.table_name} | ${table.row_count.toLocaleString()} | ${table.seq_scan_count.toLocaleString()} | ${table.idx_scan_count.toLocaleString()} | Analyze query patterns |`);
    });
    
    return sections.join('\n');
  }

  private formatTablesMaintenance(tables: any[]): string {
    const needingVacuum = tables.filter(t => t.vacuum_needed);
    
    if (needingVacuum.length === 0) return '*All tables are well-maintained.*';
    
    const sections: string[] = [];
    sections.push(`${needingVacuum.length} tables need vacuum:\n`);
    sections.push('| Table | Dead Tuples | Live Tuples | Bloat % | Command |');
    sections.push('|-------|-------------|-------------|---------|---------|');
    
    needingVacuum
      .sort((a, b) => b.dead_tuples - a.dead_tuples)
      .slice(0, 10)
      .forEach(table => {
        const bloatPercent = Math.round(table.dead_tuples / Math.max(table.live_tuples, 1) * 100);
        sections.push(`| ${table.table_name} | ${table.dead_tuples.toLocaleString()} | ${table.live_tuples.toLocaleString()} | ${bloatPercent}% | \`VACUUM ANALYZE ${table.schema_name}.${table.table_name};\` |`);
      });
    
    return sections.join('\n');
  }

  private formatHighActivityTables(tables: any[]): string {
    const highActivity = tables
      .filter(t => t.n_tup_ins + t.n_tup_upd + t.n_tup_del > 10000)
      .sort((a, b) => (b.n_tup_ins + b.n_tup_upd + b.n_tup_del) - (a.n_tup_ins + a.n_tup_upd + a.n_tup_del));
    
    if (highActivity.length === 0) return '*No high-activity tables detected.*';
    
    const sections: string[] = [];
    sections.push('| Table | Inserts | Updates | Deletes | Total Activity |');
    sections.push('|-------|---------|---------|---------|----------------|');
    
    highActivity.slice(0, 10).forEach(table => {
      const total = table.n_tup_ins + table.n_tup_upd + table.n_tup_del;
      sections.push(`| ${table.table_name} | ${table.n_tup_ins.toLocaleString()} | ${table.n_tup_upd.toLocaleString()} | ${table.n_tup_del.toLocaleString()} | ${total.toLocaleString()} |`);
    });
    
    return sections.join('\n');
  }

  private generatePerformanceOptimizationPlan(performance: any): string {
    const plan: string[] = [];
    
    plan.push('### 1. Immediate Actions');
    plan.push('```sql');
    plan.push('-- Drop unused indexes');
    const unused = performance.indexes.filter((i: any) => i.is_unused && !i.is_primary).slice(0, 5);
    unused.forEach((idx: any) => {
      plan.push(`DROP INDEX IF EXISTS ${idx.schema_name}.${idx.index_name};`);
    });
    plan.push('\n-- Vacuum bloated tables');
    const bloated = performance.table_statistics.filter((t: any) => t.vacuum_needed).slice(0, 5);
    bloated.forEach((table: any) => {
      plan.push(`VACUUM ANALYZE ${table.schema_name}.${table.table_name};`);
    });
    plan.push('```');
    
    plan.push('\n### 2. Index Creation Opportunities');
    plan.push('Analyze slow queries and consider indexes for:');
    const needIndexes = performance.table_statistics
      .filter((t: any) => t.row_count > 1000 && t.seq_scan_count > t.idx_scan_count)
      .slice(0, 5);
    needIndexes.forEach((table: any) => {
      plan.push(`- ${table.table_name} (${table.seq_scan_count} sequential scans)`);
    });
    
    plan.push('\n### 3. Configuration Tuning');
    if (performance.database_statistics.cache_hit_ratio < 90) {
      plan.push('- Increase `shared_buffers` to improve cache hit ratio');
    }
    plan.push('- Review `autovacuum` settings for high-activity tables');
    plan.push('- Consider `work_mem` increase for complex queries');
    
    return plan.join('\n');
  }

  private generateImmediateActions(analysis: EnhancedDatabaseAnalysis): string {
    const actions: string[] = [];
    
    // Security critical
    if (analysis.security) {
      const criticalSec = analysis.security.vulnerabilities.filter(v => v.severity === 'critical');
      criticalSec.forEach(vuln => {
        actions.push(`- [ ] ${vuln.recommendation}`);
      });
    }
    
    // Performance critical
    if (analysis.performance) {
      const criticalPerf = analysis.performance.performance_issues.filter(i => i.severity === 'critical');
      criticalPerf.forEach(issue => {
        actions.push(`- [ ] ${issue.recommendation}`);
      });
    }
    
    if (actions.length === 0) {
      actions.push('*No critical actions required.*');
    }
    
    return actions.join('\n');
  }

  private generateShortTermActions(analysis: EnhancedDatabaseAnalysis): string {
    const actions: string[] = [];
    
    // Unused indexes
    if (analysis.performance) {
      const unusedCount = analysis.performance.indexes.filter((i: any) => i.is_unused && !i.is_primary).length;
      if (unusedCount > 0) {
        actions.push(`- [ ] Drop ${unusedCount} unused indexes to free storage`);
      }
    }
    
    // Tables needing vacuum
    if (analysis.performance) {
      const vacuumCount = analysis.performance.table_statistics.filter((t: any) => t.vacuum_needed).length;
      if (vacuumCount > 0) {
        actions.push(`- [ ] Vacuum ${vacuumCount} bloated tables`);
      }
    }
    
    // RLS policies
    if (analysis.security && analysis.security.security_summary.tables_without_rls > 0) {
      actions.push(`- [ ] Enable RLS on ${analysis.security.security_summary.tables_without_rls} tables`);
    }
    
    // Edge functions deployment
    if (analysis.edge_functions) {
      const undeployed = analysis.edge_functions.functions.filter((f: any) => !f.deployed).length;
      if (undeployed > 0) {
        actions.push(`- [ ] Deploy ${undeployed} Edge Functions`);
      }
    }
    
    return actions.join('\n');
  }

  private generateLongTermActions(analysis: EnhancedDatabaseAnalysis): string {
    const actions: string[] = [];
    
    // Architecture improvements
    actions.push('- [ ] Implement repository pattern for tables with direct access');
    actions.push('- [ ] Create TypeScript types for all database tables');
    actions.push('- [ ] Set up automated performance monitoring');
    actions.push('- [ ] Implement comprehensive audit logging');
    
    // Database optimization
    if (analysis.objects && analysis.objects.statistics.materialized_views === 0) {
      actions.push('- [ ] Consider materialized views for complex queries');
    }
    
    // Realtime optimization
    if (analysis.realtime && analysis.realtime.statistics.high_traffic_tables > 0) {
      actions.push('- [ ] Implement realtime message filtering and throttling');
    }
    
    return actions.join('\n');
  }

  private generateMonitoringRecommendations(analysis: EnhancedDatabaseAnalysis): string {
    const monitoring: string[] = [];
    
    monitoring.push('### Key Metrics to Monitor');
    monitoring.push('- Database size growth rate');
    monitoring.push('- Cache hit ratio (maintain >90%)');
    monitoring.push('- Index usage patterns');
    monitoring.push('- Table bloat percentages');
    monitoring.push('- RLS policy violations');
    monitoring.push('- Failed authentication attempts');
    
    monitoring.push('\n### Alerting Thresholds');
    monitoring.push('- Cache hit ratio < 85%');
    monitoring.push('- Any table bloat > 30%');
    monitoring.push('- Database size growth > 10% per week');
    monitoring.push('- Failed auth attempts > 100/hour');
    
    monitoring.push('\n### Recommended Tools');
    monitoring.push('- pganalyze or similar for PostgreSQL monitoring');
    monitoring.push('- Supabase Dashboard for basic metrics');
    monitoring.push('- Custom monitoring with pg_stat_statements');
    
    return monitoring.join('\n');
  }

  private generateSuccessMetrics(analysis: EnhancedDatabaseAnalysis): string {
    const metrics: string[] = [];
    
    const currentMetrics = this.calculateCurrentMetrics(analysis);
    
    metrics.push('### Current State');
    metrics.push(`- Cache Hit Ratio: ${currentMetrics.cacheHitRatio}%`);
    metrics.push(`- Index Hit Ratio: ${currentMetrics.indexHitRatio}%`);
    metrics.push(`- Tables with RLS: ${currentMetrics.rlsPercentage}%`);
    metrics.push(`- Security Issues: ${currentMetrics.securityIssues}`);
    metrics.push(`- Performance Issues: ${currentMetrics.performanceIssues}`);
    
    metrics.push('\n### Target State (30 days)');
    metrics.push('- Cache Hit Ratio: >95%');
    metrics.push('- Index Hit Ratio: >95%');
    metrics.push('- Tables with RLS: 100%');
    metrics.push('- Critical Security Issues: 0');
    metrics.push('- High Performance Issues: 0');
    
    return metrics.join('\n');
  }

  private calculateCurrentMetrics(analysis: EnhancedDatabaseAnalysis): any {
    return {
      cacheHitRatio: analysis.performance?.database_statistics.cache_hit_ratio || 0,
      indexHitRatio: analysis.performance?.database_statistics.index_hit_ratio || 0,
      rlsPercentage: analysis.security ? 
        Math.round(analysis.security.security_summary.tables_with_rls / analysis.basic.tables.length * 100) : 0,
      securityIssues: analysis.security?.vulnerabilities.length || 0,
      performanceIssues: analysis.performance?.performance_issues.length || 0
    };
  }
}
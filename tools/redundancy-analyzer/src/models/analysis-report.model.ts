import type { RedundancyFinding } from './redundancy.model';

export interface AnalysisSummary {
  totalRedundancy: number; // Total LoC that could be removed
  criticalFindings: number;
  tablesWithoutCrud: number;
  unusedCodePercentage: number;
  topRedundantDomains: string[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
  effort: 'small' | 'medium' | 'large';
  relatedFindings: string[]; // Finding IDs
}

export interface AnalysisReport {
  id: string; // UUID
  projectName: string;
  analysisDate: Date;
  totalFiles: number;
  totalTables: number;
  findings: RedundancyFinding[];
  summary: AnalysisSummary;
  recommendations: Recommendation[];
}

export class AnalysisReportModel implements AnalysisReport {
  id: string;
  projectName: string;
  analysisDate: Date;
  totalFiles: number;
  totalTables: number;
  findings: RedundancyFinding[];
  summary: AnalysisSummary;
  recommendations: Recommendation[];

  constructor(data: Partial<AnalysisReport>) {
    this.id = data.id || this.generateId();
    this.projectName = data.projectName || 'Unknown Project';
    this.analysisDate = data.analysisDate || new Date();
    this.totalFiles = data.totalFiles || 0;
    this.totalTables = data.totalTables || 0;
    this.findings = data.findings || [];
    this.summary = data.summary || this.createEmptySummary();
    this.recommendations = data.recommendations || [];

    this.validate();
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private createEmptySummary(): AnalysisSummary {
    return {
      totalRedundancy: 0,
      criticalFindings: 0,
      tablesWithoutCrud: 0,
      unusedCodePercentage: 0,
      topRedundantDomains: [],
    };
  }

  private validate(): void {
    // At least one finding or empty report flag
    if (this.findings.length === 0 && this.summary.totalRedundancy > 0) {
      throw new Error('Summary shows redundancy but no findings provided');
    }

    // Summary statistics must match findings
    const calculatedSummary = this.calculateSummary();
    if (this.summary.criticalFindings !== calculatedSummary.criticalFindings) {
      console.warn('Summary critical findings count does not match actual findings');
    }

    // Recommendations sorted by priority
    this.sortRecommendations();
  }

  private calculateSummary(): AnalysisSummary {
    const criticalFindings = this.findings.filter(f => f.severity === 'high').length;
    const totalRedundancy = this.findings.reduce((sum, f) => sum + f.estimatedSavings, 0);
    const tablesWithoutCrud = this.findings.filter(f => f.type === 'ABANDONED_TABLE').length;
    
    // Calculate unused code percentage
    const totalLoC = this.totalFiles * 100; // Rough estimate
    const unusedLoC = this.findings
      .filter(f => f.type === 'UNUSED_CODE')
      .reduce((sum, f) => sum + f.estimatedSavings, 0);
    const unusedCodePercentage = totalLoC > 0 ? (unusedLoC / totalLoC) * 100 : 0;

    // Find top redundant domains
    const domainCounts = new Map<string, number>();
    this.findings.forEach(f => {
      const domain = this.extractDomain(f.primaryLocation.filePath);
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    });
    
    const topRedundantDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain]) => domain);

    return {
      totalRedundancy,
      criticalFindings,
      tablesWithoutCrud,
      unusedCodePercentage,
      topRedundantDomains,
    };
  }

  private extractDomain(filePath: string): string {
    const match = filePath.match(/domains?\/([^/]+)/);
    if (match) return match[1];
    
    const pathParts = filePath.split('/');
    return pathParts[1] || 'root';
  }

  private sortRecommendations(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    this.recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  addFinding(finding: RedundancyFinding): void {
    this.findings.push(finding);
    this.summary = this.calculateSummary();
  }

  addRecommendation(recommendation: Recommendation): void {
    this.recommendations.push(recommendation);
    this.sortRecommendations();
  }

  generateRecommendations(): void {
    // Group findings by type
    const findingsByType = new Map<string, RedundancyFinding[]>();
    this.findings.forEach(f => {
      const list = findingsByType.get(f.type) || [];
      list.push(f);
      findingsByType.set(f.type, list);
    });

    // Generate recommendations based on findings
    findingsByType.forEach((findings, type) => {
      if (findings.length > 0) {
        this.addRecommendation(this.createRecommendationForType(type, findings));
      }
    });
  }

  private createRecommendationForType(type: string, findings: RedundancyFinding[]): Recommendation {
    const totalSavings = findings.reduce((sum, f) => sum + f.estimatedSavings, 0);
    const highSeverityCount = findings.filter(f => f.severity === 'high').length;
    
    switch (type) {
      case 'EXACT_DUPLICATE':
      case 'SIMILAR_LOGIC':
        return {
          priority: highSeverityCount > 2 ? 'high' : 'medium',
          action: `Consolidate ${findings.length} duplicate implementations`,
          impact: `Remove ~${totalSavings} lines of redundant code`,
          effort: totalSavings > 1000 ? 'large' : 'medium',
          relatedFindings: findings.map(f => f.id),
        };
      
      case 'ABANDONED_TABLE':
        return {
          priority: 'high',
          action: `Clean up ${findings.length} abandoned database tables`,
          impact: 'Reduce database complexity and maintenance overhead',
          effort: 'medium',
          relatedFindings: findings.map(f => f.id),
        };
      
      case 'UNUSED_CODE':
        return {
          priority: 'low',
          action: `Remove ${findings.length} unused code segments`,
          impact: `Reduce codebase by ~${totalSavings} lines`,
          effort: 'small',
          relatedFindings: findings.map(f => f.id),
        };
      
      default:
        return {
          priority: 'medium',
          action: `Address ${findings.length} ${type.toLowerCase()} issues`,
          impact: `Improve code quality and maintainability`,
          effort: 'medium',
          relatedFindings: findings.map(f => f.id),
        };
    }
  }

  toJSON(): AnalysisReport {
    return {
      id: this.id,
      projectName: this.projectName,
      analysisDate: this.analysisDate,
      totalFiles: this.totalFiles,
      totalTables: this.totalTables,
      findings: this.findings,
      summary: this.summary,
      recommendations: this.recommendations,
    };
  }
}
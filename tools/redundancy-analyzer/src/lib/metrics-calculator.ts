import type { CodeModule } from '../models/code-module.model';
import type { RedundancyFinding } from '../models/redundancy.model';
import type { ImpactMetrics } from '../models/redundancy.model';
import type { DatabaseTableMapping } from '../models/database-table-mapping.model';

export interface CodeQualityMetrics {
  modernSyntax: boolean;
  hasTests: boolean;
  hasDocumentation: boolean;
  followsNamingConvention: boolean;
  complexity: number;
  maintainabilityIndex: number;
}

export class MetricsCalculator {
  calculateImpactMetrics(
    module: CodeModule,
    duplicates: CodeModule[] = [],
    context?: { projectAge?: number; teamSize?: number }
  ): ImpactMetrics {
    const scale = this.calculateScale(module, duplicates);
    const risk = this.calculateRisk(module, duplicates);
    const quality = this.calculateQuality(module, context);

    return { scale, risk, quality };
  }

  private calculateScale(module: CodeModule, duplicates: CodeModule[]): number {
    // Total lines affected including all duplicates
    let totalLines = module.metrics.linesOfCode;
    
    duplicates.forEach((dup) => {
      totalLines += dup.metrics.linesOfCode;
    });

    return totalLines;
  }

  private calculateRisk(module: CodeModule, duplicates: CodeModule[]): number {
    // Risk based on dependencies
    const uniqueDependencies = new Set(module.dependencies);
    
    duplicates.forEach((dup) => {
      dup.dependencies.forEach((dep) => uniqueDependencies.add(dep));
    });

    // Also consider cyclomatic complexity
    const avgComplexity = this.averageComplexity([module, ...duplicates]);
    const complexityRisk = Math.min(avgComplexity / 10, 1); // Normalize to 0-1

    return uniqueDependencies.size + Math.floor(complexityRisk * 5);
  }

  private calculateQuality(module: CodeModule, context?: any): number {
    const metrics = this.analyzeCodeQuality(module);
    let score = 100;

    // Deduct points for poor quality indicators
    if (!metrics.modernSyntax) score -= 20;
    if (!metrics.hasTests) score -= 15;
    if (!metrics.hasDocumentation) score -= 10;
    if (!metrics.followsNamingConvention) score -= 10;
    if (metrics.complexity > 10) score -= Math.min(metrics.complexity - 10, 20);
    
    // Boost score for high maintainability
    if (metrics.maintainabilityIndex > 70) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private analyzeCodeQuality(module: CodeModule): CodeQualityMetrics {
    // Analyze module content for quality indicators
    const astText = JSON.stringify(module.ast);
    
    return {
      modernSyntax: this.hasModernSyntax(astText),
      hasTests: this.hasTestCoverage(module),
      hasDocumentation: this.hasDocumentation(astText),
      followsNamingConvention: this.checkNamingConvention(module.moduleName),
      complexity: module.metrics.cyclomaticComplexity,
      maintainabilityIndex: this.calculateMaintainabilityIndex(module),
    };
  }

  private hasModernSyntax(astText: string): boolean {
    // Check for modern JS/TS features
    const modernIndicators = [
      'ArrowFunction',
      'const',
      'let',
      'async',
      'await',
      'destructuring',
      'spread',
    ];

    return modernIndicators.some((indicator) => astText.includes(indicator));
  }

  private hasTestCoverage(module: CodeModule): boolean {
    // Simple heuristic: check if there's a test file for this module
    const testPath = module.filePath
      .replace(/\.(ts|js)$/, '.test.$1')
      .replace(/\.(tsx|jsx)$/, '.test.$1');
    
    // In a real implementation, we'd check if the test file exists
    // For now, assume no tests if the module is already a test
    return !module.isTestFile();
  }

  private hasDocumentation(astText: string): boolean {
    // Check for JSDoc or other documentation
    return astText.includes('/**') || astText.includes('///');
  }

  private checkNamingConvention(name: string): boolean {
    // Check common naming conventions
    const camelCase = /^[a-z][a-zA-Z0-9]*$/;
    const pascalCase = /^[A-Z][a-zA-Z0-9]*$/;
    const snakeCase = /^[a-z]+(_[a-z]+)*$/;
    
    return camelCase.test(name) || pascalCase.test(name) || snakeCase.test(name);
  }

  private calculateMaintainabilityIndex(module: CodeModule): number {
    // Simplified maintainability index calculation
    const loc = module.metrics.linesOfCode;
    const complexity = module.metrics.cyclomaticComplexity;
    const halsteadVolume = loc * Math.log2(loc); // Simplified
    
    // MI = 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC)
    const mi = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * complexity - 16.2 * Math.log(loc);
    
    return Math.max(0, Math.min(100, mi));
  }

  private averageComplexity(modules: CodeModule[]): number {
    if (modules.length === 0) return 0;
    
    const totalComplexity = modules.reduce(
      (sum, mod) => sum + mod.metrics.cyclomaticComplexity,
      0
    );
    
    return totalComplexity / modules.length;
  }

  calculateTableImpact(mapping: DatabaseTableMapping): ImpactMetrics {
    // Scale: based on table usage
    const scale = mapping.usageCount;
    
    // Risk: higher if table has relationships or partial CRUD
    let risk = 0;
    if (mapping.hasAnyCrudOperation() && !mapping.hasFullCrud()) {
      risk += 5; // Partial implementation is risky
    }
    if (mapping.usageCount > 0 && !mapping.hasRepository) {
      risk += 3; // Used but no proper abstraction
    }
    
    // Quality: based on proper implementation
    let quality = 100;
    if (!mapping.hasRepository) quality -= 30;
    if (!mapping.hasFullCrud() && mapping.hasAnyCrudOperation()) quality -= 20;
    if (mapping.isAbandoned) quality -= 50;
    
    return { scale, risk, quality: Math.max(0, quality) };
  }

  aggregateMetrics(findings: RedundancyFinding[]): {
    totalScale: number;
    averageRisk: number;
    averageQuality: number;
  } {
    if (findings.length === 0) {
      return { totalScale: 0, averageRisk: 0, averageQuality: 100 };
    }

    const totalScale = findings.reduce((sum, f) => sum + f.impactScore.scale, 0);
    const totalRisk = findings.reduce((sum, f) => sum + f.impactScore.risk, 0);
    const totalQuality = findings.reduce((sum, f) => sum + f.impactScore.quality, 0);

    return {
      totalScale,
      averageRisk: totalRisk / findings.length,
      averageQuality: totalQuality / findings.length,
    };
  }

  calculateEffortEstimate(finding: RedundancyFinding): 'small' | 'medium' | 'large' {
    const { scale, risk, quality } = finding.impactScore;
    
    // Calculate effort score
    const effortScore = (scale / 100) + (risk * 2) + ((100 - quality) / 50);
    
    if (effortScore < 5) return 'small';
    if (effortScore < 15) return 'medium';
    return 'large';
  }

  prioritizeFindings(findings: RedundancyFinding[]): RedundancyFinding[] {
    return findings.sort((a, b) => {
      // First sort by severity
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Then by impact (scale * risk / quality)
      const impactA = (a.impactScore.scale * a.impactScore.risk) / Math.max(a.impactScore.quality, 1);
      const impactB = (b.impactScore.scale * b.impactScore.risk) / Math.max(b.impactScore.quality, 1);
      
      return impactB - impactA;
    });
  }
}
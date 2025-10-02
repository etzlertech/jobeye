import type { CodeModule } from '../models/code-module.model';
import type { RedundancyFinding, CodeLocation } from '../models/redundancy.model';
import { RedundancyFindingModel, RedundancyType } from '../models/redundancy.model';

export interface SimilarityOptions {
  threshold?: number; // 0-100, default 70
  ignoreWhitespace?: boolean;
  ignoreComments?: boolean;
  ignoreVariableNames?: boolean;
}

export interface SimilarityResult {
  score: number; // 0-100
  type: 'exact' | 'similar' | 'different';
  differences: string[];
}

export class SimilarityDetectorService {
  private defaultThreshold = 70;

  async detectSimilarities(
    modules: CodeModule[],
    options: SimilarityOptions = {}
  ): Promise<RedundancyFinding[]> {
    const findings: RedundancyFinding[] = [];
    const threshold = options.threshold || this.defaultThreshold;

    // Compare each module with every other module
    for (let i = 0; i < modules.length; i++) {
      for (let j = i + 1; j < modules.length; j++) {
        const similarity = this.calculateSimilarity(modules[i], modules[j], options);

        if (similarity.score >= threshold) {
          const finding = this.createFinding(modules[i], modules[j], similarity);
          findings.push(finding);
        }
      }
    }

    // Group findings by similarity to avoid duplicate reports
    return this.consolidateFindings(findings);
  }

  private calculateSimilarity(
    module1: CodeModule,
    module2: CodeModule,
    options: SimilarityOptions
  ): SimilarityResult {
    // Quick checks first
    if (module1.filePath === module2.filePath && 
        module1.startLine === module2.startLine) {
      return { score: 100, type: 'exact', differences: [] };
    }

    // Different types are less likely to be duplicates
    if (module1.type !== module2.type) {
      return { score: 0, type: 'different', differences: ['Different module types'] };
    }

    // Calculate various similarity metrics
    const structuralSimilarity = this.calculateStructuralSimilarity(module1, module2);
    const nameSimilarity = this.calculateNameSimilarity(module1, module2, options);
    const sizeSimilarity = this.calculateSizeSimilarity(module1, module2);
    const astSimilarity = this.calculateAstSimilarity(module1, module2);

    // Weighted average
    const score = (
      structuralSimilarity * 0.4 +
      nameSimilarity * 0.2 +
      sizeSimilarity * 0.1 +
      astSimilarity * 0.3
    );

    const type = score === 100 ? 'exact' : score >= 70 ? 'similar' : 'different';
    const differences = this.identifyDifferences(module1, module2);

    return { score, type, differences };
  }

  private calculateStructuralSimilarity(module1: CodeModule, module2: CodeModule): number {
    // Compare AST structure
    const ast1 = JSON.stringify(module1.ast);
    const ast2 = JSON.stringify(module2.ast);

    if (ast1 === ast2) return 100;

    // Calculate edit distance
    const distance = this.levenshteinDistance(ast1, ast2);
    const maxLength = Math.max(ast1.length, ast2.length);
    
    return Math.max(0, 100 - (distance / maxLength) * 100);
  }

  private calculateNameSimilarity(
    module1: CodeModule,
    module2: CodeModule,
    options: SimilarityOptions
  ): number {
    if (options.ignoreVariableNames) {
      // Just check if they're both the same type
      return module1.type === module2.type ? 100 : 0;
    }

    const name1 = module1.moduleName.toLowerCase();
    const name2 = module2.moduleName.toLowerCase();

    if (name1 === name2) return 100;

    // Check for common patterns (e.g., getUser vs getUserById)
    if (name1.includes(name2) || name2.includes(name1)) return 80;

    // Check for similar prefixes/suffixes
    const commonPrefix = this.getCommonPrefix(name1, name2);
    const commonSuffix = this.getCommonSuffix(name1, name2);
    
    const prefixRatio = commonPrefix.length / Math.max(name1.length, name2.length);
    const suffixRatio = commonSuffix.length / Math.max(name1.length, name2.length);
    
    return Math.max(prefixRatio, suffixRatio) * 100;
  }

  private calculateSizeSimilarity(module1: CodeModule, module2: CodeModule): number {
    const size1 = module1.metrics.linesOfCode;
    const size2 = module2.metrics.linesOfCode;

    if (size1 === size2) return 100;

    const ratio = Math.min(size1, size2) / Math.max(size1, size2);
    return ratio * 100;
  }

  private calculateAstSimilarity(module1: CodeModule, module2: CodeModule): number {
    // Compare complexity
    const complexity1 = module1.metrics.cyclomaticComplexity;
    const complexity2 = module2.metrics.cyclomaticComplexity;

    if (complexity1 === complexity2) return 100;

    const complexityRatio = Math.min(complexity1, complexity2) / Math.max(complexity1, complexity2);
    
    // Compare dependency count
    const deps1 = module1.dependencies.length;
    const deps2 = module2.dependencies.length;
    
    const depsRatio = deps1 === deps2 ? 1 : Math.min(deps1, deps2) / Math.max(deps1, deps2);

    return ((complexityRatio + depsRatio) / 2) * 100;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getCommonPrefix(str1: string, str2: string): string {
    let prefix = '';
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
      if (str1[i] === str2[i]) {
        prefix += str1[i];
      } else {
        break;
      }
    }
    return prefix;
  }

  private getCommonSuffix(str1: string, str2: string): string {
    let suffix = '';
    for (let i = 1; i <= Math.min(str1.length, str2.length); i++) {
      if (str1[str1.length - i] === str2[str2.length - i]) {
        suffix = str1[str1.length - i] + suffix;
      } else {
        break;
      }
    }
    return suffix;
  }

  private identifyDifferences(module1: CodeModule, module2: CodeModule): string[] {
    const differences: string[] = [];

    if (module1.moduleName !== module2.moduleName) {
      differences.push(`Different names: ${module1.moduleName} vs ${module2.moduleName}`);
    }

    const sizeDiff = Math.abs(module1.metrics.linesOfCode - module2.metrics.linesOfCode);
    if (sizeDiff > 0) {
      differences.push(`Size difference: ${sizeDiff} lines`);
    }

    const complexityDiff = Math.abs(
      module1.metrics.cyclomaticComplexity - module2.metrics.cyclomaticComplexity
    );
    if (complexityDiff > 0) {
      differences.push(`Complexity difference: ${complexityDiff}`);
    }

    return differences;
  }

  private createFinding(
    module1: CodeModule,
    module2: CodeModule,
    similarity: SimilarityResult
  ): RedundancyFinding {
    const type = similarity.type === 'exact' 
      ? RedundancyType.EXACT_DUPLICATE 
      : RedundancyType.SIMILAR_LOGIC;

    const primaryLocation: CodeLocation = {
      filePath: module1.filePath,
      startLine: module1.startLine,
      endLine: module1.endLine,
      snippet: `${module1.type} ${module1.moduleName}`,
    };

    const duplicateLocation: CodeLocation = {
      filePath: module2.filePath,
      startLine: module2.startLine,
      endLine: module2.endLine,
      snippet: `${module2.type} ${module2.moduleName}`,
    };

    const totalLines = module1.metrics.linesOfCode + module2.metrics.linesOfCode;
    const estimatedSavings = Math.min(module1.metrics.linesOfCode, module2.metrics.linesOfCode);

    const finding = new RedundancyFindingModel({
      type,
      severity: similarity.score > 90 ? 'high' : similarity.score > 80 ? 'medium' : 'low',
      primaryLocation,
      duplicateLocations: [duplicateLocation],
      impactScore: {
        scale: totalLines,
        risk: module1.dependencies.length + module2.dependencies.length,
        quality: 100 - similarity.score, // Lower score means lower quality (more duplication)
      },
      recommendation: this.generateRecommendation(module1, module2, similarity),
      estimatedSavings,
    });

    return finding;
  }

  private generateRecommendation(
    module1: CodeModule,
    module2: CodeModule,
    similarity: SimilarityResult
  ): string {
    if (similarity.type === 'exact') {
      return `Remove exact duplicate: Keep ${module1.filePath} and remove ${module2.filePath}`;
    }

    const olderModule = module1.metrics.lastModified < module2.metrics.lastModified 
      ? module1 
      : module2;
    const newerModule = olderModule === module1 ? module2 : module1;

    return `Consolidate similar implementations: Consider merging ${module1.moduleName} and ${module2.moduleName}. ` +
           `The newer implementation in ${newerModule.filePath} appears to have better structure.`;
  }

  private consolidateFindings(findings: RedundancyFinding[]): RedundancyFinding[] {
    const consolidated: RedundancyFinding[] = [];
    const processed = new Set<string>();

    findings.forEach((finding) => {
      const key = `${finding.primaryLocation.filePath}:${finding.primaryLocation.startLine}`;
      
      if (!processed.has(key)) {
        // Find all related findings
        const related = findings.filter((f) => 
          (f.primaryLocation.filePath === finding.primaryLocation.filePath &&
           f.primaryLocation.startLine === finding.primaryLocation.startLine) ||
          f.duplicateLocations.some((d) => 
            d.filePath === finding.primaryLocation.filePath &&
            d.startLine === finding.primaryLocation.startLine
          )
        );

        // Merge duplicate locations
        const allDuplicates = new Map<string, CodeLocation>();
        related.forEach((f) => {
          f.duplicateLocations.forEach((d) => {
            const dKey = `${d.filePath}:${d.startLine}`;
            allDuplicates.set(dKey, d);
          });
        });

        // Create consolidated finding
        const consolidatedFinding = new RedundancyFindingModel({
          ...finding,
          duplicateLocations: Array.from(allDuplicates.values()),
          estimatedSavings: finding.estimatedSavings * allDuplicates.size,
        });

        consolidated.push(consolidatedFinding);

        // Mark all as processed
        processed.add(key);
        allDuplicates.forEach((_, dKey) => processed.add(dKey));
      }
    });

    return consolidated;
  }
}
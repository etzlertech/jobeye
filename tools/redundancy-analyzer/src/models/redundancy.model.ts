export enum RedundancyType {
  EXACT_DUPLICATE = 'exact_duplicate',
  SIMILAR_LOGIC = 'similar_logic',
  OVERLAPPING_FEATURE = 'overlapping_feature',
  UNUSED_CODE = 'unused_code',
  ABANDONED_TABLE = 'abandoned_table',
  DUPLICATE_API = 'duplicate_api',
}

export type SeverityLevel = 'high' | 'medium' | 'low';

export interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string; // First 3 lines for context
}

export interface ImpactMetrics {
  scale: number;    // Lines of code affected
  risk: number;     // Number of dependencies
  quality: number;  // 0-100 score based on best practices
}

export interface RedundancyFinding {
  id: string; // UUID
  type: RedundancyType;
  severity: SeverityLevel;
  primaryLocation: CodeLocation;
  duplicateLocations: CodeLocation[];
  impactScore: ImpactMetrics;
  recommendation: string;
  estimatedSavings: number; // lines of code
  createdAt: Date;
}

export class RedundancyFindingModel implements RedundancyFinding {
  id: string;
  type: RedundancyType;
  severity: SeverityLevel;
  primaryLocation: CodeLocation;
  duplicateLocations: CodeLocation[];
  impactScore: ImpactMetrics;
  recommendation: string;
  estimatedSavings: number;
  createdAt: Date;

  constructor(data: Partial<RedundancyFinding>) {
    this.id = data.id || this.generateId();
    this.type = data.type || RedundancyType.SIMILAR_LOGIC;
    this.severity = data.severity || 'medium';
    this.primaryLocation = data.primaryLocation || this.createEmptyLocation();
    this.duplicateLocations = data.duplicateLocations || [];
    this.impactScore = data.impactScore || { scale: 0, risk: 0, quality: 0 };
    this.recommendation = data.recommendation || '';
    this.estimatedSavings = data.estimatedSavings || 0;
    this.createdAt = data.createdAt || new Date();

    this.validate();
  }

  private generateId(): string {
    // Simple UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private createEmptyLocation(): CodeLocation {
    return {
      filePath: '',
      startLine: 0,
      endLine: 0,
      snippet: '',
    };
  }

  private validate(): void {
    // At least 2 locations required (primary + 1 duplicate)
    if (this.duplicateLocations.length < 1 && this.type !== RedundancyType.UNUSED_CODE) {
      throw new Error('At least one duplicate location is required for non-unused code findings');
    }

    // Impact score must have all three metrics
    if (
      this.impactScore.scale === undefined ||
      this.impactScore.risk === undefined ||
      this.impactScore.quality === undefined
    ) {
      throw new Error('Impact score must include scale, risk, and quality metrics');
    }

    // Recommendation required for high severity findings
    if (this.severity === 'high' && !this.recommendation) {
      throw new Error('Recommendation is required for high severity findings');
    }

    // Start line must be less than end line
    this.validateLocation(this.primaryLocation);
    this.duplicateLocations.forEach((loc) => this.validateLocation(loc));
  }

  private validateLocation(location: CodeLocation): void {
    if (location.startLine >= location.endLine && location.endLine !== 0) {
      throw new Error(`Invalid location: start line ${location.startLine} must be less than end line ${location.endLine}`);
    }
  }

  calculateSeverity(): SeverityLevel {
    const { scale, risk, quality } = this.impactScore;
    
    // High severity: Large scale, high risk, or very poor quality
    if (scale > 500 || risk > 10 || quality < 30) {
      return 'high';
    }
    
    // Low severity: Small scale, low risk, and decent quality
    if (scale < 100 && risk < 3 && quality > 70) {
      return 'low';
    }
    
    // Medium severity: Everything else
    return 'medium';
  }

  toJSON(): RedundancyFinding {
    return {
      id: this.id,
      type: this.type,
      severity: this.severity,
      primaryLocation: this.primaryLocation,
      duplicateLocations: this.duplicateLocations,
      impactScore: this.impactScore,
      recommendation: this.recommendation,
      estimatedSavings: this.estimatedSavings,
      createdAt: this.createdAt,
    };
  }
}
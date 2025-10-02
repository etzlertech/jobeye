// API types based on the OpenAPI contract

export interface AnalysisRequest {
  projectPath: string;
  options?: AnalysisOptions;
}

export interface AnalysisOptions {
  excludePatterns?: string[];
  includeTests?: boolean;
  includeDocs?: boolean;
  similarityThreshold?: number;
  minModuleSize?: number;
}

export interface AnalysisResponse {
  analysisId: string;
  status: AnalysisStatus['status'];
  estimatedTime?: string;
}

export interface AnalysisStatus {
  analysisId: string;
  status: 'initializing' | 'scanning' | 'analyzing' | 'generating_report' | 'complete' | 'failed';
  progress: number;
  currentPhase?: string;
  filesScanned?: number;
  findingsCount?: number;
  error?: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
}
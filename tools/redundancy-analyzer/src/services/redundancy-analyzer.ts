import { EventEmitter } from 'events';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AstParserService } from './ast-parser.service';
import { SimilarityDetectorService } from './similarity-detector.service';
import { DatabaseMapperService } from './database-mapper.service';
import { ReportGeneratorService } from './report-generator.service';
import { FileScanner } from '../lib/file-scanner';
import { MetricsCalculator } from '../lib/metrics-calculator';
import { ErrorHandler, AnalysisError, ErrorCode } from '../lib/error-handler';
import type { AnalysisOptions, AnalysisRequest } from '../types/api';
import type { ProgressUpdate } from '../cli/progress';
import type { AnalysisReport } from '../models/analysis-report.model';
import type { RedundancyFinding } from '../models/redundancy.model';
import type { CodeModule } from '../models/code-module.model';

export interface AnalysisStatus {
  id: string;
  status: 'initializing' | 'scanning' | 'analyzing' | 'generating_report' | 'completed' | 'failed';
  progress: number;
  currentPhase?: string;
  filesScanned?: number;
  totalFiles?: number;
  findingsCount?: number;
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface AnalysisSummary {
  totalFiles: number;
  totalRedundancy: number;
  criticalFindings: number;
  tablesWithoutCrud: number;
}

export class RedundancyAnalyzer extends EventEmitter {
  private analyses = new Map<string, AnalysisStatus>();
  private reports = new Map<string, AnalysisReport>();
  
  private astParser: AstParserService;
  private similarityDetector: SimilarityDetectorService;
  private databaseMapper: DatabaseMapperService;
  private reportGenerator: ReportGeneratorService;
  private fileScanner: FileScanner;
  private metricsCalculator: MetricsCalculator;
  private errorHandler: ErrorHandler;

  constructor() {
    super();
    this.astParser = new AstParserService();
    this.similarityDetector = new SimilarityDetectorService();
    this.databaseMapper = new DatabaseMapperService();
    this.reportGenerator = new ReportGeneratorService();
    this.fileScanner = new FileScanner();
    this.metricsCalculator = new MetricsCalculator();
    this.errorHandler = ErrorHandler.getInstance();
  }

  async initialize(): Promise<void> {
    // Initialize database mapper with environment variables
    await this.databaseMapper.initialize({
      projectRoot: process.cwd(),
    });
  }

  async startAnalysis(request: AnalysisRequest): Promise<string> {
    const analysisId = uuidv4();
    
    const status: AnalysisStatus = {
      id: analysisId,
      status: 'initializing',
      progress: 0,
      startTime: Date.now(),
    };
    
    this.analyses.set(analysisId, status);
    
    // Initialize services if not already done
    await this.initialize();
    
    // Run analysis asynchronously
    this.runAnalysis(analysisId, request).catch(error => {
      this.handleAnalysisError(analysisId, error);
    });
    
    return analysisId;
  }

  private async runAnalysis(analysisId: string, request: AnalysisRequest): Promise<void> {
    const status = this.analyses.get(analysisId)!;
    
    try {
      // Phase 1: Initialize and scan files
      this.updateStatus(analysisId, 'scanning', 5);
      this.emit('phase', 'scanning');
      
      const files = await this.fileScanner.scanDirectory(request.projectPath, {
        excludePatterns: request.options.excludePatterns,
        includeTests: request.options.includeTests,
        includeDocs: request.options.includeDocs,
      });
      
      status.totalFiles = files.length;
      this.emit('progress', {
        phase: 'scanning',
        progress: 10,
        totalFiles: files.length,
        message: `Found ${files.length} files to analyze`,
      });

      // Phase 2: Parse code modules
      this.updateStatus(analysisId, 'analyzing', 15);
      this.emit('phase', 'analyzing');
      
      const modules: CodeModule[] = [];
      let processedFiles = 0;
      
      for (const file of files) {
        const fullPath = path.join(request.projectPath, file.path);
        
        try {
          const module = await this.astParser.parseFile(fullPath);
          if (module && module.metrics.linesOfCode >= request.options.minModuleSize) {
            modules.push(module);
          }
          
          processedFiles++;
          
          if (processedFiles % 10 === 0) {
            const progress = 15 + (processedFiles / files.length) * 30;
            this.emit('progress', {
              phase: 'analyzing',
              progress: Math.round(progress),
              filesScanned: processedFiles,
              totalFiles: files.length,
              currentFile: file.path,
            });
          }
        } catch (error) {
          console.warn(`Failed to parse ${file.path}:`, error);
        }
      }

      // Phase 3: Detect redundancy
      this.updateStatus(analysisId, 'analyzing', 50);
      this.emit('progress', {
        phase: 'analyzing',
        progress: 50,
        message: `Analyzing ${modules.length} modules for redundancy`,
      });

      const findings: RedundancyFinding[] = [];
      
      // Find code similarities
      const similarityFindings = await this.similarityDetector.findSimilarModules(
        modules,
        { threshold: request.options.similarityThreshold }
      );
      findings.push(...similarityFindings);

      // Analyze database tables
      this.emit('progress', {
        phase: 'analyzing',
        progress: 70,
        message: 'Analyzing database schema',
      });
      
      const databaseFindings = await this.databaseMapper.findAbandonedTables(request.projectPath);
      findings.push(...databaseFindings);

      // Calculate impact metrics
      this.emit('progress', {
        phase: 'analyzing',
        progress: 80,
        message: 'Calculating impact metrics',
      });
      
      findings.forEach(finding => {
        // Enhance findings with impact metrics
        if (finding.type !== 'ABANDONED_TABLE') {
          const relatedModules = modules.filter(m => 
            finding.locations.some(loc => m.filePath.includes(loc))
          );
          const mainModule = relatedModules[0];
          const duplicates = relatedModules.slice(1);
          
          if (mainModule) {
            finding.impactScore = this.metricsCalculator.calculateImpactMetrics(
              mainModule,
              duplicates
            );
          }
        }
      });

      // Phase 4: Generate report
      this.updateStatus(analysisId, 'generating_report', 90);
      this.emit('phase', 'generating_report');
      
      const report = await this.reportGenerator.generateReport({
        id: analysisId,
        findings,
        summary: this.calculateSummary(findings, modules),
        metadata: {
          projectPath: request.projectPath,
          options: request.options,
          generatedAt: new Date(),
          analysisId,
        },
      });

      // Complete analysis
      this.reports.set(analysisId, report);
      this.updateStatus(analysisId, 'completed', 100);
      status.endTime = Date.now();
      status.findingsCount = findings.length;
      
      this.emit('progress', {
        phase: 'complete',
        progress: 100,
        findingsCount: findings.length,
        message: 'Analysis completed successfully',
      });

    } catch (error) {
      this.handleAnalysisError(analysisId, error);
    }
  }

  private updateStatus(
    analysisId: string,
    newStatus: AnalysisStatus['status'],
    progress: number
  ): void {
    const status = this.analyses.get(analysisId);
    if (status) {
      status.status = newStatus;
      status.progress = progress;
      status.currentPhase = newStatus;
    }
  }

  private handleAnalysisError(analysisId: string, error: any): void {
    const status = this.analyses.get(analysisId);
    if (status) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : String(error);
      status.endTime = Date.now();
    }
    
    this.emit('progress', {
      phase: 'failed',
      progress: 0,
      message: `Analysis failed: ${status?.error}`,
    });
  }

  private calculateSummary(
    findings: RedundancyFinding[],
    modules: CodeModule[]
  ): AnalysisSummary {
    const totalFiles = modules.length;
    const totalRedundancy = findings
      .filter(f => f.type === 'EXACT_DUPLICATE' || f.type === 'SIMILAR_LOGIC')
      .reduce((sum, f) => sum + f.impactScore.scale, 0);
    
    const criticalFindings = findings.filter(f => f.severity === 'high').length;
    const tablesWithoutCrud = findings.filter(f => f.type === 'ABANDONED_TABLE').length;

    return {
      totalFiles,
      totalRedundancy,
      criticalFindings,
      tablesWithoutCrud,
    };
  }

  async getStatus(analysisId: string): Promise<AnalysisStatus> {
    const status = this.analyses.get(analysisId);
    if (!status) {
      throw new Error(`Analysis not found: ${analysisId}`);
    }
    return { ...status };
  }

  async getReport(analysisId: string): Promise<AnalysisReport> {
    const report = this.reports.get(analysisId);
    if (!report) {
      const status = await this.getStatus(analysisId);
      if (status.status !== 'completed') {
        throw new Error(`Analysis not completed: ${analysisId}`);
      }
      throw new Error(`Report not found: ${analysisId}`);
    }
    return report;
  }

  async waitForCompletion(analysisId: string, timeoutMs = 300000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Analysis timeout: ${analysisId}`));
      }, timeoutMs);

      const checkStatus = async () => {
        try {
          const status = await this.getStatus(analysisId);
          
          if (status.status === 'completed') {
            clearTimeout(timeout);
            resolve();
          } else if (status.status === 'failed') {
            clearTimeout(timeout);
            reject(new Error(status.error || 'Analysis failed'));
          } else {
            setTimeout(checkStatus, 1000);
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkStatus();
    });
  }

  getSummary(): AnalysisSummary | null {
    // Return summary from the most recent completed analysis
    for (const [id, status] of this.analyses.entries()) {
      if (status.status === 'completed') {
        const report = this.reports.get(id);
        if (report) {
          return {
            totalFiles: report.summary.totalFiles,
            totalRedundancy: report.summary.totalRedundancy,
            criticalFindings: report.summary.criticalFindings,
            tablesWithoutCrud: report.summary.tablesWithoutCrud,
          };
        }
      }
    }
    return null;
  }

  // Cleanup methods
  clearAnalysis(analysisId: string): void {
    this.analyses.delete(analysisId);
    this.reports.delete(analysisId);
  }

  clearAllAnalyses(): void {
    this.analyses.clear();
    this.reports.clear();
  }
}
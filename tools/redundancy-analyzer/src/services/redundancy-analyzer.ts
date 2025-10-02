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
import { StateManager } from '../lib/state-manager';
import { StreamingProcessor } from '../lib/streaming-processor';
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
  private stateManager: StateManager;
  private streamingProcessor: StreamingProcessor;

  constructor() {
    super();
    this.astParser = new AstParserService();
    this.similarityDetector = new SimilarityDetectorService();
    this.databaseMapper = new DatabaseMapperService();
    this.reportGenerator = new ReportGeneratorService();
    this.fileScanner = new FileScanner();
    this.metricsCalculator = new MetricsCalculator();
    this.errorHandler = ErrorHandler.getInstance();
    this.stateManager = new StateManager();
    this.streamingProcessor = new StreamingProcessor({
      maxConcurrency: 3,
      batchSize: 25,
      memoryThreshold: 256, // 256MB
      pauseOnHighMemory: true,
    });
  }

  async initialize(): Promise<void> {
    // Initialize database mapper with environment variables
    await this.databaseMapper.initialize({
      projectRoot: process.cwd(),
    });
    
    // Initialize state manager
    await this.stateManager.initialize();
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

  private async runAnalysis(analysisId: string, request: AnalysisRequest, checkpoint?: any): Promise<void> {
    const status = this.analyses.get(analysisId)!;
    
    try {
      // Phase 1: Initialize and scan files
      await this.updateStatus(analysisId, 'scanning', 5);
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
      await this.updateStatus(analysisId, 'analyzing', 15);
      this.emit('phase', 'analyzing');
      
      const modules: CodeModule[] = [];
      let processedFiles = 0;
      
      // Use streaming processor for large codebases (>1000 files)
      if (files.length > 1000) {
        this.emit('progress', {
          phase: 'analyzing',
          progress: 15,
          message: `Using streaming processor for ${files.length} files`,
        });
        
        await this.streamingProcessor.processFiles(
          request.projectPath,
          {
            excludePatterns: request.options.excludePatterns,
            includeTests: request.options.includeTests,
            includeDocs: request.options.includeDocs,
          },
          async (batch) => {
            // Process each batch of modules
            batch.modules.forEach(module => {
              if (module.metrics.linesOfCode >= request.options.minModuleSize) {
                modules.push(module);
              }
            });
            
            // Save checkpoint periodically
            if (batch.batchId % 10 === 0) {
              await this.stateManager.saveCheckpoint(analysisId, {
                phase: 'analyzing',
                processedFiles: modules.map(m => m.filePath),
                findings: [], // Will be populated later
                progress: 15 + (batch.processedCount / files.length) * 30,
              });
            }
          },
          (processed, total) => {
            processedFiles = processed;
            if (processed % 50 === 0) {
              const progress = 15 + (processed / (total || files.length)) * 30;
              this.emit('progress', {
                phase: 'analyzing',
                progress: Math.round(progress),
                filesScanned: processed,
                totalFiles: total || files.length,
              });
            }
          }
        );
      } else {
        // Use traditional processing for smaller codebases
        for (const file of files) {
          const fullPath = path.join(request.projectPath, file.path);
          
          try {
            const parsedModules = await this.astParser.parseFile(fullPath);
            parsedModules.forEach(module => {
              if (module.metrics.linesOfCode >= request.options.minModuleSize) {
                modules.push(module);
              }
            });
            
            processedFiles++;
            
            // Check memory usage periodically
            if (processedFiles % 50 === 0) {
              const memInfo = this.errorHandler.checkMemoryUsage();
              if (memInfo.percentage > 85) {
                this.errorHandler.logWarning(`High memory usage during parsing: ${memInfo.percentage.toFixed(1)}%`);
              }
            }
            
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
            if (error instanceof AnalysisError) {
              this.errorHandler.logError(error);
            } else {
              const analysisError = this.errorHandler.handleFileError(error, file.path);
              this.errorHandler.logError(analysisError);
            }
          }
        }
      }

      // Phase 3: Detect redundancy
      await this.updateStatus(analysisId, 'analyzing', 50);
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
      await this.updateStatus(analysisId, 'generating_report', 90);
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
      await this.updateStatus(analysisId, 'completed', 100);
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

  private async updateStatus(
    analysisId: string,
    newStatus: AnalysisStatus['status'],
    progress: number
  ): Promise<void> {
    const status = this.analyses.get(analysisId);
    if (status) {
      status.status = newStatus;
      status.progress = progress;
      status.currentPhase = newStatus;
      
      // Save state
      try {
        await this.stateManager.saveState({
          id: analysisId,
          status: newStatus,
          progress,
          currentPhase: newStatus,
          filesScanned: status.filesScanned,
          totalFiles: status.totalFiles,
          findingsCount: status.findingsCount,
          error: status.error,
          startTime: status.startTime,
          endTime: status.endTime,
          projectPath: '', // Will be set during analysis
          options: {}, // Will be set during analysis
        });
      } catch (error) {
        this.errorHandler.logWarning('Failed to save analysis state', { error: String(error) });
      }
    }
  }

  private handleAnalysisError(analysisId: string, error: any): void {
    const status = this.analyses.get(analysisId);
    if (status) {
      status.status = 'failed';
      
      // Use error handler to process the error
      const analysisError = error instanceof AnalysisError 
        ? error 
        : AnalysisError.fromError(error);
      
      status.error = analysisError.message;
      status.endTime = Date.now();
      
      // Log the error with context
      this.errorHandler.logError(analysisError, true);
      
      // Clean up resources
      this.errorHandler.cleanup();
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

  // Resume analysis from saved state
  async resumeAnalysis(analysisId: string): Promise<void> {
    const resumeData = await this.stateManager.resumeAnalysis(analysisId);
    if (!resumeData) {
      throw new AnalysisError(ErrorCode.INVALID_OPTIONS, `No saved state found for analysis: ${analysisId}`);
    }

    const { state, checkpoint } = resumeData;
    
    // Restore analysis status
    this.analyses.set(analysisId, {
      id: state.id,
      status: state.status,
      progress: state.progress,
      currentPhase: state.currentPhase,
      filesScanned: state.filesScanned,
      totalFiles: state.totalFiles,
      findingsCount: state.findingsCount,
      error: state.error,
      startTime: state.startTime,
      endTime: state.endTime,
    });

    // Continue analysis from checkpoint if available
    if (checkpoint && state.status !== 'completed' && state.status !== 'failed') {
      this.emit('progress', {
        phase: 'resuming',
        progress: checkpoint.progress,
        message: `Resuming analysis from ${checkpoint.phase}`,
      });
      
      // Resume the analysis
      const request: AnalysisRequest = {
        projectPath: state.projectPath,
        options: state.options,
      };
      
      this.runAnalysis(analysisId, request, checkpoint).catch(error => {
        this.handleAnalysisError(analysisId, error);
      });
    }
  }

  async listActiveAnalyses(): Promise<AnalysisStatus[]> {
    const activeStates = await this.stateManager.listActiveAnalyses();
    return activeStates.map(state => ({
      id: state.id,
      status: state.status,
      progress: state.progress,
      currentPhase: state.currentPhase,
      filesScanned: state.filesScanned,
      totalFiles: state.totalFiles,
      findingsCount: state.findingsCount,
      error: state.error,
      startTime: state.startTime,
      endTime: state.endTime,
    }));
  }

  // Cleanup methods
  async clearAnalysis(analysisId: string): Promise<void> {
    this.analyses.delete(analysisId);
    this.reports.delete(analysisId);
    await this.stateManager.deleteAnalysisState(analysisId);
  }

  async clearAllAnalyses(): Promise<void> {
    this.analyses.clear();
    this.reports.clear();
    
    // Clean up old state files
    await this.stateManager.cleanupCompletedAnalyses(0); // Clean all
  }
}
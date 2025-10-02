import * as fs from 'fs/promises';
import * as path from 'path';
import { ErrorHandler, ErrorCode } from './error-handler';
import type { AnalysisReport } from '../models/analysis-report.model';
import type { RedundancyFinding } from '../models/redundancy.model';

export interface AnalysisState {
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
  projectPath: string;
  options: any;
  partialFindings?: RedundancyFinding[];
  processedFiles?: string[];
}

export class StateManager {
  private stateDir: string;
  private errorHandler: ErrorHandler;

  constructor(stateDir: string = './analysis-state') {
    this.stateDir = stateDir;
    this.errorHandler = ErrorHandler.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
    } catch (error) {
      throw this.errorHandler.handleFileError(error, this.stateDir);
    }
  }

  async saveState(state: AnalysisState): Promise<void> {
    const statePath = path.join(this.stateDir, `${state.id}.json`);
    
    try {
      const stateData = {
        ...state,
        lastUpdated: new Date().toISOString(),
      };
      
      await fs.writeFile(statePath, JSON.stringify(stateData, null, 2), 'utf-8');
    } catch (error) {
      throw this.errorHandler.handleFileError(error, statePath);
    }
  }

  async loadState(analysisId: string): Promise<AnalysisState | null> {
    const statePath = path.join(this.stateDir, `${analysisId}.json`);
    
    try {
      const stateContent = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(stateContent) as AnalysisState;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return null; // State file doesn't exist
      }
      throw this.errorHandler.handleFileError(error, statePath);
    }
  }

  async savePartialReport(analysisId: string, report: Partial<AnalysisReport>): Promise<void> {
    const reportPath = path.join(this.stateDir, `${analysisId}-report.json`);
    
    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    } catch (error) {
      throw this.errorHandler.handleFileError(error, reportPath);
    }
  }

  async loadPartialReport(analysisId: string): Promise<Partial<AnalysisReport> | null> {
    const reportPath = path.join(this.stateDir, `${analysisId}-report.json`);
    
    try {
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(reportContent) as Partial<AnalysisReport>;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return null;
      }
      throw this.errorHandler.handleFileError(error, reportPath);
    }
  }

  async saveCheckpoint(
    analysisId: string,
    checkpoint: {
      phase: string;
      processedFiles: string[];
      findings: RedundancyFinding[];
      progress: number;
    }
  ): Promise<void> {
    const checkpointPath = path.join(this.stateDir, `${analysisId}-checkpoint.json`);
    
    try {
      const checkpointData = {
        ...checkpoint,
        timestamp: new Date().toISOString(),
      };
      
      await fs.writeFile(checkpointPath, JSON.stringify(checkpointData, null, 2), 'utf-8');
    } catch (error) {
      throw this.errorHandler.handleFileError(error, checkpointPath);
    }
  }

  async loadCheckpoint(analysisId: string): Promise<{
    phase: string;
    processedFiles: string[];
    findings: RedundancyFinding[];
    progress: number;
    timestamp: string;
  } | null> {
    const checkpointPath = path.join(this.stateDir, `${analysisId}-checkpoint.json`);
    
    try {
      const checkpointContent = await fs.readFile(checkpointPath, 'utf-8');
      return JSON.parse(checkpointContent);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return null;
      }
      throw this.errorHandler.handleFileError(error, checkpointPath);
    }
  }

  async listActiveAnalyses(): Promise<AnalysisState[]> {
    try {
      const files = await fs.readdir(this.stateDir);
      const stateFiles = files.filter(f => f.endsWith('.json') && !f.includes('-report') && !f.includes('-checkpoint'));
      
      const states: AnalysisState[] = [];
      
      for (const file of stateFiles) {
        try {
          const analysisId = path.basename(file, '.json');
          const state = await this.loadState(analysisId);
          if (state && state.status !== 'completed' && state.status !== 'failed') {
            states.push(state);
          }
        } catch (error) {
          this.errorHandler.logWarning(`Failed to load state from ${file}`, { error: String(error) });
        }
      }
      
      return states;
    } catch (error) {
      throw this.errorHandler.handleFileError(error, this.stateDir);
    }
  }

  async resumeAnalysis(analysisId: string): Promise<{
    state: AnalysisState;
    checkpoint?: any;
    partialReport?: Partial<AnalysisReport>;
  } | null> {
    const state = await this.loadState(analysisId);
    if (!state) {
      return null;
    }

    const checkpoint = await this.loadCheckpoint(analysisId);
    const partialReport = await this.loadPartialReport(analysisId);

    return {
      state,
      checkpoint,
      partialReport,
    };
  }

  async cleanupCompletedAnalyses(olderThanDays: number = 7): Promise<number> {
    try {
      const files = await fs.readdir(this.stateDir);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.stateDir, file);
          const stats = await fs.stat(filePath);
          
          // Check if file is old enough
          if (stats.mtime.getTime() < cutoffTime) {
            // Check if it's a completed analysis
            if (file.includes('-report') || file.includes('-checkpoint')) {
              await fs.unlink(filePath);
              cleanedCount++;
            } else {
              // Check the state
              const state = await this.loadState(path.basename(file, '.json'));
              if (state && (state.status === 'completed' || state.status === 'failed')) {
                await fs.unlink(filePath);
                cleanedCount++;
              }
            }
          }
        } catch (error) {
          this.errorHandler.logWarning(`Failed to process file ${file} during cleanup`, { error: String(error) });
        }
      }

      return cleanedCount;
    } catch (error) {
      throw this.errorHandler.handleFileError(error, this.stateDir);
    }
  }

  async deleteAnalysisState(analysisId: string): Promise<void> {
    const filesToDelete = [
      `${analysisId}.json`,
      `${analysisId}-report.json`,
      `${analysisId}-checkpoint.json`,
    ];

    for (const filename of filesToDelete) {
      const filePath = path.join(this.stateDir, filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore file not found errors
        if (!(error instanceof Error && error.message.includes('ENOENT'))) {
          this.errorHandler.logWarning(`Failed to delete ${filename}`, { error: String(error) });
        }
      }
    }
  }

  async getStateFileSize(analysisId: string): Promise<number> {
    const statePath = path.join(this.stateDir, `${analysisId}.json`);
    
    try {
      const stats = await fs.stat(statePath);
      return stats.size;
    } catch (error) {
      throw this.errorHandler.handleFileError(error, statePath);
    }
  }

  async validateState(state: AnalysisState): Promise<boolean> {
    const requiredFields = ['id', 'status', 'startTime', 'projectPath'];
    
    for (const field of requiredFields) {
      if (!(field in state)) {
        this.errorHandler.logWarning(`Invalid state: missing field ${field}`);
        return false;
      }
    }

    // Validate status
    const validStatuses = ['initializing', 'scanning', 'analyzing', 'generating_report', 'completed', 'failed'];
    if (!validStatuses.includes(state.status)) {
      this.errorHandler.logWarning(`Invalid state: unknown status ${state.status}`);
      return false;
    }

    // Validate progress
    if (typeof state.progress !== 'number' || state.progress < 0 || state.progress > 100) {
      this.errorHandler.logWarning(`Invalid state: invalid progress ${state.progress}`);
      return false;
    }

    return true;
  }
}
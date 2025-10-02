import { Transform, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { FileScanner } from './file-scanner';
import { AstParserService } from '../services/ast-parser.service';
import { ErrorHandler, AnalysisError } from './error-handler';
import type { FileInfo } from './file-scanner';
import type { CodeModule } from '../models/code-module.model';

export interface StreamingOptions {
  maxConcurrency?: number;
  batchSize?: number;
  memoryThreshold?: number; // MB
  pauseOnHighMemory?: boolean;
}

export interface ProcessingBatch {
  files: FileInfo[];
  modules: CodeModule[];
  batchId: number;
  processedCount: number;
  errors: Array<{ file: string; error: string }>;
}

export class StreamingProcessor {
  private fileScanner: FileScanner;
  private astParser: AstParserService;
  private errorHandler: ErrorHandler;
  private options: Required<StreamingOptions>;
  private currentBatch: CodeModule[] = [];
  private processedCount = 0;
  private batchId = 0;

  constructor(options: StreamingOptions = {}) {
    this.fileScanner = new FileScanner();
    this.astParser = new AstParserService();
    this.errorHandler = ErrorHandler.getInstance();
    
    this.options = {
      maxConcurrency: options.maxConcurrency ?? 5,
      batchSize: options.batchSize ?? 50,
      memoryThreshold: options.memoryThreshold ?? 512, // 512MB
      pauseOnHighMemory: options.pauseOnHighMemory ?? true,
    };
  }

  async processFiles(
    projectPath: string,
    scanOptions: any,
    onBatch: (batch: ProcessingBatch) => Promise<void>,
    onProgress?: (processed: number, total?: number) => void
  ): Promise<void> {
    // First, count total files for progress tracking
    const fileCount = await this.fileScanner.countFiles(projectPath, scanOptions);
    const totalFiles = fileCount.total;
    
    if (onProgress) {
      onProgress(0, totalFiles);
    }

    // Create file stream
    const fileStream = this.createFileStream(projectPath, scanOptions);
    
    // Create processing pipeline
    const parseTransform = this.createParseTransform();
    const batchTransform = this.createBatchTransform(onBatch, onProgress);
    
    try {
      await pipeline(
        fileStream,
        parseTransform,
        batchTransform
      );
      
      // Process any remaining files in the current batch
      if (this.currentBatch.length > 0) {
        await this.flushBatch(onBatch);
      }
      
    } catch (error) {
      const analysisError = AnalysisError.fromError(error);
      this.errorHandler.logError(analysisError);
      throw analysisError;
    }
  }

  private createFileStream(projectPath: string, scanOptions: any): Readable {
    let fileIndex = 0;
    const self = this;
    
    return new Readable({
      objectMode: true,
      async read() {
        try {
          // Stream files using the existing scanner
          const hasMore = await self.fileScanner.streamFiles(
            projectPath,
            { ...scanOptions, maxFiles: 1 },
            async (file: FileInfo) => {
              this.push(file);
              fileIndex++;
            }
          );
          
          if (hasMore === 0) {
            this.push(null); // End of stream
          }
        } catch (error) {
          this.destroy(error);
        }
      },
    });
  }

  private createParseTransform(): Transform {
    const concurrentPromises = new Map<string, Promise<CodeModule[]>>();
    const self = this;
    
    return new Transform({
      objectMode: true,
      async transform(file: FileInfo, encoding, callback) {
        try {
          // Check memory usage before processing
          if (self.options.pauseOnHighMemory) {
            const memInfo = self.errorHandler.checkMemoryUsage();
            const memUsageMB = memInfo.used / (1024 * 1024);
            
            if (memUsageMB > self.options.memoryThreshold) {
              self.errorHandler.logWarning(`High memory usage (${memUsageMB.toFixed(1)}MB), pausing...`);
              
              // Wait for memory to decrease
              await self.waitForMemoryRelease();
            }
          }
          
          // Limit concurrent parsing
          while (concurrentPromises.size >= self.options.maxConcurrency) {
            const [firstKey] = concurrentPromises.keys();
            await concurrentPromises.get(firstKey);
            concurrentPromises.delete(firstKey);
          }
          
          // Parse file asynchronously
          const parsePromise = self.astParser.parseFile(file.path)
            .catch(error => {
              self.errorHandler.logWarning(`Failed to parse ${file.path}`, { error: String(error) });
              return []; // Return empty array on parse failure
            });
          
          concurrentPromises.set(file.path, parsePromise);
          
          const modules = await parsePromise;
          concurrentPromises.delete(file.path);
          
          // Pass modules downstream
          for (const module of modules) {
            this.push(module);
          }
          
          callback();
        } catch (error) {
          callback(error);
        }
      },
      
      async flush(callback) {
        // Wait for all remaining promises to complete
        await Promise.all(concurrentPromises.values());
        callback();
      }
    });
  }

  private createBatchTransform(
    onBatch: (batch: ProcessingBatch) => Promise<void>,
    onProgress?: (processed: number, total?: number) => void
  ): Transform {
    const self = this;
    
    return new Transform({
      objectMode: true,
      async transform(module: CodeModule, encoding, callback) {
        try {
          self.currentBatch.push(module);
          self.processedCount++;
          
          // Update progress
          if (onProgress) {
            onProgress(self.processedCount);
          }
          
          // Process batch when it reaches the target size
          if (self.currentBatch.length >= self.options.batchSize) {
            await self.flushBatch(onBatch);
          }
          
          callback();
        } catch (error) {
          callback(error);
        }
      },
      
      async flush(callback) {
        // Process any remaining modules
        if (self.currentBatch.length > 0) {
          await self.flushBatch(onBatch);
        }
        callback();
      }
    });
  }

  private async flushBatch(onBatch: (batch: ProcessingBatch) => Promise<void>): Promise<void> {
    if (this.currentBatch.length === 0) return;
    
    const batch: ProcessingBatch = {
      files: [], // Files are processed in stream, so we don't track them here
      modules: [...this.currentBatch],
      batchId: ++this.batchId,
      processedCount: this.processedCount,
      errors: [], // Errors are handled in the transform
    };
    
    try {
      await onBatch(batch);
      
      // Clear current batch
      this.currentBatch = [];
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
    } catch (error) {
      const analysisError = AnalysisError.fromError(error);
      this.errorHandler.logError(analysisError);
      throw analysisError;
    }
  }

  private async waitForMemoryRelease(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 1000; // 1 second
    let waitTime = 0;
    
    while (waitTime < maxWaitTime) {
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
      
      const memInfo = this.errorHandler.checkMemoryUsage();
      const memUsageMB = memInfo.used / (1024 * 1024);
      
      if (memUsageMB <= this.options.memoryThreshold * 0.8) {
        // Memory usage dropped below 80% of threshold
        break;
      }
    }
  }

  // Utility method to estimate memory usage of modules
  estimateBatchMemoryUsage(modules: CodeModule[]): number {
    // Rough estimation: each module takes about 1KB + AST size
    return modules.reduce((total, module) => {
      const astSize = JSON.stringify(module.ast).length;
      const moduleSize = module.content.length;
      return total + astSize + moduleSize + 1024; // 1KB overhead
    }, 0);
  }

  // Method to dynamically adjust batch size based on memory usage
  adjustBatchSize(): void {
    const memInfo = this.errorHandler.checkMemoryUsage();
    const memUsageMB = memInfo.used / (1024 * 1024);
    
    if (memUsageMB > this.options.memoryThreshold * 0.9) {
      // Reduce batch size if memory usage is high
      this.options.batchSize = Math.max(10, Math.floor(this.options.batchSize * 0.8));
      this.errorHandler.logWarning(`Reducing batch size to ${this.options.batchSize} due to high memory usage`);
    } else if (memUsageMB < this.options.memoryThreshold * 0.5) {
      // Increase batch size if memory usage is low
      this.options.batchSize = Math.min(100, Math.floor(this.options.batchSize * 1.2));
    }
  }

  reset(): void {
    this.currentBatch = [];
    this.processedCount = 0;
    this.batchId = 0;
  }

  getStats(): {
    processedCount: number;
    currentBatchSize: number;
    batchId: number;
    memoryUsage: { used: number; total: number; percentage: number };
  } {
    return {
      processedCount: this.processedCount,
      currentBatchSize: this.currentBatch.length,
      batchId: this.batchId,
      memoryUsage: this.errorHandler.checkMemoryUsage(),
    };
  }
}
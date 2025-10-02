import chalk from 'chalk';

export enum ErrorCode {
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  INVALID_OPTIONS = 'INVALID_OPTIONS',
  PARSE_ERROR = 'PARSE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  FILE_ACCESS_ERROR = 'FILE_ACCESS_ERROR',
  ANALYSIS_TIMEOUT = 'ANALYSIS_TIMEOUT',
  INSUFFICIENT_MEMORY = 'INSUFFICIENT_MEMORY',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AnalysisError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, any>;
  public readonly recoverable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, any>,
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
  }

  static fromError(error: unknown, code: ErrorCode = ErrorCode.UNKNOWN_ERROR): AnalysisError {
    if (error instanceof AnalysisError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const context = error instanceof Error ? { stack: error.stack } : { value: error };

    return new AnalysisError(code, message, context);
  }

  toJSON(): Record<string, any> {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      recoverable: this.recoverable,
    };
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      operationId?: string;
      retryDelay?: number;
      onRetry?: (attempt: number, error: AnalysisError) => void;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const operationId = options.operationId ?? 'anonymous';
    const retryDelay = options.retryDelay ?? 1000;

    let lastError: AnalysisError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Reset retry count on success
        this.retryAttempts.delete(operationId);
        
        return result;
      } catch (error) {
        lastError = AnalysisError.fromError(error);
        
        // Don't retry non-recoverable errors
        if (!lastError.recoverable || attempt === maxRetries) {
          this.retryAttempts.delete(operationId);
          throw lastError;
        }

        // Track retry attempts
        this.retryAttempts.set(operationId, attempt + 1);
        
        if (options.onRetry) {
          options.onRetry(attempt + 1, lastError);
        }

        // Wait before retrying
        if (retryDelay > 0) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    throw lastError!;
  }

  handleFileError(error: unknown, filePath: string): AnalysisError {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        return new AnalysisError(
          ErrorCode.FILE_ACCESS_ERROR,
          `File not found: ${filePath}`,
          { filePath, originalError: error.message },
          false
        );
      }
      
      if (error.message.includes('EACCES')) {
        return new AnalysisError(
          ErrorCode.FILE_ACCESS_ERROR,
          `Permission denied: ${filePath}`,
          { filePath, originalError: error.message },
          false
        );
      }
      
      if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
        return new AnalysisError(
          ErrorCode.INSUFFICIENT_MEMORY,
          'Too many files open. Consider reducing the scope of analysis.',
          { filePath, originalError: error.message },
          true
        );
      }
    }

    return new AnalysisError(
      ErrorCode.FILE_ACCESS_ERROR,
      `Failed to access file: ${filePath}`,
      { filePath, originalError: String(error) },
      true
    );
  }

  handleDatabaseError(error: unknown, operation: string): AnalysisError {
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('timeout')) {
        return new AnalysisError(
          ErrorCode.NETWORK_ERROR,
          `Database network error during ${operation}`,
          { operation, originalError: error.message },
          true
        );
      }
      
      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return new AnalysisError(
          ErrorCode.DATABASE_ERROR,
          `Database permission error during ${operation}`,
          { operation, originalError: error.message },
          false
        );
      }
    }

    return new AnalysisError(
      ErrorCode.DATABASE_ERROR,
      `Database error during ${operation}: ${error instanceof Error ? error.message : String(error)}`,
      { operation, originalError: String(error) },
      true
    );
  }

  handleParseError(error: unknown, filePath: string): AnalysisError {
    return new AnalysisError(
      ErrorCode.PARSE_ERROR,
      `Failed to parse file: ${filePath}`,
      { filePath, originalError: String(error) },
      false // Parse errors are usually not recoverable
    );
  }

  logError(error: AnalysisError, verbose: boolean = false): void {
    console.error(chalk.red(`❌ ${error.message}`));
    
    if (verbose && error.context) {
      console.error(chalk.gray('Context:'), JSON.stringify(error.context, null, 2));
    }
    
    if (error.recoverable) {
      console.error(chalk.yellow('ℹ️ This error may be recoverable'));
    }
  }

  logWarning(message: string, context?: Record<string, any>): void {
    console.warn(chalk.yellow(`⚠️ ${message}`));
    
    if (context) {
      console.warn(chalk.gray('Context:'), JSON.stringify(context, null, 2));
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Memory monitoring
  checkMemoryUsage(): { used: number; total: number; percentage: number } {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const percentage = (usedMemory / totalMemory) * 100;

    if (percentage > 90) {
      this.logWarning('High memory usage detected', {
        used: Math.round(usedMemory / 1024 / 1024),
        total: Math.round(totalMemory / 1024 / 1024),
        percentage: Math.round(percentage),
      });
    }

    return {
      used: usedMemory,
      total: totalMemory,
      percentage,
    };
  }

  // Resource cleanup
  cleanup(): void {
    this.retryAttempts.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}
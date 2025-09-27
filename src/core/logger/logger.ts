// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/logger/logger.ts
// purpose: Structured logging service with multiple outputs and voice event integration
// spec_ref: core#logger
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: medium
// offline_capability: REQUIRED

// dependencies:
//   - src/core/config/environment.ts
//   - src/core/errors/error-types.ts

// exports:
//   - Logger: class - Main logging service
//   - createLogger(context: string): Logger - Logger factory function
//   - LogLevel: enum - Log severity levels
//   - LogContext: interface - Logging context metadata
//   - setGlobalLogLevel(level: LogLevel): void - Global log level configuration

// voice_considerations: |
//   Voice interaction events must be logged with special voice context metadata.
//   Support voice-activated log level changes during development and debugging.
//   Voice command logs should include audio quality metrics and recognition confidence.
//   Critical voice errors should trigger both logging and immediate voice feedback.

// security_considerations: |
//   All log outputs must sanitize sensitive data (passwords, tokens, PII) before writing.
//   Implement log rotation and retention policies to prevent disk space exhaustion.
//   Production logs must never contain full request/response bodies or user data.
//   Log access must be restricted with proper authentication and authorization.

// performance_considerations: |
//   Use asynchronous logging to prevent blocking the main application thread.
//   Implement log buffering and batching for high-throughput scenarios.
//   Cache logger instances to avoid repeated configuration parsing.
//   Use structured JSON logging for faster parsing and querying.

// tasks:
//     1. Create Logger class with configurable log levels and output destinations
//     2. Implement structured JSON logging with timestamp, level, context, and metadata
//     3. Add multiple output adapters (console, file, Supabase, external services)
//     4. Create logger factory with context-specific configurations
//     5. Implement log sanitization to remove sensitive data automatically
//     6. Add log buffering and batching for performance optimization
//     7. Create log rotation and retention management for file outputs
//     8. Implement correlation ID tracking for request tracing
//     9. Add voice-specific log metadata (audio quality, recognition confidence)
//     10. Create development vs production logging configuration profiles
// --- END DIRECTIVE BLOCK ---

import { config } from '../config/environment';

/**
 * Log severity levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

/**
 * Logging context metadata
 */
export interface LogContext {
  [key: string]: any;
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  metadata?: LogContext;
}

/**
 * Main logging service
 */
export class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.minLevel = minLevel;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogContext): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogContext): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogContext): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: LogContext): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Log critical message
   */
  critical(message: string, metadata?: LogContext): void {
    this.log(LogLevel.CRITICAL, message, metadata);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: LogContext): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message: this.sanitizeMessage(message),
      metadata: metadata ? this.sanitizeMetadata(metadata) : undefined,
    };

    this.output(entry);
  }

  /**
   * Sanitize log message to remove sensitive data
   */
  private sanitizeMessage(message: string): string {
    // Remove potential passwords, tokens, keys
    if (!message) return '';
    return message
      .replace(/password[:\s]*[^\s]+/gi, 'password: [REDACTED]')
      .replace(/token[:\s]*[^\s]+/gi, 'token: [REDACTED]')
      .replace(/key[:\s]*[^\s]+/gi, 'key: [REDACTED]');
  }

  /**
   * Sanitize metadata to remove sensitive data
   */
  private sanitizeMetadata(metadata: LogContext): LogContext {
    const sanitized: LogContext = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('key')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Output log entry to configured destinations
   */
  private output(entry: LogEntry): void {
    // Console output
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp;
    const message = `[${timestamp}] [${levelName}] [${entry.context}] ${entry.message}`;
    
    if (entry.level >= LogLevel.ERROR) {
      console.error(message, entry.metadata || '');
    } else if (entry.level >= LogLevel.WARN) {
      console.warn(message, entry.metadata || '');
    } else {
      console.log(message, entry.metadata || '');
    }

    // TODO: Add file output, Supabase logging, external service integration
  }
}

// Global log level management
let globalLogLevel: LogLevel = config.env === 'development' ? LogLevel.DEBUG : LogLevel.INFO;

/**
 * Logger factory function
 */
export function createLogger(context: string): Logger {
  return new Logger(context, globalLogLevel);
}

/**
 * Global log level configuration
 */
export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}
/**
 * Mock for core Logger class
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.minLevel = minLevel;
  }

  debug = jest.fn((message: string, metadata?: LogContext): void => {
    // Mock implementation
  });

  info = jest.fn((message: string, metadata?: LogContext): void => {
    // Mock implementation
  });

  warn = jest.fn((message: string, metadata?: LogContext): void => {
    // Mock implementation
  });

  error = jest.fn((message: string, metadata?: LogContext): void => {
    // Mock implementation
  });

  critical = jest.fn((message: string, metadata?: LogContext): void => {
    // Mock implementation
  });

  // Private log method that won't cause issues
  private log(level: LogLevel, message: string, metadata?: LogContext): void {
    // Mock implementation - no sanitization needed in tests
  }
}

export const createLogger = jest.fn((context: string) => new Logger(context));
export const setGlobalLogLevel = jest.fn();
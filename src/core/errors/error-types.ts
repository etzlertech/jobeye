// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/errors/error-types.ts
// purpose: Centralized error type definitions with voice-specific error categories
// spec_ref: core#error-types
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: low
// offline_capability: NONE

// dependencies:
//   - typescript: ^5.4.0

// exports:
//   - AppError: class - Base application error class
//   - DatabaseError: class - Database-specific error class
//   - VoiceError: class - Voice processing error class
//   - ValidationError: class - Input validation error class
//   - AuthenticationError: class - Authentication failure error class
//   - NetworkError: class - Network connectivity error class
//   - ErrorCode: enum - Standardized error codes
//   - ErrorSeverity: enum - Error severity levels

// voice_considerations: |
//   All error types must include voice-friendly messages for TTS output.
//   Voice-specific errors need special handling for microphone and speaker issues.
//   Error announcements should be concise and actionable for voice users.

// security_considerations: |
//   Error messages must never expose sensitive data or system internals.
//   Stack traces should be sanitized before logging in production.
//   Authentication errors must not reveal user existence or account details.
//   Database errors must not expose schema or connection information.

// performance_considerations: |
//   Error objects should be lightweight with minimal serialization overhead.
//   Error stack traces should be lazily evaluated to reduce memory usage.
//   Error codes should use numeric values for faster comparison operations.

// tasks:
//     1. Define base AppError class with standard properties (code, message, severity)
//     2. Create specialized error classes for each domain (Database, Voice, Auth, etc.)
//     3. Implement ErrorCode enum with standardized numeric codes for all error types
//     4. Add ErrorSeverity enum (CRITICAL, HIGH, MEDIUM, LOW, INFO)
//     5. Create voice-friendly message generation for all error types
//     6. Implement error serialization/deserialization for API transport
//     7. Add error categorization helpers for monitoring and alerting
//     8. Create error code documentation with resolution guidelines
//     9. Implement error chaining support for root cause analysis
//     10. Add error sanitization utilities for production logging
//
// --- END DIRECTIVE BLOCK ---

/**
 * Standardized error codes
 */
export enum ErrorCode {
  // Generic errors
  UNKNOWN = 1000,
  INVALID_INPUT = 1001,
  UNAUTHORIZED = 1002,
  FORBIDDEN = 1003,
  NOT_FOUND = 1004,
  
  // Database errors
  DATABASE_CONNECTION = 2000,
  DATABASE_QUERY = 2001,
  DATABASE_TRANSACTION = 2002,
  
  // Voice errors
  VOICE_RECOGNITION = 3000,
  VOICE_SYNTHESIS = 3001,
  VOICE_DEVICE = 3002,
  VOICE_TIMEOUT = 3003,
  
  // Network errors
  NETWORK_OFFLINE = 4000,
  NETWORK_TIMEOUT = 4001,
  NETWORK_ERROR = 4002,
  
  // Authentication errors
  AUTH_INVALID_CREDENTIALS = 5000,
  AUTH_TOKEN_EXPIRED = 5001,
  AUTH_INSUFFICIENT_PERMISSIONS = 5002,
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly voiceMessage: string;
  public readonly timestamp: Date;
  public category?: ErrorCategory;
  public userMessage?: string;
  public metadata?: Record<string, unknown>;
  public originalError?: Error;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    voiceMessage?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.voiceMessage = voiceMessage || this.generateVoiceMessage(message);
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  private generateVoiceMessage(message: string): string {
    // Generate voice-friendly version of error message
    return message
      .replace(/[^\w\s]/g, '') // Remove special characters
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase()); // Title case
  }
}

/**
 * Database-specific error class
 */
export class DatabaseError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.DATABASE_CONNECTION) {
    super(message, code, ErrorSeverity.HIGH, 'Database connection issue detected');
  }
}

/**
 * Voice processing error class  
 */
export class VoiceError extends AppError {
  public readonly audioContext?: any;
  
  constructor(message: string, code: ErrorCode = ErrorCode.VOICE_RECOGNITION, audioContext?: any) {
    super(message, code, ErrorSeverity.MEDIUM, 'Voice system error occurred');
    this.audioContext = audioContext;
  }
}

/**
 * Input validation error class
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  
  constructor(message: string, field?: string) {
    super(message, ErrorCode.INVALID_INPUT, ErrorSeverity.LOW, 'Input validation failed');
    this.field = field;
  }
}

/**
 * Authentication failure error class
 */
export class AuthenticationError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.AUTH_INVALID_CREDENTIALS) {
    super(message, code, ErrorSeverity.HIGH, 'Authentication required');
  }
}

/**
 * Network connectivity error class
 */
export class NetworkError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.NETWORK_ERROR) {
    super(message, code, ErrorSeverity.MEDIUM, 'Network connectivity issue');
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, ErrorCode.NOT_FOUND, ErrorSeverity.LOW, 'Resource not found');
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorCode.UNKNOWN, ErrorSeverity.MEDIUM, 'Resource conflict detected');
  }
}

/**
 * External service error class
 */
export class ExternalServiceError extends AppError {
  constructor(message: string, serviceName?: string) {
    super(message, ErrorCode.NETWORK_ERROR, ErrorSeverity.HIGH, 'External service error');
    if (serviceName) {
      this.metadata = { serviceName };
    }
  }
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  DATABASE = 'database',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VOICE = 'voice',
  SYSTEM = 'system',
  EXTERNAL_SERVICE = 'external_service',
}

/**
 * Extended error creation options
 */
export interface ErrorOptions {
  code: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  userMessage?: string;
  originalError?: Error;
  metadata?: Record<string, any>;
}

/**
 * Factory function to create app errors
 */
export function createAppError(options: ErrorOptions): AppError {
  const error = new AppError(
    options.message,
    ErrorCode.UNKNOWN, // Map string code to enum if needed
    options.severity,
    options.userMessage
  );
  
  // Add additional properties
  error.category = options.category;
  error.userMessage = options.userMessage;
  error.metadata = options.metadata;
  error.originalError = options.originalError;
  
  return error;
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

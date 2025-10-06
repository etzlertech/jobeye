// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/errors/error-handler.ts
// purpose: Global error handling service with voice notifications and recovery strategies
// spec_ref: core#error-handler
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: high
// offline_capability: REQUIRED
//
// dependencies:
//   - src/core/errors/error-types.ts
//   - src/core/logger/logger.ts
//   - src/core/logger/voice-logger.ts
//   - src/core/events/event-bus.ts
//
// exports:
//   - ErrorHandler: class - Main error handling service
//   - handleError(error: Error, context?: ErrorContext): Promise<void> - Global error handler
//   - RecoveryStrategy: interface - Error recovery strategy definition
//   - ErrorContext: interface - Error context information
//   - registerRecoveryStrategy(errorType: string, strategy: RecoveryStrategy): void - Recovery registration
//
// voice_considerations: |
//   Critical errors must trigger immediate voice announcements to alert users.
//   Voice error messages should provide clear recovery instructions.
//   Support voice commands for "retry operation" and "dismiss error" interactions.
//   Error notifications should respect voice UI volume and speech rate settings.
//
// security_considerations: |
//   Error handling must sanitize all error details before external logging.
//   Never expose system paths, credentials, or internal state in error messages.
//   Implement rate limiting for error notifications to prevent spam attacks.
//   Error recovery strategies must validate user permissions before executing.
//
// performance_considerations: |
//   Error handling should be non-blocking with async processing for notifications.
//   Implement error deduplication to prevent repeated processing of identical errors.
//   Use error batching for non-critical errors to reduce notification overhead.
//   Cache recovery strategies to avoid repeated strategy resolution.
//
// tasks:
//     1. Create ErrorHandler singleton service with dependency injection
//     2. Implement global error handling with context information capture
//     3. Add voice notification system for critical and high-severity errors
//     4. Create pluggable recovery strategy system with registration mechanism
//     5. Implement error deduplication logic to prevent notification spam
//     6. Add error escalation rules based on severity and frequency
//     7. Create error reporting integration with monitoring systems
//     8. Implement error recovery workflow with user confirmation prompts
//     9. Add error analytics collection for pattern analysis
//     10. Create graceful degradation handlers for system-wide failures
// --- END DIRECTIVE BLOCK ---

import { 
  AppError, 
  ErrorSeverity, 
  ErrorCategory,
  isAppError,
  createAppError
} from './error-types';
import { createLogger } from '../logger/logger';
import { voiceLogger } from '../logger/voice-logger';
import { EventBus } from '../events/event-bus';

const logger = createLogger('error-handler');

export interface ErrorContext {
  userId?: string;
  tenantId?: string;
  operation?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  sessionId?: string;
  voiceSessionId?: string;
}

export interface RecoveryStrategy {
  name: string;
  canRecover(error: Error, context?: ErrorContext): boolean;
  recover(error: Error, context?: ErrorContext): Promise<boolean>;
  description: string;
  requiresUserConfirmation?: boolean;
}

interface ErrorNotification {
  errorId: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context?: ErrorContext;
  timestamp: Date;
  isVoiceEnabled: boolean;
}

interface ErrorDeduplicationEntry {
  hash: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  contexts: ErrorContext[];
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private recoveryStrategies: Map<string, RecoveryStrategy[]> = new Map();
  private errorDeduplication: Map<string, ErrorDeduplicationEntry> = new Map();
  private errorQueue: ErrorNotification[] = [];
  private eventBus: EventBus;
  private isProcessing = false;
  private deduplicationWindow = 5 * 60 * 1000; // 5 minutes
  private maxQueueSize = 100;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.startErrorProcessor();
    this.setupCleanupInterval();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  async handleError(error: Error, context?: ErrorContext): Promise<void> {
    try {
      // Enhance context with timestamp
      const enhancedContext: ErrorContext = {
        ...context,
        timestamp: new Date(),
      };

      // Convert to AppError if needed
      const appError = isAppError(error) ? error : createAppError({
        code: 'UNKNOWN_ERROR',
        message: error.message,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.SYSTEM,
        originalError: error,
      });

      // Check for deduplication
      const errorHash = this.generateErrorHash(appError);
      if (this.shouldDeduplicate(errorHash, enhancedContext)) {
        return;
      }

      // Log the error
      this.logError(appError, enhancedContext);

      // Queue for notification
      await this.queueErrorNotification(appError, enhancedContext);

      // Attempt recovery
      await this.attemptRecovery(appError, enhancedContext);

      // Emit error event
      this.eventBus.emit('error:handled', {
        error: appError,
        context: enhancedContext,
      });

    } catch (handlingError) {
      // Last resort logging
      console.error('Error handler failed:', handlingError);
      console.error('Original error:', error);
    }
  }

  registerRecoveryStrategy(errorType: string, strategy: RecoveryStrategy): void {
    if (!this.recoveryStrategies.has(errorType)) {
      this.recoveryStrategies.set(errorType, []);
    }
    this.recoveryStrategies.get(errorType)!.push(strategy);
    logger.info(`Registered recovery strategy: ${strategy.name} for ${errorType}`);
  }

  private generateErrorHash(error: AppError): string {
    const category = error.category ?? 'unknown';
    return `${error.code}-${category}-${error.message}`;
  }

  private shouldDeduplicate(hash: string, context: ErrorContext): boolean {
    const existing = this.errorDeduplication.get(hash);
    
    if (!existing) {
      this.errorDeduplication.set(hash, {
        hash,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        contexts: [context],
      });
      return false;
    }

    // Update existing entry
    existing.count++;
    existing.lastSeen = new Date();
    existing.contexts.push(context);

    // Deduplicate if seen recently
    const timeSinceFirst = Date.now() - existing.firstSeen.getTime();
    return timeSinceFirst < this.deduplicationWindow;
  }

  private logError(error: AppError, context: ErrorContext): void {
    const sanitizedError = this.sanitizeError(error);
    const payload = {
      code: sanitizedError.code,
      category: sanitizedError.category,
      severity: sanitizedError.severity,
      context: this.sanitizeContext(context),
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        logger.error(sanitizedError.message, payload);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(sanitizedError.message, payload);
        break;
      case ErrorSeverity.LOW:
        logger.info(sanitizedError.message, payload);
        break;
      default:
        if (typeof logger.debug === 'function') {
          logger.debug(sanitizedError.message, payload);
        } else {
          logger.info(sanitizedError.message, payload);
        }
    }
  }

  private sanitizeError(error: AppError): AppError {
    // Remove sensitive information
    const sanitized = Object.assign(
      Object.create(Object.getPrototypeOf(error)),
      error
    ) as AppError;
    
    // Remove any paths, credentials, or internal details
    if (sanitized.message) {
      sanitized.message = sanitized.message
        .replace(/\/[a-zA-Z0-9/_.-]+/g, '[PATH]')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
        .replace(/\b(?:password|token|key|secret)\b[:\s]*[^\s]+/gi, '[REDACTED]');
    }

    return sanitized;
  }

  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized = { ...context };
    
    // Remove sensitive metadata
    if (sanitized.metadata) {
      const cleanMetadata: Record<string, any> = {};
      for (const [key, value] of Object.entries(sanitized.metadata)) {
        if (!key.match(/password|token|key|secret/i)) {
          cleanMetadata[key] = value;
        }
      }
      sanitized.metadata = cleanMetadata;
    }

    return sanitized;
  }

  private getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'debug';
    }
  }

  private async queueErrorNotification(error: AppError, context: ErrorContext): Promise<void> {
    // Check if voice notification is needed
    const needsVoiceNotification =
      error.severity === ErrorSeverity.CRITICAL ||
      (error.severity === ErrorSeverity.HIGH && Boolean(context.voiceSessionId));

    const notification: ErrorNotification = {
      errorId: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: this.formatUserMessage(error),
      severity: error.severity,
      category: error.category ?? ErrorCategory.SYSTEM,
      context,
      timestamp: new Date(),
      isVoiceEnabled: needsVoiceNotification,
    };

    // Add to queue with size limit
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest
    }
    this.errorQueue.push(notification);
  }

  private formatUserMessage(error: AppError): string {
    // Create user-friendly message
    let message = error.userMessage || error.message;

    const suggestions = Array.isArray((error.metadata as any)?.suggestions)
      ? ((error.metadata as any).suggestions as string[])
      : undefined;

    if (suggestions?.length) {
      message += `. ${suggestions.join('. ')}`;
    }

    return message;
  }

  private async startErrorProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessing || this.errorQueue.length === 0) {
        return;
      }

      this.isProcessing = true;
      try {
        await this.processErrorQueue();
      } finally {
        this.isProcessing = false;
      }
    }, 1000); // Process every second
  }

  private async processErrorQueue(): Promise<void> {
    const batch = this.errorQueue.splice(0, 10); // Process up to 10 at a time

    for (const notification of batch) {
      try {
        // Send voice notification if needed
        if (notification.isVoiceEnabled) {
          await this.sendVoiceNotification(notification);
        }

        // Emit notification event
        this.eventBus.emit('error:notification', notification);

      } catch (notifyError) {
        logger.error('Failed to process error notification', { error: notifyError });
      }
    }
  }

  private async sendVoiceNotification(notification: ErrorNotification): Promise<void> {
    const voiceMessage = this.createVoiceMessage(notification);
    
    await voiceLogger.speakError(voiceMessage, {
      priority: notification.severity === ErrorSeverity.CRITICAL ? 'high' : 'normal',
    });
  }

  private createVoiceMessage(notification: ErrorNotification): string {
    const severityText = notification.severity === ErrorSeverity.CRITICAL 
      ? 'Critical error' 
      : 'Error occurred';

    let message = `${severityText}: ${notification.message}`;

    // Add context if available
    if (notification.context?.operation) {
      message = `${severityText} during ${notification.context.operation}: ${notification.message}`;
    }

    return message;
  }

  private async attemptRecovery(error: AppError, context: ErrorContext): Promise<void> {
    const strategies = this.recoveryStrategies.get(String(error.code)) || [];
    
    for (const strategy of strategies) {
      try {
        if (strategy.canRecover(error, context)) {
          logger.info(`Attempting recovery with strategy: ${strategy.name}`);
          
          const recovered = await strategy.recover(error, context);
          
          if (recovered) {
            logger.info(`Recovery successful with strategy: ${strategy.name}`);
            this.eventBus.emit('error:recovered', {
              error,
              strategy: strategy.name,
              context,
            });
            return;
          }
        }
      } catch (recoveryError) {
        logger.error(`Recovery strategy failed: ${strategy.name}`, { error: recoveryError });
      }
    }
  }

  private setupCleanupInterval(): void {
    // Clean up old deduplication entries
    setInterval(() => {
      const cutoff = Date.now() - this.deduplicationWindow;
      
      for (const [hash, entry] of this.errorDeduplication.entries()) {
        if (entry.lastSeen.getTime() < cutoff) {
          this.errorDeduplication.delete(hash);
        }
      }
    }, 60 * 1000); // Clean up every minute
  }

  // Public utility methods
  getErrorStats(): {
    queueSize: number;
    deduplicationEntries: number;
    recentErrors: ErrorDeduplicationEntry[];
  } {
    const recentErrors = Array.from(this.errorDeduplication.values())
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 10);

    return {
      queueSize: this.errorQueue.length,
      deduplicationEntries: this.errorDeduplication.size,
      recentErrors,
    };
  }
}

// Convenience exports
export const handleError = (error: Error, context?: ErrorContext): Promise<void> => {
  return ErrorHandler.getInstance().handleError(error, context);
};

export const registerRecoveryStrategy = (errorType: string, strategy: RecoveryStrategy): void => {
  ErrorHandler.getInstance().registerRecoveryStrategy(errorType, strategy);
};

// API-specific error handling exports for Next.js routes
import { NextResponse } from 'next/server';

/**
 * API Error class for structured API responses
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Main API error handler for Next.js routes
 */
export function handleApiError(error: unknown): NextResponse {
  // Log the error through the main error handler
  if (error instanceof Error) {
    handleError(error, { operation: 'api_request' }).catch(console.error);
  }

  if (error instanceof ApiError) {
    return NextResponse.json(error.toJSON(), { 
      status: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Code': error.code
      }
    });
  }

  if (error instanceof Error) {
    // Handle known error types
    if (error.message.includes('JWT') || error.message.includes('Unauthorized')) {
      return unauthorized('Invalid or expired authentication token');
    }

    if (error.message.includes('permission') || error.message.includes('access') || error.message.includes('Forbidden')) {
      return forbidden('Insufficient permissions for this operation');
    }

    if (error.message.includes('not found') || error.message.includes('404')) {
      return notFound('The requested resource was not found');
    }

    // Generic error handling
    const apiError = new ApiError(
      'An unexpected error occurred',
      500,
      'INTERNAL_ERROR',
      { originalMessage: error.message }
    );

    return NextResponse.json(apiError.toJSON(), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Code': 'INTERNAL_ERROR'
      }
    });
  }

  // Handle non-Error objects
  const unknownError = new ApiError(
    'An unknown error occurred',
    500,
    'UNKNOWN_ERROR',
    { error: String(error) }
  );

  return NextResponse.json(unknownError.toJSON(), { 
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': 'UNKNOWN_ERROR'
    }
  });
}

/**
 * Convenience methods for common HTTP errors
 */
export function unauthorized(message: string = 'Unauthorized access', details?: any): NextResponse {
  const error = new ApiError(message, 401, 'UNAUTHORIZED', details);
  return NextResponse.json(error.toJSON(), { 
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': 'UNAUTHORIZED'
    }
  });
}

export function forbidden(message: string = 'Forbidden access', details?: any): NextResponse {
  const error = new ApiError(message, 403, 'FORBIDDEN', details);
  return NextResponse.json(error.toJSON(), { 
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': 'FORBIDDEN'
    }
  });
}

export function notFound(message: string = 'Resource not found', details?: any): NextResponse {
  const error = new ApiError(message, 404, 'NOT_FOUND', details);
  return NextResponse.json(error.toJSON(), { 
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': 'NOT_FOUND'
    }
  });
}

export function validationError(message: string = 'Validation failed', details?: any): NextResponse {
  const error = new ApiError(message, 422, 'VALIDATION_ERROR', details);
  return NextResponse.json(error.toJSON(), { 
    status: 422,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': 'VALIDATION_ERROR'
    }
  });
}

export function serverError(message: string = 'Internal server error', details?: any): NextResponse {
  const error = new ApiError(message, 500, 'INTERNAL_ERROR', details);
  return NextResponse.json(error.toJSON(), { 
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': 'INTERNAL_ERROR'
    }
  });
}

export function conflictError(message: string = 'Resource conflict', details?: any): NextResponse {
  const error = new ApiError(message, 409, 'CONFLICT', details);
  return NextResponse.json(error.toJSON(), { 
    status: 409,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': 'CONFLICT'
    }
  });
}

export function badRequest(message: string = 'Bad request', details?: any): NextResponse {
  const error = new ApiError(message, 400, 'BAD_REQUEST', details);
  return NextResponse.json(error.toJSON(), { 
    status: 400,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': 'BAD_REQUEST'
    }
  });
}

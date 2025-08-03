// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/errors/error-handler.ts
// purpose: Global error handling service with voice notifications and recovery strategies
// spec_ref: core#error-handler
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: high
// offline_capability: REQUIRED

// dependencies:
//   - src/core/errors/error-types.ts
//   - src/core/logger/logger.ts
//   - src/core/logger/voice-logger.ts
//   - src/core/events/event-bus.ts

// exports:
//   - ErrorHandler: class - Main error handling service
//   - handleError(error: Error, context?: ErrorContext): Promise<void> - Global error handler
//   - RecoveryStrategy: interface - Error recovery strategy definition
//   - ErrorContext: interface - Error context information
//   - registerRecoveryStrategy(errorType: string, strategy: RecoveryStrategy): void - Recovery registration

// voice_considerations: |
//   Critical errors must trigger immediate voice announcements to alert users.
//   Voice error messages should provide clear recovery instructions.
//   Support voice commands for "retry operation" and "dismiss error" interactions.
//   Error notifications should respect voice UI volume and speech rate settings.

// security_considerations: |
//   Error handling must sanitize all error details before external logging.
//   Never expose system paths, credentials, or internal state in error messages.
//   Implement rate limiting for error notifications to prevent spam attacks.
//   Error recovery strategies must validate user permissions before executing.

// performance_considerations: |
//   Error handling should be non-blocking with async processing for notifications.
//   Implement error deduplication to prevent repeated processing of identical errors.
//   Use error batching for non-critical errors to reduce notification overhead.
//   Cache recovery strategies to avoid repeated strategy resolution.

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

import { AppError } from './error-types';
import { createLogger } from '../logger/logger';

const logger = createLogger('error-handler');

export interface ErrorContext {
  userId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface RecoveryStrategy {
  canRecover(error: Error): boolean;
  recover(error: Error, context?: ErrorContext): Promise<void>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  async handleError(error: Error, context?: ErrorContext): Promise<void> {
    logger.error(error.message, { error: error.name, context });
    
    // TODO: Implement recovery strategies, voice notifications
  }
  
  registerRecoveryStrategy(errorType: string, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(errorType, strategy);
  }
}

export const handleError = (error: Error, context?: ErrorContext): Promise<void> => {
  return ErrorHandler.getInstance().handleError(error, context);
};

export const registerRecoveryStrategy = (errorType: string, strategy: RecoveryStrategy): void => {
  ErrorHandler.getInstance().registerRecoveryStrategy(errorType, strategy);
};
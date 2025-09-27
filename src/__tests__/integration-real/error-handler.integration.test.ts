/**
 * Error Handler integration tests with real functionality
 * Tests error handling, recovery strategies, and voice notifications
 */

import { 
  ErrorHandler,
  handleError,
  registerRecoveryStrategy,
  RecoveryStrategy,
  ErrorContext
} from '@/core/errors/error-handler';
import { 
  AppError,
  ErrorSeverity,
  ErrorCategory,
  createAppError
} from '@/core/errors/error-types';
import { EventBus } from '@/core/events/event-bus';
import { delay } from './test-setup';

describe('Error Handler Integration Tests', () => {
  let errorHandler: ErrorHandler;
  let eventBus: EventBus;
  let capturedEvents: any[] = [];

  beforeAll(() => {
    errorHandler = ErrorHandler.getInstance();
    eventBus = EventBus.getInstance();

    // Capture events for testing
    eventBus.on('error:handled', (data) => {
      capturedEvents.push({ type: 'handled', data });
    });

    eventBus.on('error:notification', (data) => {
      capturedEvents.push({ type: 'notification', data });
    });

    eventBus.on('error:recovered', (data) => {
      capturedEvents.push({ type: 'recovered', data });
    });
  });

  beforeEach(() => {
    capturedEvents = [];
  });

  describe('Basic Error Handling', () => {
    it('should handle standard JavaScript errors', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        userId: 'test-user',
        operation: 'test-operation',
      };

      await handleError(error, context);
      await delay(1500); // Allow async processing (error processor runs every 1s)

      expect(capturedEvents).toHaveLength(2);
      expect(capturedEvents.find(e => e.type === 'notification')).toBeDefined();
      expect(capturedEvents.find(e => e.type === 'handled')).toBeDefined();
      const handledEvent = capturedEvents.find(e => e.type === 'handled');
      expect(handledEvent.data.context.userId).toBe('test-user');
    });

    it('should handle AppError with proper categorization', async () => {
      const appError = createAppError({
        code: 'DB_CONNECTION_ERROR',
        message: 'Database connection failed',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        metadata: {
          database: 'main',
          attempts: 3,
        },
      });

      await handleError(appError);
      await delay(100);

      const handledEvent = capturedEvents.find(e => e.type === 'handled');
      expect(handledEvent).toBeDefined();
      expect(handledEvent.data.error.code).toBe('DB_CONNECTION_ERROR');
      expect(handledEvent.data.error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should sanitize sensitive information', async () => {
      const error = createAppError({
        code: 'AUTH_FAILED',
        message: 'Authentication failed for user@example.com with password secret123',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.AUTHENTICATION,
      });

      await handleError(error);
      await delay(100);

      const notification = capturedEvents.find(e => e.type === 'notification');
      expect(notification.data.message).not.toContain('user@example.com');
      expect(notification.data.message).not.toContain('secret123');
    });
  });

  describe('Error Deduplication', () => {
    it('should deduplicate identical errors within time window', async () => {
      const error = createAppError({
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
      });

      // Send same error multiple times
      for (let i = 0; i < 5; i++) {
        await handleError(error);
      }
      
      await delay(200);

      // Should only have one notification due to deduplication
      const notifications = capturedEvents.filter(e => e.type === 'notification');
      expect(notifications).toHaveLength(1);
    });

    it('should track deduplication counts', async () => {
      const error = createAppError({
        code: 'API_ERROR',
        message: 'API call failed',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.EXTERNAL_SERVICE,
      });

      // Send multiple times
      await handleError(error);
      await handleError(error);
      await handleError(error);

      const stats = errorHandler.getErrorStats();
      expect(stats.deduplicationEntries).toBeGreaterThan(0);
      
      const deduplicatedError = stats.recentErrors.find(
        e => e.hash.includes('API_ERROR')
      );
      expect(deduplicatedError?.count).toBe(3);
    });
  });

  describe('Recovery Strategies', () => {
    it('should execute recovery strategy when applicable', async () => {
      let recoveryAttempted = false;
      
      const retryStrategy: RecoveryStrategy = {
        name: 'retry-strategy',
        description: 'Retry failed operations',
        canRecover: (error) => error.message.includes('retry'),
        recover: async () => {
          recoveryAttempted = true;
          return true;
        },
      };

      registerRecoveryStrategy('RETRY_ERROR', retryStrategy);

      const error = createAppError({
        code: 'RETRY_ERROR',
        message: 'Operation failed, please retry',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
      });

      await handleError(error);
      await delay(100);

      expect(recoveryAttempted).toBe(true);
      
      const recoveredEvent = capturedEvents.find(e => e.type === 'recovered');
      expect(recoveredEvent).toBeDefined();
      expect(recoveredEvent.data.strategy).toBe('retry-strategy');
    });

    it('should try multiple recovery strategies', async () => {
      const attemptedStrategies: string[] = [];

      const strategy1: RecoveryStrategy = {
        name: 'strategy-1',
        description: 'First strategy',
        canRecover: () => true,
        recover: async () => {
          attemptedStrategies.push('strategy-1');
          return false; // Fail to recover
        },
      };

      const strategy2: RecoveryStrategy = {
        name: 'strategy-2',
        description: 'Second strategy',
        canRecover: () => true,
        recover: async () => {
          attemptedStrategies.push('strategy-2');
          return true; // Success
        },
      };

      registerRecoveryStrategy('MULTI_STRATEGY_ERROR', strategy1);
      registerRecoveryStrategy('MULTI_STRATEGY_ERROR', strategy2);

      const error = createAppError({
        code: 'MULTI_STRATEGY_ERROR',
        message: 'Error needing multiple strategies',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.SYSTEM,
      });

      await handleError(error);
      await delay(100);

      expect(attemptedStrategies).toEqual(['strategy-1', 'strategy-2']);
      
      const recoveredEvent = capturedEvents.find(e => e.type === 'recovered');
      expect(recoveredEvent.data.strategy).toBe('strategy-2');
    });
  });

  describe('Voice Notifications', () => {
    it('should trigger voice notification for critical errors', async () => {
      const criticalError = createAppError({
        code: 'CRITICAL_SYSTEM_ERROR',
        message: 'System critical failure detected',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.SYSTEM,
      });

      await handleError(criticalError, {
        voiceSessionId: 'voice-123',
        operation: 'system-check',
      });
      
      await delay(100);

      const notification = capturedEvents.find(e => e.type === 'notification');
      expect(notification.data.isVoiceEnabled).toBe(true);
    });

    it('should not trigger voice for low severity errors without voice session', async () => {
      const lowError = createAppError({
        code: 'INFO_LOG',
        message: 'Informational message',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.SYSTEM,
      });

      await handleError(lowError);
      await delay(100);

      const notification = capturedEvents.find(e => e.type === 'notification');
      expect(notification.data.isVoiceEnabled).toBe(false);
    });

    it('should include operation context in voice message', async () => {
      const error = createAppError({
        code: 'OPERATION_FAILED',
        message: 'Failed to complete task',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.BUSINESS_LOGIC,
      });

      await handleError(error, {
        operation: 'job-creation',
        voiceSessionId: 'voice-456',
      });
      
      await delay(100);

      const notification = capturedEvents.find(e => e.type === 'notification');
      expect(notification).toBeDefined();
      expect(notification.data.context.operation).toBe('job-creation');
    });
  });

  describe('Error Queue Management', () => {
    it('should process errors in batches', async () => {
      // Create multiple errors
      for (let i = 0; i < 15; i++) {
        const error = createAppError({
          code: `BATCH_ERROR_${i}`,
          message: `Batch error ${i}`,
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.SYSTEM,
        });
        await handleError(error);
      }

      await delay(2000); // Allow batch processing

      const notifications = capturedEvents.filter(e => e.type === 'notification');
      expect(notifications.length).toBe(15);
    });

    it('should respect queue size limits', async () => {
      // Generate more errors than queue size
      for (let i = 0; i < 150; i++) {
        const error = new Error(`Queue test error ${i}`);
        await handleError(error);
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.queueSize).toBeLessThanOrEqual(100); // Max queue size
    });
  });

  describe('Error Context Enhancement', () => {
    it('should enhance context with timestamp', async () => {
      const error = new Error('Context test');
      const context: ErrorContext = {
        userId: 'user-123',
        tenantId: 'tenant-456',
      };

      await handleError(error, context);
      await delay(100);

      const handledEvent = capturedEvents.find(e => e.type === 'handled');
      expect(handledEvent.data.context.timestamp).toBeDefined();
      expect(handledEvent.data.context.userId).toBe('user-123');
      expect(handledEvent.data.context.tenantId).toBe('tenant-456');
    });

    it('should sanitize context metadata', async () => {
      const error = new Error('Metadata test');
      const context: ErrorContext = {
        metadata: {
          username: 'testuser',
          password: 'secret123',
          apiKey: 'key-123',
          normalData: 'safe-value',
        },
      };

      await handleError(error, context);
      await delay(100);

      const handledEvent = capturedEvents.find(e => e.type === 'handled');
      const sanitizedMetadata = handledEvent.data.context.metadata;
      
      expect(sanitizedMetadata.normalData).toBe('safe-value');
      expect(sanitizedMetadata.password).toBeUndefined();
      expect(sanitizedMetadata.apiKey).toBeUndefined();
    });
  });

  describe('Error Statistics', () => {
    it('should provide error statistics', async () => {
      // Generate some errors
      const errors = [
        { code: 'STAT_ERROR_1', message: 'Stats test 1' },
        { code: 'STAT_ERROR_2', message: 'Stats test 2' },
        { code: 'STAT_ERROR_1', message: 'Stats test 1' }, // Duplicate
      ];

      for (const err of errors) {
        await handleError(createAppError({
          ...err,
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.SYSTEM,
        }));
      }

      await delay(100);

      const stats = errorHandler.getErrorStats();
      expect(stats.deduplicationEntries).toBeGreaterThan(0);
      expect(stats.recentErrors).toBeDefined();
      expect(Array.isArray(stats.recentErrors)).toBe(true);
    });
  });

  describe('Error Categories', () => {
    it('should handle different error categories appropriately', async () => {
      const errorCategories = [
        { category: ErrorCategory.DATABASE, code: 'DB_ERROR' },
        { category: ErrorCategory.NETWORK, code: 'NET_ERROR' },
        { category: ErrorCategory.AUTHENTICATION, code: 'AUTH_ERROR' },
        { category: ErrorCategory.VALIDATION, code: 'VAL_ERROR' },
        { category: ErrorCategory.BUSINESS_LOGIC, code: 'BIZ_ERROR' },
      ];

      for (const { category, code } of errorCategories) {
        await handleError(createAppError({
          code,
          message: `${category} error`,
          severity: ErrorSeverity.MEDIUM,
          category,
        }));
      }

      await delay(200);

      const notifications = capturedEvents.filter(e => e.type === 'notification');
      expect(notifications).toHaveLength(errorCategories.length);
      
      // Verify each category was processed
      for (const { category } of errorCategories) {
        const found = notifications.some(n => n.data.category === category);
        expect(found).toBe(true);
      }
    });
  });
});
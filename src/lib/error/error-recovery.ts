/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/error/error-recovery.ts
 * phase: 3
 * domain: error-handling
 * purpose: Automated error recovery and resilience mechanisms
 * spec_ref: 007-mvp-intent-driven/contracts/error-recovery.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['healthy', 'degraded', 'recovering', 'failed'],
 *   transitions: [
 *     'healthy->degraded: errorDetected()',
 *     'degraded->recovering: startRecovery()',
 *     'recovering->healthy: recoverySuccess()',
 *     'recovering->failed: recoveryFailed()',
 *     'failed->recovering: retryRecovery()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "errorRecovery": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/offline/sync-manager',
 *     '@/lib/offline/offline-db',
 *     '@/lib/voice/voice-processor',
 *     '@/core/logger/voice-logger'
 *   ],
 *   external: [],
 *   supabase: []
 * }
 * exports: ['ErrorRecoveryManager', 'RecoveryStrategy', 'HealthCheck']
 * voice_considerations: Provide voice feedback during recovery processes
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/lib/error/error-recovery.test.ts'
 * }
 * tasks: [
 *   'Implement automated health monitoring',
 *   'Create recovery strategies for different error types',
 *   'Add circuit breaker pattern for API calls',
 *   'Implement graceful degradation mechanisms'
 * ]
 */

import { syncManager } from '@/lib/offline/sync-manager';
import { offlineDB } from '@/lib/offline/offline-db';
import { voiceProcessor } from '@/lib/voice/voice-processor';
import { voiceLogger } from '@/core/logger/voice-logger';

export interface RecoveryStrategy {
  name: string;
  condition: (error: Error) => boolean;
  recover: () => Promise<boolean>;
  maxRetries: number;
  retryDelay: number;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
  interval: number;
}

export interface RecoveryResult {
  success: boolean;
  strategy?: string;
  attempts: number;
  error?: Error;
}

export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private isMonitoring: boolean = false;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private recoveryStrategies: RecoveryStrategy[] = [];
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private degradedServices: Set<string> = new Set();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeStrategies();
    this.initializeHealthChecks();
    this.initializeCircuitBreakers();
  }

  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  private initializeStrategies(): void {
    // Network error recovery
    this.recoveryStrategies.push({
      name: 'network-retry',
      condition: (error) => this.isNetworkError(error),
      recover: async () => {
        try {
          // Test connectivity with a simple API call
          const response = await fetch('/api/health', { 
            method: 'GET',
            cache: 'no-cache'
          });
          return response.ok;
        } catch {
          return false;
        }
      },
      maxRetries: 3,
      retryDelay: 2000
    });

    // IndexedDB corruption recovery
    this.recoveryStrategies.push({
      name: 'indexeddb-recovery',
      condition: (error) => this.isIndexedDBError(error),
      recover: async () => {
        try {
          // Clear and reinitialize IndexedDB
          const dbName = 'jobeye_offline';
          await this.clearIndexedDB(dbName);
          await offlineDB.initialize();
          return true;
        } catch {
          return false;
        }
      },
      maxRetries: 1,
      retryDelay: 1000
    });

    // Voice API recovery
    this.recoveryStrategies.push({
      name: 'voice-recovery',
      condition: (error) => this.isVoiceError(error),
      recover: async () => {
        try {
          // Reinitialize voice processor
          const status = voiceProcessor.getStatus();
          if (!status.isSupported) {
            return false;
          }
          
          // Test voice functionality
          await voiceProcessor.speak('Testing voice recovery', { volume: 0 });
          return true;
        } catch {
          return false;
        }
      },
      maxRetries: 2,
      retryDelay: 1000
    });

    // Service worker recovery
    this.recoveryStrategies.push({
      name: 'service-worker-recovery',
      condition: (error) => this.isServiceWorkerError(error),
      recover: async () => {
        try {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
              await registration.update();
              return true;
            }
          }
          return false;
        } catch {
          return false;
        }
      },
      maxRetries: 1,
      retryDelay: 5000
    });

    // Chunk loading error recovery
    this.recoveryStrategies.push({
      name: 'chunk-reload',
      condition: (error) => this.isChunkLoadError(error),
      recover: async () => {
        // Force page reload for chunk errors
        window.location.reload();
        return true;
      },
      maxRetries: 1,
      retryDelay: 0
    });

    // Permission error recovery
    this.recoveryStrategies.push({
      name: 'permission-recovery',
      condition: (error) => this.isPermissionError(error),
      recover: async () => {
        try {
          // Attempt to re-request permissions
          if (navigator.mediaDevices) {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
      maxRetries: 1,
      retryDelay: 0
    });
  }

  private initializeHealthChecks(): void {
    // API connectivity check
    this.healthChecks.set('api-connectivity', {
      name: 'api-connectivity',
      check: async () => {
        try {
          const response = await fetch('/api/health', { 
            method: 'GET',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
          });
          return response.ok;
        } catch {
          return false;
        }
      },
      critical: true,
      interval: 30000 // 30 seconds
    });

    // IndexedDB health check
    this.healthChecks.set('indexeddb', {
      name: 'indexeddb',
      check: async () => {
        try {
          const stats = await offlineDB.getStorageStats();
          return typeof stats === 'object';
        } catch {
          return false;
        }
      },
      critical: true,
      interval: 60000 // 1 minute
    });

    // Voice processor health check
    this.healthChecks.set('voice-processor', {
      name: 'voice-processor',
      check: async () => {
        try {
          const status = voiceProcessor.getStatus();
          return status.isSupported;
        } catch {
          return false;
        }
      },
      critical: false,
      interval: 120000 // 2 minutes
    });

    // Sync manager health check
    this.healthChecks.set('sync-manager', {
      name: 'sync-manager',
      check: async () => {
        try {
          const stats = await syncManager.getSyncStats();
          return typeof stats === 'object';
        } catch {
          return false;
        }
      },
      critical: true,
      interval: 45000 // 45 seconds
    });
  }

  private initializeCircuitBreakers(): void {
    // API circuit breaker
    this.circuitBreakers.set('api', new CircuitBreaker({
      failureThreshold: 5,
      timeout: 60000,
      resetTimeout: 30000
    }));

    // Voice API circuit breaker
    this.circuitBreakers.set('voice', new CircuitBreaker({
      failureThreshold: 3,
      timeout: 30000,
      resetTimeout: 15000
    }));

    // IndexedDB circuit breaker
    this.circuitBreakers.set('indexeddb', new CircuitBreaker({
      failureThreshold: 3,
      timeout: 30000,
      resetTimeout: 10000
    }));
  }

  async recover(error: Error): Promise<RecoveryResult> {
    voiceLogger.error('Starting error recovery', { error: error.message });

    for (const strategy of this.recoveryStrategies) {
      if (strategy.condition(error)) {
        voiceLogger.info(`Attempting recovery with strategy: ${strategy.name}`);
        
        let attempts = 0;
        let lastError: Error | undefined;

        while (attempts < strategy.maxRetries) {
          attempts++;
          
          try {
            const success = await strategy.recover();
            
            if (success) {
              voiceLogger.info(`Recovery successful with strategy: ${strategy.name}`, {
                attempts
              });
              
              return {
                success: true,
                strategy: strategy.name,
                attempts
              };
            }
          } catch (recoveryError) {
            lastError = recoveryError instanceof Error ? recoveryError : new Error('Recovery failed');
            voiceLogger.warn(`Recovery attempt ${attempts} failed for strategy: ${strategy.name}`, {
              error: lastError
            });
          }

          if (attempts < strategy.maxRetries) {
            await this.delay(strategy.retryDelay);
          }
        }

        voiceLogger.error(`Recovery failed after ${attempts} attempts for strategy: ${strategy.name}`);
      }
    }

    return {
      success: false,
      attempts: 0,
      error
    };
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    voiceLogger.info('Starting error recovery monitoring');

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 10000); // Check every 10 seconds

    // Setup global error handlers
    this.setupGlobalErrorHandlers();
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    voiceLogger.info('Stopping error recovery monitoring');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async performHealthChecks(): Promise<void> {
    for (const [name, healthCheck] of this.healthChecks) {
      try {
        const isHealthy = await healthCheck.check();
        
        if (!isHealthy) {
          if (!this.degradedServices.has(name)) {
            this.degradedServices.add(name);
            voiceLogger.warn(`Service degraded: ${name}`);
            
            if (healthCheck.critical) {
              await this.handleCriticalServiceFailure(name);
            }
          }
        } else {
          if (this.degradedServices.has(name)) {
            this.degradedServices.delete(name);
            voiceLogger.info(`Service recovered: ${name}`);
          }
        }
      } catch (error) {
        voiceLogger.error(`Health check failed for ${name}`, { error });
      }
    }
  }

  private async handleCriticalServiceFailure(serviceName: string): Promise<void> {
    voiceLogger.error(`Critical service failure: ${serviceName}`);

    // Attempt automatic recovery based on service type
    switch (serviceName) {
      case 'api-connectivity':
        await this.recoverApiConnectivity();
        break;
      case 'indexeddb':
        await this.recoverIndexedDB();
        break;
      case 'sync-manager':
        await this.recoverSyncManager();
        break;
    }
  }

  private async recoverApiConnectivity(): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get('api');
    if (circuitBreaker && circuitBreaker.state === 'open') {
      return; // Circuit breaker is open, don't attempt recovery
    }

    try {
      // Enable offline mode
      await syncManager.syncAll({ priorityOnly: true });
    } catch (error) {
      voiceLogger.error('Failed to enable offline mode', { error });
    }
  }

  private async recoverIndexedDB(): Promise<void> {
    try {
      // Attempt to reinitialize IndexedDB
      await offlineDB.initialize();
    } catch (error) {
      voiceLogger.error('Failed to recover IndexedDB', { error });
    }
  }

  private async recoverSyncManager(): Promise<void> {
    try {
      // Reset sync manager state
      await syncManager.clearAllData();
    } catch (error) {
      voiceLogger.error('Failed to recover sync manager', { error });
    }
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      voiceLogger.error('Unhandled promise rejection', { 
        reason: event.reason,
        promise: event.promise
      });
      
      // Attempt recovery for known error types
      if (event.reason instanceof Error) {
        this.recover(event.reason);
      }
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      voiceLogger.error('JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });

      if (event.error instanceof Error) {
        this.recover(event.error);
      }
    });
  }

  // Circuit breaker methods
  async executeWithCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(key);
    if (!circuitBreaker) {
      return operation();
    }

    return circuitBreaker.execute(operation);
  }

  // Error type detection methods
  private isNetworkError(error: Error): boolean {
    return error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('Failed to fetch') ||
           error.name === 'NetworkError';
  }

  private isIndexedDBError(error: Error): boolean {
    return error.message.includes('IDBDatabase') ||
           error.message.includes('IndexedDB') ||
           error.name === 'InvalidStateError';
  }

  private isVoiceError(error: Error): boolean {
    return error.message.includes('Speech') ||
           error.message.includes('recognition') ||
           error.message.includes('synthesis') ||
           error.name === 'NotSupportedError';
  }

  private isServiceWorkerError(error: Error): boolean {
    return error.message.includes('ServiceWorker') ||
           error.message.includes('service worker');
  }

  private isChunkLoadError(error: Error): boolean {
    return error.message.includes('ChunkLoadError') ||
           error.message.includes('Loading chunk');
  }

  private isPermissionError(error: Error): boolean {
    return error.message.includes('permission') ||
           error.name === 'NotAllowedError' ||
           error.name === 'PermissionDeniedError';
  }

  private async clearIndexedDB(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API
  isServiceHealthy(serviceName: string): boolean {
    return !this.degradedServices.has(serviceName);
  }

  getDegradedServices(): string[] {
    return Array.from(this.degradedServices);
  }

  getCircuitBreakerState(key: string): string {
    const circuitBreaker = this.circuitBreakers.get(key);
    return circuitBreaker ? circuitBreaker.state : 'unknown';
  }
}

// Circuit Breaker implementation
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private config: {
      failureThreshold: number;
      timeout: number;
      resetTimeout: number;
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  get currentState(): string {
    return this.state;
  }
}

// Export singleton instance
export const errorRecoveryManager = ErrorRecoveryManager.getInstance();
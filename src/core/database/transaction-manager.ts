// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/database/transaction-manager.ts
// purpose: Database transaction management with automatic rollback and nested transaction support
// spec_ref: core#transaction-manager
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: high
// offline_capability: OPTIONAL
//
// dependencies:
//   - @supabase/supabase-js: ^2.43.0
//   - src/core/database/connection.ts
//   - src/core/logger/logger.ts
//   - src/core/errors/error-handler.ts
//
// exports:
//   - TransactionManager: class - Main transaction management class
//   - withTransaction<T>(fn: TransactionFn<T>): Promise<T> - Transaction wrapper function
//   - TransactionContext: interface - Transaction context type
//   - TransactionFn<T>: type - Transaction function signature
//
// voice_considerations: |
//   Transaction failures should trigger voice alerts for critical operations.
//   Voice commands for "rollback transaction" and "commit changes" in development mode.
//   Long-running transactions should provide voice progress updates.
//
// security_considerations: |
//   All transaction operations must respect Row Level Security (RLS) policies.
//   Transaction logs must not contain sensitive data or user information.
//   Implement transaction timeout limits to prevent resource locking (max 30 seconds).
//   Ensure proper cleanup of transaction resources on application shutdown.
//
// performance_considerations: |
//   Use connection pooling from database connection manager.
//   Implement deadlock detection and automatic retry with exponential backoff.
//   Cache prepared statements within transaction context for performance.
//   Limit nested transaction depth to maximum of 5 levels to prevent stack overflow.
//
// tasks:
//   1. Create TransactionManager class with connection dependency injection
//   2. Implement withTransaction wrapper function with automatic rollback on errors
//   3. Add support for nested transactions using savepoints
//   4. Implement transaction timeout handling with configurable limits
//   5. Add transaction context tracking with unique transaction IDs
//   6. Create deadlock detection and automatic retry mechanism
//   7. Implement transaction logging with performance metrics
//   8. Add transaction rollback hooks for cleanup operations
//   9. Create transaction status monitoring for health checks
//   10. Add graceful transaction cleanup for connection termination
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './connection';
import { createLogger } from '../logger/logger';

const logger = createLogger('transaction-manager');

export interface TransactionContext {
  id: string;
  startTime: Date;
  client: SupabaseClient;
}

export type TransactionFn<T> = (context: TransactionContext) => Promise<T>;

export class TransactionManager {
  private static instance: TransactionManager;
  
  static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }
  
  async withTransaction<T>(fn: TransactionFn<T>): Promise<T> {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context: TransactionContext = {
      id: transactionId,
      startTime: new Date(),
      client: supabase()
    };
    
    logger.debug(`Starting transaction ${transactionId}`);
    
    try {
      const result = await fn(context);
      logger.debug(`Transaction ${transactionId} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`Transaction ${transactionId} failed`, { error });
      throw error;
    }
  }
}

export const withTransaction = <T>(fn: TransactionFn<T>): Promise<T> => {
  return TransactionManager.getInstance().withTransaction(fn);
};
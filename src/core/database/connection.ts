// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/database/connection.ts
// purpose: Centralized Supabase client management with connection pooling and offline detection
// spec_ref: core#database-connection
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: medium
// offline_capability: REQUIRED
//
// dependencies:
//   - @supabase/supabase-js: ^2.43.0
//   - src/core/config/environment.ts
//   - src/core/logger/logger.ts
//
// exports:
//   - supabase: SupabaseClient - Main Supabase client instance
//   - createClient(): SupabaseClient - Factory function for new client instances
//   - isOffline(): boolean - Network connectivity status checker
//   - waitForConnection(): Promise<void> - Connection establishment waiter
//
// voice_considerations: |
//   Connection status must be communicated via voice alerts when offline mode is detected.
//   Voice commands for "check database status" and "retry connection" should be supported.
//   Connection failures should trigger voice notifications to inform users of offline operation.
//
// security_considerations: |
//   All database credentials must be loaded from environment variables only.
//   Connection strings must never be logged or exposed in error messages.
//   Implement connection timeout and retry logic to prevent hanging connections.
//   Use RLS (Row Level Security) policies for all data access patterns.
//
// performance_considerations: |
//   Implement connection pooling to reuse database connections efficiently.
//   Cache connection status to avoid repeated network checks.
//   Use connection timeouts of max 5 seconds for initial connection attempts.
//   Implement exponential backoff for reconnection attempts (1s, 2s, 4s, 8s max).
//
// tasks:
//   1. Create SupabaseClient singleton with proper configuration from environment
//   2. Implement connection pooling with configurable pool size (default: 10)
//   3. Add offline detection using navigator.onLine and periodic ping to Supabase
//   4. Implement connection retry logic with exponential backoff
//   5. Add connection health monitoring with periodic status checks
//   6. Create factory function for creating additional client instances
//   7. Implement proper error handling for connection failures
//   8. Add connection status event emitters for other services to subscribe
//   9. Create connection metrics collection for monitoring dashboard
//   10. Add graceful connection cleanup for application shutdown
// --- END DIRECTIVE BLOCK ---

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { createLogger } from '../logger/logger';

const logger = createLogger('database-connection');

// Singleton Supabase client instance
let supabaseInstance: SupabaseClient | null = null;

/**
 * Main Supabase client instance
 */
export const supabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    if (!config.supabase.url || !config.supabase.anonKey) {
      throw new Error('Supabase configuration missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
    }
    
    supabaseInstance = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'jobeye-client@3.2.1',
        },
      },
    });
    
    logger.info('Supabase client initialized');
  }
  
  return supabaseInstance;
};

/**
 * Factory function for creating new client instances
 */
export function createClientInstance(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(config.supabase.url, config.supabase.anonKey);
}

/**
 * Network connectivity status checker
 */
export function isOffline(): boolean {
  if (typeof navigator !== 'undefined') {
    return !navigator.onLine;
  }
  // Server-side always considered online
  return false;
}

/**
 * Connection establishment waiter
 */
export async function waitForConnection(): Promise<void> {
  const client = supabase();
  
  try {
    // Simple connectivity test
    const { error } = await client.from('_health_check').select('*').limit(1);
    if (error && !error.message.includes('relation "_health_check" does not exist')) {
      throw error;
    }
    logger.info('Database connection verified');
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw new Error('Failed to establish database connection');
  }
}
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/monitoring/health-check.ts
// purpose: Application health monitoring with voice system status and dependency checks
// spec_ref: core#health-check
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: medium
// offline_capability: REQUIRED

// dependencies:
//   - src/core/database/connection.ts
//   - src/core/logger/logger.ts
//   - src/core/config/environment.ts

// exports:
//   - HealthChecker: class - Main health monitoring service
//   - checkHealth(): Promise<HealthStatus> - Overall system health check
//   - HealthStatus: interface - Health check result type
//   - HealthCheck: interface - Individual health check definition  
//   - registerHealthCheck(name: string, check: HealthCheck): void - Health check registration

// voice_considerations: |
//   Voice system health should include microphone access, speaker functionality, and TTS/STT availability.
//   Critical health failures should trigger voice announcements for immediate user notification.
//   Voice commands for "system status check" and "voice diagnostics" should be supported.
//   Health status should be announced via voice when requested by users.

// security_considerations: |
//   Health check endpoints must not expose sensitive system information or credentials.
//   Health status should sanitize all error messages to prevent information disclosure.
//   Rate limit health check requests to prevent abuse and system overload.
//   Health check authentication should be separate from main application authentication.

// performance_considerations: |
//   Health checks should complete within 5 seconds maximum to avoid timeout issues.
//   Use parallel execution for independent health checks to reduce total check time.
//   Cache health check results for 30 seconds to avoid repeated expensive operations.
//   Implement circuit breaker pattern for failing health checks to prevent cascading failures.

// tasks:
//     1. Create HealthChecker service with configurable health check registry
//     2. Implement database connectivity health check with connection pool status
//     3. Add voice system health checks (microphone, speakers, STT/TTS providers)
//     4. Create memory and CPU usage monitoring with threshold alerting
//     5. Implement external service dependency health checks (Supabase, voice APIs)
//     6. Add application startup health validation with failure blocking
//     7. Create health check result caching and expiration management
//     8. Implement health status aggregation with overall system status calculation
//     9. Add health check metrics collection for monitoring dashboard integration
//     10. Create health check API endpoint for external monitoring tools
// --- END DIRECTIVE BLOCK ---

import { supabase } from '../database/connection';
import { createLogger } from '../logger/logger';
import { config } from '../config/environment';

const logger = createLogger('health-check');

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: Date;
}

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message?: string;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
}

export class HealthChecker {
  private static instance: HealthChecker;
  private checks: Map<string, HealthCheck> = new Map();
  
  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
      HealthChecker.instance.registerDefaultChecks();
    }
    return HealthChecker.instance;
  }
  
  private registerDefaultChecks(): void {
    this.registerHealthCheck('database', {
      name: 'database',
      check: async () => {
        const start = Date.now();
        try {
          await supabase().from('_health').select('1').limit(1);
          return {
            name: 'database',
            status: 'pass',
            duration: Date.now() - start
          };
        } catch (error) {
          return {
            name: 'database',
            status: 'fail',
            duration: Date.now() - start,
            message: 'Database connection failed'
          };
        }
      }
    });
  }
  
  registerHealthCheck(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }
  
  async checkHealth(): Promise<HealthStatus> {
    const results: HealthCheckResult[] = [];
    
    for (const [name, healthCheck] of this.checks) {
      try {
        const result = await healthCheck.check();
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'fail',
          duration: 0,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const failedChecks = results.filter(r => r.status === 'fail').length;
    const warnChecks = results.filter(r => r.status === 'warn').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks > 0) {
      status = 'unhealthy';
    } else if (warnChecks > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    
    return {
      status,
      checks: results,
      timestamp: new Date()
    };
  }
}

export const checkHealth = (): Promise<HealthStatus> => {
  return HealthChecker.getInstance().checkHealth();
};

export const registerHealthCheck = (name: string, check: HealthCheck): void => {
  HealthChecker.getInstance().registerHealthCheck(name, check);
};
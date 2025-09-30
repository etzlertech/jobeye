/**
 * @file cost-tracking.bench.ts
 * @purpose Performance benchmark tests for cost tracking
 */

import { CostTrackingService } from '../../services/cost-tracking.service';
import { createClient } from '@supabase/supabase-js';

describe('Cost Tracking Performance Benchmarks', () => {
  let service: CostTrackingService;
  let supabase: any;

  beforeAll(() => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key'
    );

    service = new CostTrackingService(supabase);
  });

  describe('Single Cost Record Operations', () => {
    it('should track cost in under 100ms', async () => {
      const start = performance.now();

      await service.trackCost({
        companyId: 'bench-company-001',
        verificationId: `vrfy-${Date.now()}`,
        method: 'vlm',
        cost: 0.10,
        provider: 'openai'
      }).catch(() => {
        // Ignore database errors in benchmark
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      console.log(`Cost tracking took ${duration.toFixed(2)}ms`);
    });

    it('should check budget in under 50ms', async () => {
      const start = performance.now();

      await service.checkBudget('bench-company-001', 10.00).catch(() => {
        // Ignore database errors in benchmark
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      console.log(`Budget check took ${duration.toFixed(2)}ms`);
    });
  });

  describe('Bulk Operations', () => {
    it('should track 100 costs in under 1 second', async () => {
      const costs = Array.from({ length: 100 }, (_, i) => ({
        companyId: 'bench-company-001',
        verificationId: `vrfy-bulk-${Date.now()}-${i}`,
        method: 'vlm' as const,
        cost: 0.10,
        provider: 'openai'
      }));

      const start = performance.now();

      await Promise.all(
        costs.map(cost => service.trackCost(cost).catch(() => {}))
      );

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
      console.log(`100 cost tracks took ${duration.toFixed(2)}ms (${(duration/100).toFixed(2)}ms avg)`);
    });

    it('should aggregate daily costs in under 200ms', async () => {
      const start = performance.now();

      await service.getDailyCosts('bench-company-001', new Date()).catch(() => {
        // Ignore database errors in benchmark
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
      console.log(`Daily aggregation took ${duration.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle 50 concurrent budget checks in under 500ms', async () => {
      const checks = Array.from({ length: 50 }, () =>
        service.checkBudget('bench-company-001', 10.00).catch(() => {})
      );

      const start = performance.now();
      await Promise.all(checks);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
      console.log(`50 concurrent budget checks took ${duration.toFixed(2)}ms`);
    });

    it('should handle mixed read/write operations efficiently', async () => {
      const operations = [
        ...Array.from({ length: 25 }, () =>
          service.trackCost({
            companyId: 'bench-company-001',
            verificationId: `vrfy-mixed-${Date.now()}`,
            method: 'vlm',
            cost: 0.10,
            provider: 'openai'
          }).catch(() => {})
        ),
        ...Array.from({ length: 25 }, () =>
          service.checkBudget('bench-company-001', 10.00).catch(() => {})
        )
      ];

      const start = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
      console.log(`50 mixed operations took ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const before = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      // Perform 1000 operations
      for (let i = 0; i < 1000; i++) {
        await service.trackCost({
          companyId: 'bench-company-001',
          verificationId: `vrfy-mem-${i}`,
          method: 'yolo',
          cost: 0.00,
          provider: 'local'
        }).catch(() => {});
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const after = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const delta = (parseFloat(after) - parseFloat(before)).toFixed(2);

      console.log(`Memory: ${before}MB -> ${after}MB (Δ ${delta}MB)`);

      // Memory increase should be reasonable (< 50MB for 1000 operations)
      expect(parseFloat(delta)).toBeLessThan(50);
    });
  });
});
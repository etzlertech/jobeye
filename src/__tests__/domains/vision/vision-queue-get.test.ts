/**
 * @file __tests__/domains/vision/contract/vision-queue-get.test.ts
 * @phase 3.3
 * @domain Vision
 * @purpose Contract test for GET /api/vision/queue (offline sync status)
 * @complexity_budget 200
 * @test_coverage 100%
 */

import { describe, it, expect } from '@jest/globals';
import type { OfflineQueueStatus } from '@/domains/vision/lib/vision-types';

describe('GET /api/vision/queue - Contract Tests', () => {
  const QUEUE_ENDPOINT = '/api/vision/queue';

  it('should return OfflineQueueStatus schema', async () => {
    const response = await fetch(QUEUE_ENDPOINT);
    expect(response.status).toBe(200);

    const data: OfflineQueueStatus = await response.json();
    expect(data).toHaveProperty('queuedCount');
    expect(data).toHaveProperty('syncingCount');
    expect(data).toHaveProperty('failedCount');
    expect(data).toHaveProperty('storageUsedMb');
    expect(data).toHaveProperty('capacityMb');
    expect(data.capacityMb).toBeGreaterThanOrEqual(50); // 50 photo capacity per spec
  });

  it('should indicate when queue is full', async () => {
    const response = await fetch(QUEUE_ENDPOINT);
    const data: OfflineQueueStatus = await response.json();

    if (data.queuedCount >= 50) {
      expect(data.storageUsedMb).toBeCloseTo(data.capacityMb, 1);
    }
  });
});
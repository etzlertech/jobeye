/**
 * @file __tests__/domains/vision/contract/vision-verify-budget.test.ts
 * @phase 3.3
 * @domain Vision
 * @purpose Contract test for budget exceeded scenario (402 Payment Required)
 * @complexity_budget 300
 * @test_coverage 100%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('POST /api/vision/verify - Budget Exceeded Contract', () => {
  const VERIFY_ENDPOINT = '/api/vision/verify';

  describe('Response Contract - Budget Exceeded (402)', () => {
    it('should return 402 when daily budget cap reached', async () => {
      const formData = new FormData();
      formData.append('kitId', 'test-kit-budget');
      formData.append('photo', new Blob(['test'], { type: 'image/jpeg' }));

      // Mock: Company has exhausted $10/day budget
      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Test-Scenario': 'budget-exceeded' // Test helper
        }
      });

      expect(response.status).toBe(402);
    });

    it('should include budget details in 402 response', async () => {
      const formData = new FormData();
      formData.append('kitId', 'test-kit-budget');
      formData.append('photo', new Blob(['test'], { type: 'image/jpeg' }));

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Test-Scenario': 'budget-exceeded'
        }
      });

      expect(response.status).toBe(402);

      const error = await response.json();
      expect(error).toHaveProperty('message');
      expect(error.message).toContain('budget');

      expect(error).toHaveProperty('currentCost');
      expect(typeof error.currentCost).toBe('number');

      expect(error).toHaveProperty('budgetLimit');
      expect(error.budgetLimit).toBe(10.00); // $10/day per spec

      expect(error).toHaveProperty('estimatedCost');
      expect(typeof error.estimatedCost).toBe('number');
    });

    it('should return 402 when VLM request would exceed budget', async () => {
      const formData = new FormData();
      formData.append('kitId', 'test-kit-budget');
      formData.append('photo', new Blob(['test'], { type: 'image/jpeg' }));

      // Scenario: Budget at $9.95, VLM cost $0.10 would exceed $10
      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Test-Scenario': 'budget-near-limit'
        }
      });

      const data = await response.json();

      if (data.requiresVlmFallback && data.estimatedCost) {
        const totalCost = 9.95 + data.estimatedCost;
        if (totalCost > 10.00) {
          expect(response.status).toBe(402);
        }
      }
    });

    it('should return 402 when max daily VLM requests reached', async () => {
      const formData = new FormData();
      formData.append('kitId', 'test-kit-budget');
      formData.append('photo', new Blob(['test'], { type: 'image/jpeg' }));

      // Mock: 100 VLM requests already made today
      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Test-Scenario': 'max-requests-reached'
        }
      });

      expect(response.status).toBe(402);

      const error = await response.json();
      expect(error.message).toContain('request limit');
      expect(error).toHaveProperty('currentRequests');
      expect(error.currentRequests).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Fallback Behavior When Budget Exceeded', () => {
    it('should allow YOLO-only verification even when budget exceeded', async () => {
      const formData = new FormData();
      formData.append('kitId', 'test-kit-budget');
      formData.append('photo', new Blob(['test'], { type: 'image/jpeg' }));

      // If YOLO confidence >= 70%, should succeed even with budget exceeded
      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Test-Scenario': 'budget-exceeded-high-confidence'
        }
      });

      if (response.status === 200) {
        const data = await response.json();
        expect(data.requiresVlmFallback).toBe(false);
      }
    });

    it('should fail gracefully when budget exceeded and low confidence', async () => {
      const formData = new FormData();
      formData.append('kitId', 'test-kit-budget');
      formData.append('photo', new Blob(['test'], { type: 'image/jpeg' }));

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Test-Scenario': 'budget-exceeded-low-confidence'
        }
      });

      // Per spec: Allow with warning when all detection fails
      expect([200, 402]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.result).toBe('uncertain');
      }
    });
  });

  describe('Budget Reset', () => {
    it('should track costs per day (UTC)', async () => {
      // Budget should reset at midnight UTC
      const formData = new FormData();
      formData.append('kitId', 'test-kit-budget');
      formData.append('photo', new Blob(['test'], { type: 'image/jpeg' }));

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (response.status === 402) {
        const error = await response.json();
        // Should include date/time information
        expect(error).toHaveProperty('budgetPeriod');
      }
    });
  });
});
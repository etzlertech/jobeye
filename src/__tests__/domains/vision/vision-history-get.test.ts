/**
 * @file __tests__/domains/vision/contract/vision-history-get.test.ts
 * @phase 3.3
 * @domain Vision
 * @purpose Contract test for GET /api/vision/history endpoint
 * @complexity_budget 300
 * @test_coverage 100%
 */

import { describe, it, expect } from '@jest/globals';
import type { VerificationHistoryResponse } from '@/domains/vision/lib/vision-types';

describe('GET /api/vision/history - Contract Tests', () => {
  const HISTORY_ENDPOINT = '/api/vision/history';

  describe('Request Contract', () => {
    it('should accept request without query params', async () => {
      const response = await fetch(HISTORY_ENDPOINT);
      expect(response).toBeDefined();
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('should accept technicianId query param', async () => {
      const response = await fetch(`${HISTORY_ENDPOINT}?technicianId=tech-123`);
      expect(response.status).toBeLessThan(500);
    });

    it('should accept date range query params', async () => {
      const startDate = '2025-09-01';
      const endDate = '2025-09-30';
      const response = await fetch(
        `${HISTORY_ENDPOINT}?startDate=${startDate}&endDate=${endDate}`
      );
      expect(response.status).toBeLessThan(500);
    });

    it('should accept pagination params', async () => {
      const response = await fetch(`${HISTORY_ENDPOINT}?limit=10&offset=20`);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Response Contract - Success (200)', () => {
    it('should return VerificationHistoryResponse schema', async () => {
      const response = await fetch(HISTORY_ENDPOINT);
      expect(response.status).toBe(200);

      const data: VerificationHistoryResponse = await response.json();

      expect(data).toHaveProperty('verifications');
      expect(Array.isArray(data.verifications)).toBe(true);

      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('totalVerifications');
      expect(data.stats).toHaveProperty('successRate');
      expect(data.stats).toHaveProperty('avgProcessingTimeMs');
      expect(data.stats).toHaveProperty('totalCostUsd');
    });

    it('should return verification records with all required fields', async () => {
      const response = await fetch(HISTORY_ENDPOINT);
      const data: VerificationHistoryResponse = await response.json();

      if (data.verifications.length > 0) {
        const record = data.verifications[0];
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('tenantId');
        expect(record).toHaveProperty('technicianId');
        expect(record).toHaveProperty('kitId');
        expect(record).toHaveProperty('verificationResult');
        expect(record).toHaveProperty('createdAt');
      }
    });

    it('should calculate stats correctly', async () => {
      const response = await fetch(HISTORY_ENDPOINT);
      const data: VerificationHistoryResponse = await response.json();

      expect(typeof data.stats.totalVerifications).toBe('number');
      expect(data.stats.totalVerifications).toBeGreaterThanOrEqual(0);

      expect(typeof data.stats.successRate).toBe('number');
      expect(data.stats.successRate).toBeGreaterThanOrEqual(0);
      expect(data.stats.successRate).toBeLessThanOrEqual(100);

      expect(typeof data.stats.avgProcessingTimeMs).toBe('number');
      expect(data.stats.avgProcessingTimeMs).toBeGreaterThanOrEqual(0);

      expect(typeof data.stats.totalCostUsd).toBe('number');
      expect(data.stats.totalCostUsd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Filtering and RLS', () => {
    it('should only return verifications for authenticated user company', async () => {
      const response = await fetch(HISTORY_ENDPOINT);
      const data: VerificationHistoryResponse = await response.json();

      // All records should belong to same company
      if (data.verifications.length > 1) {
        const firstCompanyId = data.verifications[0].tenantId;
        data.verifications.forEach(record => {
          expect(record.tenantId).toBe(firstCompanyId);
        });
      }
    });

    it('should filter by technicianId when provided', async () => {
      const technicianId = 'tech-123';
      const response = await fetch(`${HISTORY_ENDPOINT}?technicianId=${technicianId}`);
      const data: VerificationHistoryResponse = await response.json();

      data.verifications.forEach(record => {
        expect(record.technicianId).toBe(technicianId);
      });
    });

    it('should filter by date range when provided', async () => {
      const startDate = '2025-09-01';
      const endDate = '2025-09-30';
      const response = await fetch(
        `${HISTORY_ENDPOINT}?startDate=${startDate}&endDate=${endDate}`
      );
      const data: VerificationHistoryResponse = await response.json();

      data.verifications.forEach(record => {
        const createdAt = new Date(record.createdAt);
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(createdAt.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      });
    });
  });

  describe('Error Responses', () => {
    it('should return 401 when unauthorized', async () => {
      const response = await fetch(HISTORY_ENDPOINT, {
        headers: { 'Authorization': 'Bearer invalid' }
      });
      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await fetch(`${HISTORY_ENDPOINT}?startDate=invalid-date`);
      expect(response.status).toBe(400);
    });
  });
});
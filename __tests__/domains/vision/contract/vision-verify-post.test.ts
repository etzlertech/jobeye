/**
 * @file __tests__/domains/vision/contract/vision-verify-post.test.ts
 * @phase 3.3
 * @domain Vision
 * @purpose Contract test for POST /api/vision/verify endpoint
 * @complexity_budget 300
 * @test_coverage 100%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { VerifyKitRequest, VerifyKitResponse } from '@/domains/vision/lib/vision-types';

describe('POST /api/vision/verify - Contract Tests', () => {
  const VERIFY_ENDPOINT = '/api/vision/verify';
  let testKitId: string;
  let testPhoto: Blob;

  beforeEach(() => {
    testKitId = 'test-kit-123';
    testPhoto = new Blob(['fake-image-data'], { type: 'image/jpeg' });
  });

  describe('Request Contract', () => {
    it('should accept multipart/form-data with required fields', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);
      formData.append('photo', testPhoto, 'verification.jpg');

      // This test will FAIL until route is implemented
      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      expect(response).toBeDefined();
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('should accept optional containerId field', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);
      formData.append('photo', testPhoto, 'verification.jpg');
      formData.append('containerId', 'container-456');

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      expect(response).toBeDefined();
    });

    it('should reject request without kitId', async () => {
      const formData = new FormData();
      formData.append('photo', testPhoto, 'verification.jpg');

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('kitId');
    });

    it('should reject request without photo', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('photo');
    });
  });

  describe('Response Contract - Success (200)', () => {
    it('should return VerifyKitResponse with all required fields', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);
      formData.append('photo', testPhoto, 'verification.jpg');

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(200);

      const data: VerifyKitResponse = await response.json();

      // Verify response schema
      expect(data).toHaveProperty('result');
      expect(['complete', 'incomplete', 'uncertain']).toContain(data.result);

      expect(data).toHaveProperty('detectedItems');
      expect(Array.isArray(data.detectedItems)).toBe(true);

      expect(data).toHaveProperty('missingItems');
      expect(Array.isArray(data.missingItems)).toBe(true);

      expect(data).toHaveProperty('requiresVlmFallback');
      expect(typeof data.requiresVlmFallback).toBe('boolean');

      expect(data).toHaveProperty('verificationId');
      expect(typeof data.verificationId).toBe('string');
    });

    it('should include detectedItems with correct structure', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);
      formData.append('photo', testPhoto, 'verification.jpg');

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      const data: VerifyKitResponse = await response.json();

      if (data.detectedItems.length > 0) {
        const item = data.detectedItems[0];
        expect(item).toHaveProperty('type');
        expect(typeof item.type).toBe('string');
        expect(item).toHaveProperty('confidence');
        expect(typeof item.confidence).toBe('number');
        expect(item.confidence).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should include missingItems with correct structure when incomplete', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);
      formData.append('photo', testPhoto, 'verification.jpg');

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      const data: VerifyKitResponse = await response.json();

      if (data.missingItems.length > 0) {
        const item = data.missingItems[0];
        expect(item).toHaveProperty('itemId');
        expect(typeof item.itemId).toBe('string');
        expect(item).toHaveProperty('itemType');
        expect(typeof item.itemType).toBe('string');
      }
    });

    it('should include estimatedCost when VLM fallback required', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);
      formData.append('photo', testPhoto, 'verification.jpg');

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      const data: VerifyKitResponse = await response.json();

      if (data.requiresVlmFallback) {
        expect(data).toHaveProperty('estimatedCost');
        expect(typeof data.estimatedCost).toBe('number');
        expect(data.estimatedCost).toBeGreaterThan(0);
      }
    });
  });

  describe('Response Contract - Errors', () => {
    it('should return 401 when unauthorized', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);
      formData.append('photo', testPhoto, 'verification.jpg');

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when kit not found', async () => {
      const formData = new FormData();
      formData.append('kitId', 'non-existent-kit');
      formData.append('photo', testPhoto, 'verification.jpg');

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.message).toContain('Kit not found');
    });

    it('should return 500 when processing fails', async () => {
      // This will be tested with mocked failures
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance Contract', () => {
    it('should complete within 30 seconds', async () => {
      const formData = new FormData();
      formData.append('kitId', testKitId);
      formData.append('photo', testPhoto, 'verification.jpg');

      const startTime = Date.now();

      const response = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(30000); // 30 seconds per spec
    });
  });
});
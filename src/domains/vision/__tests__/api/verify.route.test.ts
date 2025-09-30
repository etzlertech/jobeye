/**
 * @file /src/domains/vision/__tests__/api/verify.route.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API tests for vision verification endpoint
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/vision/verify/route';
import { getVisionVerificationService } from '@/domains/vision/services/vision-verification.service';

// Mock the service
jest.mock('@/domains/vision/services/vision-verification.service');

describe('POST /api/vision/verify', () => {
  const mockVerifyKit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getVisionVerificationService as jest.Mock).mockReturnValue({
      verifyKit: mockVerifyKit
    });
  });

  it('should return 401 without authorization', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {}
    });

    const response = await POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 for missing required fields', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: { kitId: 'kit-123' }
    });

    const response = await POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should successfully verify kit', async () => {
    mockVerifyKit.mockResolvedValue({
      data: {
        verificationId: 'verify-123',
        verificationResult: 'complete',
        processingMethod: 'local_yolo',
        confidenceScore: 0.95,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.95, matchStatus: 'matched' }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 250
      },
      error: null
    });

    const { req } = createMocks({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: {
        kitId: 'kit-123',
        companyId: 'company-456',
        imageData: 'base64-image-data',
        expectedItems: ['wrench', 'hammer']
      }
    });

    const response = await POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.verificationId).toBe('verify-123');
    expect(data.data.verificationResult).toBe('complete');
  });

  it('should handle budget exceeded error', async () => {
    mockVerifyKit.mockResolvedValue({
      data: null,
      error: {
        code: 'BUDGET_EXCEEDED',
        message: 'Daily budget limit reached',
        details: {}
      }
    });

    const { req } = createMocks({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: {
        kitId: 'kit-123',
        companyId: 'company-456',
        imageData: 'base64-image-data',
        expectedItems: ['wrench']
      }
    });

    const response = await POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Daily budget limit reached');
    expect(data.code).toBe('BUDGET_EXCEEDED');
  });
});
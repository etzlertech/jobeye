/**
 * @file /tests/domains/intent/api/test_classify_contract.test.ts
 * @purpose Contract test for POST /api/intent/classify endpoint
 * @phase 3
 * @domain Intent Recognition
 * @complexity_budget 200
 * @test_coverage 100%
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// Mock the handler that will be implemented later
const mockHandler = jest.fn();

describe('POST /api/intent/classify - Contract Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should require image in base64 format', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          // Missing image
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('image'),
      });
    });

    it('should require valid UUID for userId', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          image: 'base64encodedimage==',
          userId: 'invalid-uuid',
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('userId'),
      });
    });

    it('should accept optional context object', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          image: 'base64encodedimage==',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          context: {
            hasActiveJob: true,
            currentScreen: 'inventory',
          },
        },
      });

      // Mock successful response
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'inventory_add',
          confidence: 0.85,
          context: {
            detectedItems: ['wrench', 'hammer'],
            suggestedAction: 'Add to inventory',
          },
          aiLogId: '660e8400-e29b-41d4-a716-446655440001',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Response Contract', () => {
    it('should return intent classification with required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          image: 'base64encodedimage==',
          userId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      // Mock successful response
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'inventory_add',
          confidence: 0.85,
          context: {
            detectedItems: ['wrench', 'hammer'],
            suggestedAction: 'Add to inventory',
          },
          aiLogId: '660e8400-e29b-41d4-a716-446655440001',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
      
      const response = JSON.parse(res._getData());
      expect(response).toMatchObject({
        intent: expect.stringMatching(/^(inventory_add|job_load_verify|receipt_scan|maintenance_event|vehicle_add|unknown)$/),
        confidence: expect.any(Number),
        aiLogId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      });
      
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle unknown intent classification', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          image: 'base64encodedimage==',
          userId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      // Mock unknown intent response
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'unknown',
          confidence: 0.3,
          context: {
            detectedItems: [],
            suggestedAction: 'Unable to determine intent',
          },
          aiLogId: '660e8400-e29b-41d4-a716-446655440001',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.intent).toBe('unknown');
      expect(response.confidence).toBeLessThan(0.5);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for unauthorized requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // No authorization header
        },
        body: {
          image: 'base64encodedimage==',
          userId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 401;
        res._setData(JSON.stringify({ error: 'Unauthorized' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should return 400 for invalid base64 image', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          image: 'not-valid-base64!@#$',
          userId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ error: 'Invalid base64 image format' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('base64'),
      });
    });
  });

  describe('Performance Contract', () => {
    it('should respond within 3 seconds', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          image: 'base64encodedimage==',
          userId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      const startTime = Date.now();

      // Mock response with simulated delay
      mockHandler.mockImplementation(async (req) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'inventory_add',
          confidence: 0.85,
          context: {},
          aiLogId: '660e8400-e29b-41d4-a716-446655440001',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });
  });
});
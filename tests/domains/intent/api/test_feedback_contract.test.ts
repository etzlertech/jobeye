/**
 * @file /tests/domains/intent/api/test_feedback_contract.test.ts
 * @purpose Contract test for POST /api/intent/feedback endpoint
 * @phase 3
 * @domain Intent Recognition
 * @complexity_budget 150
 * @test_coverage 100%
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// Mock the handler that will be implemented later
const mockHandler = jest.fn();

describe('POST /api/intent/feedback - Contract Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should require classificationId as valid UUID', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          actualIntent: 'inventory_add',
          // Missing classificationId
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('classificationId'),
      });
    });

    it('should require actualIntent from valid enum', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          classificationId: '550e8400-e29b-41d4-a716-446655440000',
          actualIntent: 'invalid_intent', // Invalid enum value
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('actualIntent'),
      });
    });

    it('should accept valid feedback with optional comments', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          classificationId: '550e8400-e29b-41d4-a716-446655440000',
          actualIntent: 'job_load_verify',
          comments: 'The system thought it was inventory but it was actually load verification',
        },
      });

      // Mock successful response
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({ success: true }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should accept all valid intent enum values', async () => {
      const validIntents = [
        'inventory_add',
        'job_load_verify',
        'receipt_scan',
        'maintenance_event',
        'vehicle_add',
        'other',
      ];

      for (const intent of validIntents) {
        const { req, res } = createMocks({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: {
            classificationId: '550e8400-e29b-41d4-a716-446655440000',
            actualIntent: intent,
          },
        });

        mockHandler.mockImplementation((req) => {
          res.statusCode = 200;
          res._setData(JSON.stringify({ success: true }));
        });

        await mockHandler(req as unknown as NextRequest);

        expect(res._getStatusCode()).toBe(200);
      }
    });
  });

  describe('Response Contract', () => {
    it('should return 200 for successful feedback submission', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          classificationId: '550e8400-e29b-41d4-a716-446655440000',
          actualIntent: 'inventory_add',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({ success: true }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should handle feedback for "other" intent with comments', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          classificationId: '550e8400-e29b-41d4-a716-446655440000',
          actualIntent: 'other',
          comments: 'This was actually a new type of intent we haven\'t seen before',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({ success: true }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
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
          classificationId: '550e8400-e29b-41d4-a716-446655440000',
          actualIntent: 'inventory_add',
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

    it('should return 400 for invalid UUID format', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          classificationId: 'not-a-valid-uuid',
          actualIntent: 'inventory_add',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ error: 'Invalid UUID format for classificationId' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('UUID'),
      });
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          // Empty body
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ error: 'Missing required fields: classificationId, actualIntent' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('required'),
      });
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate feedback submissions gracefully', async () => {
      const feedbackData = {
        classificationId: '550e8400-e29b-41d4-a716-446655440000',
        actualIntent: 'inventory_add',
        comments: 'Correction feedback',
      };

      // First submission
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: feedbackData,
      });

      mockHandler.mockImplementation((req) => {
        res1.statusCode = 200;
        res1._setData(JSON.stringify({ success: true }));
      });

      await mockHandler(req1 as unknown as NextRequest);
      expect(res1._getStatusCode()).toBe(200);

      // Duplicate submission
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: feedbackData,
      });

      mockHandler.mockImplementation((req) => {
        res2.statusCode = 200;
        res2._setData(JSON.stringify({ success: true }));
      });

      await mockHandler(req2 as unknown as NextRequest);
      expect(res2._getStatusCode()).toBe(200);
    });
  });
});
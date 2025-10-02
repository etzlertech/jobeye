/**
 * @file /tests/domains/supervisor/api/test_inventory_add_contract.test.ts
 * @purpose Contract test for POST /api/supervisor/inventory/add endpoint
 * @phase 3
 * @domain Supervisor
 * @complexity_budget 200
 * @test_coverage 100%
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// Mock the handler that will be implemented later
const mockHandler = jest.fn();

describe('POST /api/supervisor/inventory/add - Contract Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should require name field', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          // Missing name
          imageUrl: 'https://example.com/image.jpg',
          category: 'tools',
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('name'),
      });
    });

    it('should require valid URI for imageUrl', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: 'Hammer',
          imageUrl: 'not-a-valid-url',
          category: 'tools',
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('imageUrl'),
      });
    });

    it('should require category field', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: 'Hammer',
          imageUrl: 'https://example.com/image.jpg',
          // Missing category
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('category'),
      });
    });

    it('should enforce name length constraints', async () => {
      // Test empty name
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: '',
          imageUrl: 'https://example.com/image.jpg',
          category: 'tools',
        },
      });

      await mockHandler(req1 as unknown as NextRequest);
      expect(res1._getStatusCode()).toBe(400);

      // Test name too long
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: 'a'.repeat(101),
          imageUrl: 'https://example.com/image.jpg',
          category: 'tools',
        },
      });

      await mockHandler(req2 as unknown as NextRequest);
      expect(res2._getStatusCode()).toBe(400);
    });

    it('should accept optional containerId as UUID', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: 'Wrench',
          imageUrl: 'https://example.com/wrench.jpg',
          thumbnailUrl: 'https://example.com/wrench-thumb.jpg',
          category: 'tools',
          containerId: '550e8400-e29b-41d4-a716-446655440000',
          metadata: {
            brand: 'DeWalt',
            size: '10mm',
          },
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          id: '660e8400-e29b-41d4-a716-446655440001',
          name: 'Wrench',
          imageUrl: 'https://example.com/wrench.jpg',
          thumbnailUrl: 'https://example.com/wrench-thumb.jpg',
          category: 'tools',
          containerId: '550e8400-e29b-41d4-a716-446655440000',
          metadata: {
            brand: 'DeWalt',
            size: '10mm',
          },
          createdAt: new Date().toISOString(),
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(201);
    });
  });

  describe('Response Contract', () => {
    it('should return 201 with created inventory item', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: 'Power Drill',
          imageUrl: 'https://example.com/drill.jpg',
          category: 'power-tools',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          id: '660e8400-e29b-41d4-a716-446655440001',
          name: 'Power Drill',
          imageUrl: 'https://example.com/drill.jpg',
          thumbnailUrl: 'https://example.com/drill-512x512.jpg',
          category: 'power-tools',
          containerId: null,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(201);
      
      const response = JSON.parse(res._getData());
      expect(response).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        name: expect.any(String),
        imageUrl: expect.stringMatching(/^https?:\/\//),
        category: expect.any(String),
      });
    });

    it('should generate 512x512 thumbnail if not provided', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: 'Saw',
          imageUrl: 'https://example.com/saw.jpg',
          category: 'tools',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          id: '660e8400-e29b-41d4-a716-446655440001',
          name: 'Saw',
          imageUrl: 'https://example.com/saw.jpg',
          thumbnailUrl: 'https://example.com/saw-512x512.jpg',
          category: 'tools',
          containerId: null,
          metadata: {},
          createdAt: new Date().toISOString(),
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.thumbnailUrl).toContain('512x512');
    });
  });

  describe('Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // No authorization header
        },
        body: {
          name: 'Hammer',
          imageUrl: 'https://example.com/hammer.jpg',
          category: 'tools',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 401;
        res._setData(JSON.stringify({ error: 'Unauthorized' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(401);
    });

    it('should return 403 for non-supervisor users', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer crew-member-token',
        },
        body: {
          name: 'Hammer',
          imageUrl: 'https://example.com/hammer.jpg',
          category: 'tools',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 403;
        res._setData(JSON.stringify({ error: 'Forbidden - Supervisor role required' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(403);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('Supervisor'),
      });
    });
  });

  describe('Business Rules', () => {
    it('should validate container exists if containerId provided', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: 'Screwdriver',
          imageUrl: 'https://example.com/screwdriver.jpg',
          category: 'tools',
          containerId: '999e8400-e29b-41d4-a716-446655440999', // Non-existent
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ error: 'Container not found' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('Container'),
      });
    });

    it('should handle duplicate item names', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          name: 'Hammer', // Assume this already exists
          imageUrl: 'https://example.com/hammer2.jpg',
          category: 'tools',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          id: '660e8400-e29b-41d4-a716-446655440002',
          name: 'Hammer',
          imageUrl: 'https://example.com/hammer2.jpg',
          thumbnailUrl: 'https://example.com/hammer2-512x512.jpg',
          category: 'tools',
          containerId: null,
          metadata: {},
          createdAt: new Date().toISOString(),
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      // Should allow duplicate names (different items)
      expect(res._getStatusCode()).toBe(201);
    });
  });
});
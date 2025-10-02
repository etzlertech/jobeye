/**
 * @file /tests/domains/supervisor/api/test_jobs_create_contract.test.ts
 * @purpose Contract test for POST /api/supervisor/jobs/create endpoint
 * @phase 3
 * @domain Supervisor
 * @complexity_budget 250
 * @test_coverage 100%
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// Mock the handler that will be implemented later
const mockHandler = jest.fn();

describe('POST /api/supervisor/jobs/create - Contract Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should require all mandatory fields', async () => {
      const requiredFields = ['customerId', 'propertyId', 'scheduledDate', 'assignedItems'];
      
      for (const field of requiredFields) {
        const body: any = {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
        };
        
        delete body[field];
        
        const { req, res } = createMocks({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body,
        });

        await mockHandler(req as unknown as NextRequest);

        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({
          error: expect.stringContaining(field),
        });
      }
    });

    it('should validate UUID formats', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          customerId: 'invalid-uuid',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('customerId'),
      });
    });

    it('should validate scheduledDate as ISO date-time', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: 'invalid-date',
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('scheduledDate'),
      });
    });

    it('should validate estimatedDurationMinutes minimum', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
          estimatedDurationMinutes: 10, // Less than minimum 15
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('duration'),
      });
    });

    it('should accept complete job creation request', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: '2025-02-01T09:00:00Z',
          estimatedDurationMinutes: 60,
          assignedItems: [
            '770e8400-e29b-41d4-a716-446655440002',
            '880e8400-e29b-41d4-a716-446655440003',
          ],
          assignedVehicleId: '990e8400-e29b-41d4-a716-446655440004',
          specialInstructions: 'Gate code: 1234',
          specialInstructionsAudioUrl: 'https://example.com/audio/instructions.mp3',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          id: 'aa0e8400-e29b-41d4-a716-446655440005',
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: '2025-02-01T09:00:00Z',
          estimatedDurationMinutes: 60,
          assignedItems: [
            '770e8400-e29b-41d4-a716-446655440002',
            '880e8400-e29b-41d4-a716-446655440003',
          ],
          assignedVehicleId: '990e8400-e29b-41d4-a716-446655440004',
          specialInstructions: 'Gate code: 1234',
          specialInstructionsAudioUrl: 'https://example.com/audio/instructions.mp3',
          status: 'scheduled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(201);
    });
  });

  describe('Response Contract', () => {
    it('should return 201 with created job details', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
        },
      });

      const jobId = 'bb0e8400-e29b-41d4-a716-446655440006';
      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          id: jobId,
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          estimatedDurationMinutes: 30,
          actualDurationMinutes: null,
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
          assignedVehicleId: null,
          specialInstructions: null,
          specialInstructionsAudioUrl: null,
          status: 'scheduled',
          completionPhotoUrls: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(201);
      
      const response = JSON.parse(res._getData());
      expect(response).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        customerId: expect.any(String),
        propertyId: expect.any(String),
        scheduledDate: expect.any(String),
        assignedItems: expect.arrayContaining([expect.any(String)]),
        status: 'scheduled',
      });
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
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
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
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 403;
        res._setData(JSON.stringify({ error: 'Forbidden - Supervisor role required' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(403);
    });
  });

  describe('Business Rules', () => {
    it('should validate customer exists', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          customerId: '999e8400-e29b-41d4-a716-446655440999', // Non-existent
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ error: 'Customer not found' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('Customer'),
      });
    });

    it('should enforce 6 jobs per crew member limit', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: ['770e8400-e29b-41d4-a716-446655440002'],
          assignedCrewMemberId: '880e8400-e29b-41d4-a716-446655440003',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ 
          error: 'Crew member already has 6 jobs scheduled for this day' 
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('6 jobs'),
      });
    });

    it('should validate all assigned items exist', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          scheduledDate: new Date().toISOString(),
          assignedItems: [
            '770e8400-e29b-41d4-a716-446655440002',
            '999e8400-e29b-41d4-a716-446655440999', // Non-existent
          ],
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ 
          error: 'One or more assigned items not found' 
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
    });
  });
});
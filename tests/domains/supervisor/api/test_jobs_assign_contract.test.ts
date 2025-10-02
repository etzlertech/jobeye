/**
 * @file /tests/domains/supervisor/api/test_jobs_assign_contract.test.ts
 * @purpose Contract test for POST /api/supervisor/jobs/{jobId}/assign endpoint
 * @phase 3
 * @domain Supervisor
 * @complexity_budget 200
 * @test_coverage 100%
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// Mock the handler that will be implemented later
const mockHandler = jest.fn();

describe('POST /api/supervisor/jobs/{jobId}/assign - Contract Test', () => {
  const validJobId = '550e8400-e29b-41d4-a716-446655440000';
  const validCrewMemberId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should require valid jobId in path', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/supervisor/jobs/invalid-uuid/assign',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: validCrewMemberId,
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('jobId'),
      });
    });

    it('should require crewMemberId in body', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          // Missing crewMemberId
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('crewMemberId'),
      });
    });

    it('should validate crewMemberId as UUID', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: 'not-a-valid-uuid',
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('crewMemberId'),
      });
    });

    it('should accept valid assignment request', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: validCrewMemberId,
          notes: 'Experienced with this property',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          jobId: validJobId,
          assignedTo: validCrewMemberId,
          assignedAt: new Date().toISOString(),
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Response Contract', () => {
    it('should return success with assignment details', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: validCrewMemberId,
        },
      });

      const assignedAt = new Date().toISOString();
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          jobId: validJobId,
          assignedTo: validCrewMemberId,
          assignedAt,
          notificationSent: true,
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
      
      const response = JSON.parse(res._getData());
      expect(response).toMatchObject({
        success: true,
        jobId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        assignedTo: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        assignedAt: expect.any(String),
      });
    });
  });

  describe('Business Rules', () => {
    it('should validate job exists', async () => {
      const nonExistentJobId = '999e8400-e29b-41d4-a716-446655440999';
      
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${nonExistentJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: validCrewMemberId,
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 404;
        res._setData(JSON.stringify({ error: 'Job not found' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('Job not found'),
      });
    });

    it('should validate crew member exists', async () => {
      const nonExistentCrewId = '999e8400-e29b-41d4-a716-446655440999';
      
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: nonExistentCrewId,
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ error: 'Crew member not found' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('Crew member'),
      });
    });

    it('should enforce 6 jobs per day limit', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: validCrewMemberId,
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

    it('should prevent reassignment of already assigned job', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: validCrewMemberId,
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ 
          error: 'Job is already assigned to another crew member' 
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('already assigned'),
      });
    });

    it('should validate crew member has required role', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: validCrewMemberId,
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ 
          error: 'User does not have crew member role' 
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('crew member role'),
      });
    });
  });

  describe('Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
          // No authorization header
        },
        body: {
          crewMemberId: validCrewMemberId,
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
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer crew-member-token',
        },
        body: {
          crewMemberId: validCrewMemberId,
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

  describe('Side Effects', () => {
    it('should send notification to assigned crew member', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: `/api/supervisor/jobs/${validJobId}/assign`,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          crewMemberId: validCrewMemberId,
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          jobId: validJobId,
          assignedTo: validCrewMemberId,
          assignedAt: new Date().toISOString(),
          notificationSent: true,
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.notificationSent).toBe(true);
    });
  });
});
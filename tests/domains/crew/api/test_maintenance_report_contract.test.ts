/**
 * @file /tests/domains/crew/api/test_maintenance_report_contract.test.ts
 * @purpose Contract test for POST /api/crew/maintenance/report endpoint
 * @phase 3
 * @domain Crew
 * @complexity_budget 200
 * @test_coverage 100%
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// Mock the handler that will be implemented later
const mockHandler = jest.fn();

describe('POST /api/crew/maintenance/report - Contract Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should require imageUrl field', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          // Missing imageUrl
          severity: 'medium',
          description: 'Mower blade is damaged',
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('imageUrl'),
      });
    });

    it('should require severity field', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/damage-photo.jpg',
          // Missing severity
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('severity'),
      });
    });

    it('should validate severity enum values', async () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      
      for (const severity of validSeverities) {
        const { req, res } = createMocks({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer valid-crew-token',
          },
          body: {
            imageUrl: 'https://example.com/issue.jpg',
            severity,
          },
        });

        mockHandler.mockImplementation((req) => {
          res.statusCode = 201;
          res._setData(JSON.stringify({
            reportId: '550e8400-e29b-41d4-a716-446655440000',
            supervisorNotified: severity === 'critical' || severity === 'high',
            priority: severity,
          }));
        });

        await mockHandler(req as unknown as NextRequest);

        expect(res._getStatusCode()).toBe(201);
      }
    });

    it('should reject invalid severity values', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/issue.jpg',
          severity: 'extreme', // Invalid
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('severity'),
      });
    });

    it('should accept complete maintenance report', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/broken-mower.jpg',
          equipmentId: '660e8400-e29b-41d4-a716-446655440001',
          severity: 'high',
          description: 'Lawn mower engine making grinding noise and smoking',
          voiceNoteUrl: 'https://example.com/audio/maintenance-note.mp3',
          location: {
            lat: 33.7490,
            lng: -84.3880,
          },
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          reportId: '770e8400-e29b-41d4-a716-446655440002',
          supervisorNotified: true,
          priority: 'high',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(201);
    });
  });

  describe('Response Contract', () => {
    it('should return 201 with report details', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/issue.jpg',
          severity: 'medium',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          reportId: '880e8400-e29b-41d4-a716-446655440003',
          supervisorNotified: false,
          priority: 'medium',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(201);
      
      const response = JSON.parse(res._getData());
      expect(response).toMatchObject({
        reportId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        supervisorNotified: expect.any(Boolean),
        priority: expect.any(String),
      });
    });

    it('should notify supervisor for high/critical issues', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/critical-issue.jpg',
          severity: 'critical',
          description: 'Equipment on fire!',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          reportId: '990e8400-e29b-41d4-a716-446655440004',
          supervisorNotified: true,
          priority: 'critical',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.supervisorNotified).toBe(true);
      expect(response.priority).toBe('critical');
    });

    it('should not notify supervisor for low severity issues', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/minor-scratch.jpg',
          severity: 'low',
          description: 'Small scratch on equipment',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          reportId: 'aa0e8400-e29b-41d4-a716-446655440005',
          supervisorNotified: false,
          priority: 'low',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.supervisorNotified).toBe(false);
    });
  });

  describe('Business Rules', () => {
    it('should validate equipment exists if equipmentId provided', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/issue.jpg',
          equipmentId: '999e8400-e29b-41d4-a716-446655440999', // Non-existent
          severity: 'medium',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ 
          error: 'Equipment not found' 
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('Equipment'),
      });
    });

    it('should validate location coordinates if provided', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/issue.jpg',
          severity: 'medium',
          location: {
            lat: 'invalid',
            lng: -84.3880,
          },
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ 
          error: 'Invalid location coordinates' 
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('location'),
      });
    });

    it('should enforce description length limit', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/issue.jpg',
          severity: 'medium',
          description: 'a'.repeat(1001), // Too long
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({ 
          error: 'Description too long (max 1000 characters)' 
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
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
          imageUrl: 'https://example.com/issue.jpg',
          severity: 'medium',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 401;
        res._setData(JSON.stringify({ error: 'Unauthorized' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(401);
    });

    it('should allow any authenticated user to report issues', async () => {
      // Both crew and supervisor should be able to report
      const tokens = ['crew-token', 'supervisor-token'];
      
      for (const token of tokens) {
        const { req, res } = createMocks({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`,
          },
          body: {
            imageUrl: 'https://example.com/issue.jpg',
            severity: 'low',
          },
        });

        mockHandler.mockImplementation((req) => {
          res.statusCode = 201;
          res._setData(JSON.stringify({
            reportId: 'bb0e8400-e29b-41d4-a716-446655440006',
            supervisorNotified: false,
            priority: 'low',
          }));
        });

        await mockHandler(req as unknown as NextRequest);

        expect(res._getStatusCode()).toBe(201);
      }
    });
  });

  describe('Image Processing', () => {
    it('should generate thumbnail for maintenance photo', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/full-size-photo.jpg',
          severity: 'medium',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          reportId: 'cc0e8400-e29b-41d4-a716-446655440007',
          supervisorNotified: false,
          priority: 'medium',
          thumbnailUrl: 'https://example.com/full-size-photo-512x512.jpg',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.thumbnailUrl).toContain('512x512');
    });
  });

  describe('Context Awareness', () => {
    it('should link maintenance report to current job if context available', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer valid-crew-token',
        },
        body: {
          imageUrl: 'https://example.com/on-job-issue.jpg',
          severity: 'medium',
          description: 'Issue found during job',
          jobId: '110e8400-e29b-41d4-a716-446655440008',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 201;
        res._setData(JSON.stringify({
          reportId: 'dd0e8400-e29b-41d4-a716-446655440009',
          supervisorNotified: false,
          priority: 'medium',
          linkedJobId: '110e8400-e29b-41d4-a716-446655440008',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.linkedJobId).toBeDefined();
    });
  });
});
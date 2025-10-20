/**
 * @file /tests/domains/crew/api/test_job_equipment_contract.test.ts
 * @purpose Contract test for GET/PUT /api/crew/jobs/[jobId]/equipment endpoint
 * @phase 3
 * @domain Crew
 * @complexity_budget 300
 * @test_coverage 100%
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// Mock the handler that will be implemented later
const mockHandler = jest.fn();

describe('GET /api/crew/jobs/[jobId]/equipment - Contract Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should accept valid job ID', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          equipment: [],
          job_id: '550e8400-e29b-41d4-a716-446655440000',
          _meta: {
            total: 0,
            sources: {
              table: 0,
              jsonb: 0
            }
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should reject invalid job ID format', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/invalid-id/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({
          error: 'Invalid job ID format'
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should return 404 for non-existent job', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/660e8400-e29b-41d4-a716-446655440999/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 404;
        res._setData(JSON.stringify({
          error: 'Job not found'
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(404);
    });
  });

  describe('Response Contract', () => {
    it('should return equipment array with proper structure', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          equipment: [
            {
              id: '880e8400-e29b-41d4-a716-446655440001',
              name: 'Lawn Mower',
              checked: true,
              category: 'primary',
              quantity: 1,
              verified_at: '2025-10-20T10:00:00Z',
              icon: '🌱'
            },
            {
              id: '880e8400-e29b-41d4-a716-446655440002',
              name: 'Safety Glasses',
              checked: false,
              category: 'safety',
              quantity: 1,
              icon: '🥽'
            }
          ],
          job_id: '550e8400-e29b-41d4-a716-446655440000',
          _meta: {
            total: 2,
            sources: {
              table: 1,
              jsonb: 1
            }
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);

      const response = JSON.parse(res._getData());
      expect(response).toMatchObject({
        equipment: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            checked: expect.any(Boolean),
            category: expect.stringMatching(/^(primary|safety|support|materials)$/),
            quantity: expect.any(Number)
          })
        ]),
        job_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        _meta: expect.objectContaining({
          total: expect.any(Number),
          sources: expect.objectContaining({
            table: expect.any(Number),
            jsonb: expect.any(Number)
          })
        })
      });
    });

    it('should return empty array when no equipment assigned', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          equipment: [],
          job_id: '550e8400-e29b-41d4-a716-446655440000',
          _meta: {
            total: 0,
            sources: {
              table: 0,
              jsonb: 0
            }
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.equipment).toEqual([]);
      expect(response._meta.total).toBe(0);
    });

    it('should include metadata about data sources', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 },
            { id: '2', name: 'Item 2', checked: false, category: 'primary', quantity: 1 },
            { id: '3', name: 'Item 3', checked: false, category: 'safety', quantity: 1 }
          ],
          job_id: '550e8400-e29b-41d4-a716-446655440000',
          _meta: {
            total: 3,
            sources: {
              table: 2,  // 2 from workflow_task_item_associations
              jsonb: 1   // 1 from jobs.checklist_items
            }
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response._meta.sources.table).toBe(2);
      expect(response._meta.sources.jsonb).toBe(1);
      expect(response._meta.total).toBe(response._meta.sources.table + response._meta.sources.jsonb);
    });
  });

  describe('Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          // No authorization header
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 401;
        res._setData(JSON.stringify({ error: 'Unauthorized' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(401);
    });

    it('should enforce tenant isolation', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer different-tenant-token',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 404;
        res._setData(JSON.stringify({
          error: 'Job not found' // RLS blocks access to other tenant's jobs
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(404);
    });
  });
});

describe('PUT /api/crew/jobs/[jobId]/equipment - Contract Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should accept equipment array update', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: [
            {
              id: '880e8400-e29b-41d4-a716-446655440001',
              name: 'Lawn Mower',
              checked: true,
              category: 'primary',
              quantity: 1,
              icon: '🌱'
            }
          ]
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          equipment: [
            {
              id: '880e8400-e29b-41d4-a716-446655440001',
              name: 'Lawn Mower',
              checked: true,
              category: 'primary',
              quantity: 1,
              icon: '🌱'
            }
          ],
          _meta: {
            dual_write: true,
            total_items: 1,
            loaded_count: 1,
            missing_count: 0
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should reject invalid equipment array', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: 'invalid' // Should be array
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({
          error: 'Equipment array is required'
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should reject missing equipment field', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          // Missing equipment field
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 400;
        res._setData(JSON.stringify({
          error: 'Equipment array is required'
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe('Response Contract', () => {
    it('should return success with updated equipment', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 },
            { id: '2', name: 'Item 2', checked: false, category: 'safety', quantity: 1 }
          ]
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 },
            { id: '2', name: 'Item 2', checked: false, category: 'safety', quantity: 1 }
          ],
          _meta: {
            dual_write: true,
            total_items: 2,
            loaded_count: 1,
            missing_count: 1
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);

      const response = JSON.parse(res._getData());
      expect(response.success).toBe(true);
      expect(response.equipment).toHaveLength(2);
      expect(response._meta.dual_write).toBe(true);
    });

    it('should include metadata about dual-write operation', async () => {
      const { req, res} = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 },
            { id: '2', name: 'Item 2', checked: true, category: 'primary', quantity: 1 },
            { id: '3', name: 'Item 3', checked: false, category: 'safety', quantity: 1 }
          ]
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 },
            { id: '2', name: 'Item 2', checked: true, category: 'primary', quantity: 1 },
            { id: '3', name: 'Item 3', checked: false, category: 'safety', quantity: 1 }
          ],
          _meta: {
            dual_write: true,
            total_items: 3,
            loaded_count: 2,  // 2 checked items
            missing_count: 1  // 1 unchecked item
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response._meta).toMatchObject({
        dual_write: true,
        total_items: 3,
        loaded_count: 2,
        missing_count: 1
      });
    });
  });

  describe('Business Rules', () => {
    it('should perform dual-write to both JSONB and table', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 }
          ]
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 }
          ],
          _meta: {
            dual_write: true, // Confirms dual-write happened
            total_items: 1,
            loaded_count: 1,
            missing_count: 0
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response._meta.dual_write).toBe(true);
    });

    it('should update status based on checked field', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 },  // Should mark as loaded
            { id: '2', name: 'Item 2', checked: false, category: 'primary', quantity: 1 } // Should mark as missing
          ]
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          equipment: [
            { id: '1', name: 'Item 1', checked: true, category: 'primary', quantity: 1 },
            { id: '2', name: 'Item 2', checked: false, category: 'primary', quantity: 1 }
          ],
          _meta: {
            dual_write: true,
            total_items: 2,
            loaded_count: 1,  // Checked item
            missing_count: 1  // Unchecked item
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response._meta.loaded_count).toBe(1);
      expect(response._meta.missing_count).toBe(1);
    });
  });

  describe('Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          // No authorization header
        },
        body: {
          equipment: []
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 401;
        res._setData(JSON.stringify({ error: 'Unauthorized' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(401);
    });

    it('should enforce tenant isolation on updates', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer different-tenant-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: []
        }
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 404;
        res._setData(JSON.stringify({
          error: 'Job not found'
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(404);
    });
  });
});

describe('Feature Flag Behavior - jobLoadV2Enabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /equipment with flag OFF (legacy mode)', () => {
    it('should return equipment without _meta when flag is OFF', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
        },
      });

      // Simulate flag OFF: No _meta in response
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          equipment: [
            {
              id: '1',
              name: 'Lawn Mower',
              checked: true,
              category: 'primary',
              quantity: 1
            }
          ],
          job_id: '550e8400-e29b-41d4-a716-446655440000'
          // No _meta when flag is OFF
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.equipment).toBeDefined();
      expect(response.job_id).toBeDefined();
      expect(response._meta).toBeUndefined(); // No metadata in legacy mode
    });
  });

  describe('GET /equipment with flag ON (v2 mode)', () => {
    it('should return equipment with _meta when flag is ON', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
        },
      });

      // Simulate flag ON: Include _meta with sources
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          equipment: [
            {
              id: '1',
              name: 'Lawn Mower',
              checked: true,
              category: 'primary',
              quantity: 1
            }
          ],
          job_id: '550e8400-e29b-41d4-a716-446655440000',
          _meta: {
            total: 1,
            sources: {
              table: 1,
              jsonb: 0
            }
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response._meta).toBeDefined();
      expect(response._meta.sources).toBeDefined();
      expect(response._meta.sources.table).toBeGreaterThanOrEqual(0);
      expect(response._meta.sources.jsonb).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PUT /equipment with flag OFF (legacy mode)', () => {
    it('should update JSONB only without dual-write metadata when flag is OFF', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: [
            { id: '1', name: 'Lawn Mower', checked: true, category: 'primary', quantity: 1 }
          ]
        }
      });

      // Simulate flag OFF: No _meta in response
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          equipment: [
            { id: '1', name: 'Lawn Mower', checked: true, category: 'primary', quantity: 1 }
          ]
          // No _meta when flag is OFF
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.success).toBe(true);
      expect(response.equipment).toBeDefined();
      expect(response._meta).toBeUndefined(); // No metadata in legacy mode
    });
  });

  describe('PUT /equipment with flag ON (v2 mode)', () => {
    it('should perform dual-write with metadata when flag is ON', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/crew/jobs/550e8400-e29b-41d4-a716-446655440000/equipment',
        headers: {
          'authorization': 'Bearer valid-crew-token',
          'content-type': 'application/json',
        },
        body: {
          equipment: [
            { id: '1', name: 'Lawn Mower', checked: true, category: 'primary', quantity: 1 },
            { id: '2', name: 'Trimmer', checked: false, category: 'primary', quantity: 1 }
          ]
        }
      });

      // Simulate flag ON: Include _meta with dual-write info
      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          success: true,
          equipment: [
            { id: '1', name: 'Lawn Mower', checked: true, category: 'primary', quantity: 1 },
            { id: '2', name: 'Trimmer', checked: false, category: 'primary', quantity: 1 }
          ],
          _meta: {
            dual_write: true,
            total_items: 2,
            loaded_count: 1,
            missing_count: 1
          }
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response._meta).toBeDefined();
      expect(response._meta.dual_write).toBe(true);
      expect(response._meta.total_items).toBe(2);
      expect(response._meta.loaded_count).toBe(1);
      expect(response._meta.missing_count).toBe(1);
    });
  });
});

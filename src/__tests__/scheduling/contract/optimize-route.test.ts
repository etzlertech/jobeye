/**
 * @file /src/__tests__/scheduling/contract/optimize-route.test.ts
 * @purpose Contract test for PATCH /api/scheduling/day-plans/{id}/optimize
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// This will fail with "Cannot find module" - as expected for TDD
import handler from '@/app/api/scheduling/day-plans/[id]/optimize/route';

describe('PATCH /api/scheduling/day-plans/{id}/optimize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should optimize route for a day plan', async () => {
    const dayPlanId = '123e4567-e89b-12d3-a456-426614174000';
    const { req } = createMocks({
      method: 'PATCH',
      headers: {
        'authorization': 'Bearer mock-token'
      },
      query: {
        id: dayPlanId
      },
      body: {
        optimization_mode: 'time' // or 'distance'
      }
    });

    const response = await handler.PATCH(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      id: dayPlanId,
      route_data: expect.objectContaining({
        optimized: true,
        optimization_mode: 'time',
        stops: expect.arrayContaining([
          expect.objectContaining({
            sequence: expect.any(Number),
            arrival_time: expect.any(String),
            duration_minutes: expect.any(Number)
          })
        ]),
        total_distance_miles: expect.any(Number),
        total_duration_minutes: expect.any(Number)
      }),
      total_distance_miles: expect.any(Number),
      estimated_duration_minutes: expect.any(Number)
    });
  });

  it('should re-optimize after job completion', async () => {
    const dayPlanId = '123e4567-e89b-12d3-a456-426614174000';
    const { req } = createMocks({
      method: 'PATCH',
      headers: {
        'authorization': 'Bearer mock-token'
      },
      query: {
        id: dayPlanId
      },
      body: {
        trigger: 'job_completed',
        completed_event_id: '456e4567-e89b-12d3-a456-426614174000',
        current_location: {
          lat: 40.7128,
          lng: -74.0060
        }
      }
    });

    const response = await handler.PATCH(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.route_data).toMatchObject({
      optimized: true,
      re_optimized_at: expect.any(String),
      trigger: 'job_completed'
    });
  });

  it('should use offline optimization when no internet', async () => {
    const dayPlanId = '123e4567-e89b-12d3-a456-426614174000';
    const { req } = createMocks({
      method: 'PATCH',
      headers: {
        'authorization': 'Bearer mock-token',
        'x-offline-mode': 'true'
      },
      query: {
        id: dayPlanId
      }
    });

    const response = await handler.PATCH(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.route_data).toMatchObject({
      optimized: true,
      optimization_method: 'offline',
      algorithm: expect.stringMatching(/nearest_neighbor|2_opt/)
    });
  });

  it('should respect maximum stops limit', async () => {
    const dayPlanId = '123e4567-e89b-12d3-a456-426614174000';
    const { req } = createMocks({
      method: 'PATCH',
      headers: {
        'authorization': 'Bearer mock-token'
      },
      query: {
        id: dayPlanId
      },
      body: {
        // Assuming day plan has more than 30 stops (Mapbox limit)
        force_batch_optimization: true
      }
    });

    const response = await handler.PATCH(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.route_data).toMatchObject({
      optimized: true,
      optimization_batches: expect.any(Number)
    });
  });

  it('should validate day plan exists', async () => {
    const nonExistentId = '999e4567-e89b-12d3-a456-426614174999';
    const { req } = createMocks({
      method: 'PATCH',
      headers: {
        'authorization': 'Bearer mock-token'
      },
      query: {
        id: nonExistentId
      }
    });

    const response = await handler.PATCH(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Day plan not found');
  });

  it('should enforce RLS - cannot optimize other company plans', async () => {
    const otherCompanyPlanId = '123e4567-e89b-12d3-a456-426614174000';
    const { req } = createMocks({
      method: 'PATCH',
      headers: {
        'authorization': 'Bearer mock-token-different-company'
      },
      query: {
        id: otherCompanyPlanId
      }
    });

    const response = await handler.PATCH(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should require authentication', async () => {
    const { req } = createMocks({
      method: 'PATCH',
      query: {
        id: '123e4567-e89b-12d3-a456-426614174000'
      }
      // No authorization header
    });

    const response = await handler.PATCH(req as unknown as NextRequest);
    
    expect(response.status).toBe(401);
  });
});
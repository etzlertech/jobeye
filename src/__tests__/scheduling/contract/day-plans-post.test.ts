/**
 * @file /src/__tests__/scheduling/contract/day-plans-post.test.ts
 * @purpose Contract test for POST /api/scheduling/day-plans
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// This will fail with "Cannot find module" - as expected for TDD
import handler from '@/app/api/scheduling/day-plans/route';

describe('POST /api/scheduling/day-plans', () => {
  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks();
  });

  it('should create a new day plan for a technician', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        plan_date: '2024-01-15',
        route_data: {
          stops: [
            { address: '123 Main St', lat: 40.7128, lng: -74.0060 },
            { address: '456 Oak Ave', lat: 40.7580, lng: -73.9855 }
          ]
        }
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      id: expect.any(String),
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      plan_date: '2024-01-15',
      status: 'draft',
      route_data: expect.objectContaining({
        stops: expect.any(Array)
      }),
      total_distance_miles: expect.any(Number),
      estimated_duration_minutes: expect.any(Number),
      created_at: expect.any(String),
      updated_at: expect.any(String)
    });
  });

  it('should enforce maximum 6 jobs per technician per day', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        plan_date: '2024-01-15',
        schedule_events: Array(7).fill({
          event_type: 'job',
          scheduled_duration_minutes: 60
        })
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('maximum of 6 jobs');
  });

  it('should validate required fields', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        // Missing required user_id and plan_date
        route_data: {}
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should require authentication', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json'
        // No authorization header
      },
      body: {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        plan_date: '2024-01-15'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    
    expect(response.status).toBe(401);
  });
});
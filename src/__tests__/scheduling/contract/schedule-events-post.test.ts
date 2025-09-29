/**
 * @file /src/__tests__/scheduling/contract/schedule-events-post.test.ts
 * @purpose Contract test for POST /api/scheduling/schedule-events
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// This will fail with "Cannot find module" - as expected for TDD
import handler from '@/app/api/scheduling/schedule-events/route';

describe('POST /api/scheduling/schedule-events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new schedule event', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        day_plan_id: '123e4567-e89b-12d3-a456-426614174000',
        event_type: 'job',
        job_id: '456e4567-e89b-12d3-a456-426614174000',
        sequence_order: 1,
        scheduled_start: '2024-01-15T09:00:00Z',
        scheduled_duration_minutes: 60,
        location_data: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128]
        },
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001'
        }
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      id: expect.any(String),
      day_plan_id: '123e4567-e89b-12d3-a456-426614174000',
      event_type: 'job',
      job_id: '456e4567-e89b-12d3-a456-426614174000',
      sequence_order: 1,
      scheduled_start: '2024-01-15T09:00:00Z',
      scheduled_duration_minutes: 60,
      status: 'pending',
      location_data: expect.objectContaining({
        type: 'Point'
      }),
      created_at: expect.any(String),
      updated_at: expect.any(String)
    });
  });

  it('should create break events with labor rule validation', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        day_plan_id: '123e4567-e89b-12d3-a456-426614174000',
        event_type: 'break',
        sequence_order: 3,
        scheduled_start: '2024-01-15T12:00:00Z',
        scheduled_duration_minutes: 30,
        notes: 'Lunch break'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      event_type: 'break',
      scheduled_duration_minutes: 30,
      notes: 'Lunch break'
    });
  });

  it('should validate event conflicts', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        day_plan_id: '123e4567-e89b-12d3-a456-426614174000',
        event_type: 'job',
        job_id: '789e4567-e89b-12d3-a456-426614174000',
        sequence_order: 2,
        scheduled_start: '2024-01-15T09:30:00Z', // Overlaps with existing event
        scheduled_duration_minutes: 60
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('conflict');
  });

  it('should validate required fields', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        // Missing required fields
        event_type: 'job'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should validate event_type enum', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        day_plan_id: '123e4567-e89b-12d3-a456-426614174000',
        event_type: 'invalid_type',
        sequence_order: 1,
        scheduled_start: '2024-01-15T09:00:00Z',
        scheduled_duration_minutes: 60
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('event_type');
    expect(data.error).toContain('job, break, travel, maintenance, meeting');
  });

  it('should require job_id for job events', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        day_plan_id: '123e4567-e89b-12d3-a456-426614174000',
        event_type: 'job',
        // Missing job_id for job event
        sequence_order: 1,
        scheduled_start: '2024-01-15T09:00:00Z',
        scheduled_duration_minutes: 60
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('job_id');
  });

  it('should require authentication', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json'
        // No authorization header
      },
      body: {
        day_plan_id: '123e4567-e89b-12d3-a456-426614174000',
        event_type: 'job'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    
    expect(response.status).toBe(401);
  });
});
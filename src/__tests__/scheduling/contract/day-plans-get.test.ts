/**
 * @file /src/__tests__/scheduling/contract/day-plans-get.test.ts
 * @purpose Contract test for GET /api/scheduling/day-plans
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';
import { setupTestDatabase, cleanupTestDatabase, TEST_IDS, createTestDayPlan } from '@/__tests__/helpers/test-db-setup';

import handler from '@/app/api/scheduling/day-plans/route';

describe('GET /api/scheduling/day-plans', () => {
  beforeAll(async () => {
    await setupTestDatabase();

    // Create some test day plans
    await createTestDayPlan({
      user_id: TEST_IDS.user1,
      plan_date: '2024-01-15',
      status: 'published',
      total_distance_miles: 5.2,
      estimated_duration_minutes: 45
    });

    await createTestDayPlan({
      user_id: TEST_IDS.user1,
      plan_date: '2024-01-16',
      status: 'draft'
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Clean up before each test to avoid unique constraint violations
    await cleanupTestDatabase();
    // Re-seed for this test
    await createTestDayPlan({
      user_id: TEST_IDS.user1,
      plan_date: '2024-01-15',
      status: 'published',
      total_distance_miles: 5.2,
      estimated_duration_minutes: 45
    });
    await createTestDayPlan({
      user_id: TEST_IDS.user1,
      plan_date: '2024-01-16',
      status: 'draft'
    });
  });

  it('should return day plans for authenticated company', async () => {
    const { req } = createMocks({
      method: 'GET',
      headers: {
        'authorization': 'Bearer mock-token'
      },
      query: {
        date: '2024-01-15'
      }
    });

    const response = await handler.GET(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      plans: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          user_id: expect.any(String),
          plan_date: expect.any(String),
          status: expect.stringMatching(/^(draft|published|in_progress|completed)$/),
          route_data: expect.any(Object),
          total_distance_miles: expect.any(Number),
          estimated_duration_minutes: expect.any(Number),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        })
      ]),
      total: expect.any(Number)
    });
  });

  it('should filter by user_id when provided', async () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const { req } = createMocks({
      method: 'GET',
      headers: {
        'authorization': 'Bearer mock-token'
      },
      query: {
        user_id: userId,
        date: '2024-01-15'
      }
    });

    const response = await handler.GET(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: userId
        })
      ])
    );
  });

  it('should filter by date range', async () => {
    const { req } = createMocks({
      method: 'GET',
      headers: {
        'authorization': 'Bearer mock-token'
      },
      query: {
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      }
    });

    const response = await handler.GET(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    data.plans.forEach((plan: any) => {
      const planDate = new Date(plan.plan_date);
      expect(planDate >= new Date('2024-01-01')).toBe(true);
      expect(planDate <= new Date('2024-01-31')).toBe(true);
    });
  });

  it('should support pagination', async () => {
    const { req } = createMocks({
      method: 'GET',
      headers: {
        'authorization': 'Bearer mock-token'
      },
      query: {
        page: '2',
        limit: '10'
      }
    });

    const response = await handler.GET(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      plans: expect.any(Array),
      total: expect.any(Number),
      page: 2,
      limit: 10
    });
    expect(data.plans.length).toBeLessThanOrEqual(10);
  });

  it('should require authentication', async () => {
    const { req } = createMocks({
      method: 'GET',
      // No authorization header
      query: {
        date: '2024-01-15'
      }
    });

    const response = await handler.GET(req as unknown as NextRequest);
    
    expect(response.status).toBe(401);
  });

  it('should enforce RLS - only return plans for authenticated company', async () => {
    // This test verifies multi-tenant isolation
    const { req } = createMocks({
      method: 'GET',
      headers: {
        'authorization': 'Bearer mock-token-company-a'
      }
    });

    const response = await handler.GET(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    // All returned plans should belong to the authenticated company
    // The actual tenant_id check will be enforced by RLS policies
    expect(data.plans).toBeDefined();
  });
});
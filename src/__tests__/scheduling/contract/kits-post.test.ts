/**
 * @file /src/__tests__/scheduling/contract/kits-post.test.ts
 * @purpose Contract test for POST /api/kits
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// This will fail with "Cannot find module" - as expected for TDD
import handler from '@/app/api/kits/route';

describe('POST /api/kits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new kit with items', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        kit_code: 'LAWN-BASIC',
        name: 'Basic Lawn Care Kit',
        description: 'Essential tools for lawn maintenance',
        category: 'lawn_care',
        voice_identifier: 'basic lawn kit',
        typical_job_types: ['mowing', 'trimming', 'cleanup'],
        items: [
          {
            item_type: 'equipment',
            equipment_id: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 1,
            unit: 'each',
            is_required: true
          },
          {
            item_type: 'material',
            material_id: '456e4567-e89b-12d3-a456-426614174000',
            quantity: 5,
            unit: 'gallons',
            is_required: false
          }
        ]
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      id: expect.any(String),
      kit_code: 'LAWN-BASIC',
      name: 'Basic Lawn Care Kit',
      description: 'Essential tools for lawn maintenance',
      category: 'lawn_care',
      is_active: true,
      voice_identifier: 'basic lawn kit',
      typical_job_types: ['mowing', 'trimming', 'cleanup'],
      created_at: expect.any(String),
      updated_at: expect.any(String),
      items: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          item_type: 'equipment',
          equipment_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 1,
          is_required: true
        }),
        expect.objectContaining({
          item_type: 'material',
          material_id: '456e4567-e89b-12d3-a456-426614174000',
          quantity: 5,
          is_required: false
        })
      ])
    });
  });

  it('should create kit with seasonal variants', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        kit_code: 'IRRIGATION-START',
        name: 'Irrigation Startup Kit',
        category: 'irrigation',
        items: [
          {
            item_type: 'equipment',
            equipment_id: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 1,
            is_required: true
          }
        ],
        variants: [
          {
            variant_code: 'WINTER',
            variant_type: 'seasonal',
            conditions: {
              season: 'winter',
              temperature_range: { min: -10, max: 40 }
            },
            item_modifications: {
              additions: [
                {
                  item_type: 'material',
                  material_id: '789e4567-e89b-12d3-a456-426614174000',
                  quantity: 2,
                  unit: 'bottles'
                }
              ]
            },
            valid_from: '2024-12-01',
            valid_until: '2025-02-28'
          }
        ]
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      kit_code: 'IRRIGATION-START',
      variants: expect.arrayContaining([
        expect.objectContaining({
          variant_code: 'WINTER',
          variant_type: 'seasonal',
          is_active: true
        })
      ])
    });
  });

  it('should validate kit_code uniqueness per company', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        kit_code: 'EXISTING-KIT', // Assume this already exists
        name: 'Duplicate Kit',
        category: 'general',
        items: []
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('kit_code');
    expect(data.error).toContain('already exists');
  });

  it('should validate required fields', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        // Missing required kit_code and name
        category: 'general'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should validate item references exist', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        kit_code: 'TEST-KIT',
        name: 'Test Kit',
        category: 'test',
        items: [
          {
            item_type: 'equipment',
            equipment_id: '999e4567-e89b-12d3-a456-426614174999', // Non-existent
            quantity: 1,
            is_required: true
          }
        ]
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('equipment_id');
    expect(data.error).toContain('not found');
  });

  it('should require authentication', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json'
        // No authorization header
      },
      body: {
        kit_code: 'TEST',
        name: 'Test Kit'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    
    expect(response.status).toBe(401);
  });
});
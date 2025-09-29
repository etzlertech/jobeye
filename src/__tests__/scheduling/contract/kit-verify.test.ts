/**
 * @file /src/__tests__/scheduling/contract/kit-verify.test.ts
 * @purpose Contract test for POST /api/jobs/{jobId}/kits/{kitId}/verify
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// This will fail with "Cannot find module" - as expected for TDD
import handler from '@/app/api/jobs/[jobId]/kits/[kitId]/verify/route';

describe('POST /api/jobs/{jobId}/kits/{kitId}/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should verify kit loaded successfully', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174000';
    const kitId = '456e4567-e89b-12d3-a456-426614174000';
    
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      query: {
        jobId,
        kitId
      },
      body: {
        verification_method: 'manual',
        verified_by: '789e4567-e89b-12d3-a456-426614174000',
        checklist: [
          {
            item_id: 'abc123',
            status: 'present',
            quantity_verified: 1
          },
          {
            item_id: 'def456',
            status: 'present',
            quantity_verified: 5
          }
        ],
        notes: 'All items accounted for',
        photo_ids: ['photo-123', 'photo-456']
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      job_kit_id: expect.any(String),
      verified_at: expect.any(String),
      verified_by: '789e4567-e89b-12d3-a456-426614174000',
      verification_method: 'manual',
      verification_status: 'complete',
      checklist_results: expect.arrayContaining([
        expect.objectContaining({
          item_id: 'abc123',
          status: 'present'
        })
      ])
    });
  });

  it('should handle missing items with override', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174000';
    const kitId = '456e4567-e89b-12d3-a456-426614174000';
    
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      query: {
        jobId,
        kitId
      },
      body: {
        verification_method: 'manual',
        verified_by: '789e4567-e89b-12d3-a456-426614174000',
        checklist: [
          {
            item_id: 'abc123',
            status: 'present',
            quantity_verified: 1
          },
          {
            item_id: 'def456',
            status: 'missing',
            quantity_verified: 0,
            override_reason: 'Equipment broken, proceeding without'
          }
        ],
        override_missing: true,
        supervisor_notified: true
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      verification_status: 'partial',
      has_overrides: true,
      override_log_id: expect.any(String),
      notification_sent: true
    });
  });

  it('should reject verification with missing required items', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174000';
    const kitId = '456e4567-e89b-12d3-a456-426614174000';
    
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      query: {
        jobId,
        kitId
      },
      body: {
        verification_method: 'manual',
        verified_by: '789e4567-e89b-12d3-a456-426614174000',
        checklist: [
          {
            item_id: 'abc123',
            status: 'missing',
            is_required: true,
            quantity_verified: 0
          }
        ],
        override_missing: false
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Required items missing');
    expect(data.missing_items).toContain('abc123');
  });

  it('should support photo verification placeholder', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174000';
    const kitId = '456e4567-e89b-12d3-a456-426614174000';
    
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      query: {
        jobId,
        kitId
      },
      body: {
        verification_method: 'photo',
        verified_by: '789e4567-e89b-12d3-a456-426614174000',
        photo_ids: ['photo-789'],
        notes: 'Photo verification pending vision AI in feature 004'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      verification_method: 'photo',
      verification_status: 'pending_review',
      notes: expect.stringContaining('pending vision AI')
    });
  });

  it('should validate job and kit exist', async () => {
    const nonExistentJobId = '999e4567-e89b-12d3-a456-426614174999';
    const kitId = '456e4567-e89b-12d3-a456-426614174000';
    
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      query: {
        jobId: nonExistentJobId,
        kitId
      },
      body: {
        verification_method: 'manual'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Job not found');
  });

  it('should enforce RLS - cannot verify kits for other companies', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174000';
    const kitId = '456e4567-e89b-12d3-a456-426614174000';
    
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token-different-company'
      },
      query: {
        jobId,
        kitId
      },
      body: {
        verification_method: 'manual'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should require authentication', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json'
        // No authorization header
      },
      query: {
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        kitId: '456e4567-e89b-12d3-a456-426614174000'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    
    expect(response.status).toBe(401);
  });
});
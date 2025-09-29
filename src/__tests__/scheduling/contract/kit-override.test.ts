/**
 * @file /src/__tests__/scheduling/contract/kit-override.test.ts
 * @purpose Contract test for POST /api/kit-overrides
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// This will fail with "Cannot find module" - as expected for TDD
import handler from '@/app/api/kit-overrides/route';

describe('POST /api/kit-overrides', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create kit override and notify supervisor', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        kit_id: '456e4567-e89b-12d3-a456-426614174000',
        item_id: '789e4567-e89b-12d3-a456-426614174000',
        technician_id: 'abc4567-e89b-12d3-a456-426614174000',
        override_reason: 'Mower blade broken, proceeding with backup equipment',
        notification_preferences: {
          methods: ['sms', 'push'],
          supervisor_id: 'def4567-e89b-12d3-a456-426614174000'
        }
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      id: expect.any(String),
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      kit_id: '456e4567-e89b-12d3-a456-426614174000',
      item_id: '789e4567-e89b-12d3-a456-426614174000',
      technician_id: 'abc4567-e89b-12d3-a456-426614174000',
      override_reason: 'Mower blade broken, proceeding with backup equipment',
      supervisor_notified_at: expect.any(String),
      notification_method: expect.stringMatching(/sms|push/),
      notification_status: 'sent',
      created_at: expect.any(String)
    });
  });

  it('should handle notification fallback chain', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        kit_id: '456e4567-e89b-12d3-a456-426614174000',
        item_id: '789e4567-e89b-12d3-a456-426614174000',
        technician_id: 'abc4567-e89b-12d3-a456-426614174000',
        override_reason: 'Critical equipment missing',
        notification_preferences: {
          methods: ['push', 'sms', 'call'], // Fallback chain
          supervisor_id: 'def4567-e89b-12d3-a456-426614174000',
          priority: 'high'
        }
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      notification_attempts: expect.arrayContaining([
        expect.objectContaining({
          method: expect.any(String),
          status: expect.any(String),
          attempted_at: expect.any(String)
        })
      ]),
      notification_method: expect.any(String), // Final successful method
      notification_status: 'sent'
    });
  });

  it('should validate voice-initiated overrides', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token',
        'x-voice-session-id': 'voice-session-123'
      },
      body: {
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        kit_id: '456e4567-e89b-12d3-a456-426614174000',
        item_id: '789e4567-e89b-12d3-a456-426614174000',
        technician_id: 'abc4567-e89b-12d3-a456-426614174000',
        override_reason: 'No trimmer available', // Voice transcription
        voice_metadata: {
          session_id: 'voice-session-123',
          transcript: 'Override missing item trimmer not available',
          confidence: 0.95
        }
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      override_reason: 'No trimmer available',
      voice_initiated: true,
      metadata: expect.objectContaining({
        voice_session_id: 'voice-session-123'
      })
    });
  });

  it('should enforce 30-second SLA for notifications', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        kit_id: '456e4567-e89b-12d3-a456-426614174000',
        item_id: '789e4567-e89b-12d3-a456-426614174000',
        technician_id: 'abc4567-e89b-12d3-a456-426614174000',
        override_reason: 'Equipment failure',
        notification_preferences: {
          methods: ['sms'],
          supervisor_id: 'def4567-e89b-12d3-a456-426614174000',
          sla_seconds: 30
        }
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    
    // Calculate notification time
    const createdAt = new Date(data.created_at);
    const notifiedAt = new Date(data.supervisor_notified_at);
    const timeDiffSeconds = (notifiedAt.getTime() - createdAt.getTime()) / 1000;
    
    expect(timeDiffSeconds).toBeLessThanOrEqual(30);
    expect(data.sla_met).toBe(true);
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
        override_reason: 'Test'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
    expect(data.missing_fields).toEqual(
      expect.arrayContaining(['job_id', 'kit_id', 'item_id', 'technician_id'])
    );
  });

  it('should validate job/kit/item relationships', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        kit_id: '456e4567-e89b-12d3-a456-426614174000',
        item_id: '999e4567-e89b-12d3-a456-426614174999', // Item not in kit
        technician_id: 'abc4567-e89b-12d3-a456-426614174000',
        override_reason: 'Test invalid item'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Item not found in kit');
  });

  it('should track override history', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer mock-token'
      },
      body: {
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        kit_id: '456e4567-e89b-12d3-a456-426614174000',
        item_id: '789e4567-e89b-12d3-a456-426614174000',
        technician_id: 'abc4567-e89b-12d3-a456-426614174000',
        override_reason: 'Repeated equipment issue',
        metadata: {
          previous_override_count: 2,
          equipment_serial: 'EQ-12345'
        }
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.metadata).toMatchObject({
      previous_override_count: 2,
      equipment_serial: 'EQ-12345'
    });
  });

  it('should require authentication', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json'
        // No authorization header
      },
      body: {
        job_id: '123e4567-e89b-12d3-a456-426614174000'
      }
    });

    const response = await handler.POST(req as unknown as NextRequest);
    
    expect(response.status).toBe(401);
  });
});
/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/auth/api/auth-callback.test.ts
 * phase: 3
 * domain: auth
 * purpose: Validates Supabase session sync via /auth/callback
 * spec_ref: 007-mvp-intent-driven/contracts/auth.md
 * coverage_target: 90
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

if (typeof Response !== 'undefined' && typeof (Response as any).json !== 'function') {
  (Response as any).json = (data: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {})
      },
      ...init
    });
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  __esModule: true,
  createRouteHandlerClient: jest.fn()
}));

jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn()
}));

const { createRouteHandlerClient } = jest.requireMock('@supabase/auth-helpers-nextjs') as {
  createRouteHandlerClient: jest.Mock
};
const { cookies } = jest.requireMock('next/headers') as {
  cookies: jest.Mock
};

describe('POST /auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockReturnValue({
      get: jest.fn(),
      set: jest.fn()
    });
  });

  it('sets session cookies for SIGNED_IN event', async () => {
    const setSession = jest.fn().mockResolvedValue({ data: { session: {} }, error: null });

    createRouteHandlerClient.mockReturnValue({
      auth: {
        setSession,
        signOut: jest.fn()
      }
    });

    const { POST } = await import('@/app/auth/callback/route');
    const request = new Request('https://jobeye.test/auth/callback', {
      method: 'POST',
      body: JSON.stringify({
        event: 'SIGNED_IN',
        session: { access_token: 'token', refresh_token: 'refresh' }
      })
    }) as unknown as NextRequest;

    const response = await POST(request);
    expect(setSession).toHaveBeenCalledWith({ access_token: 'token', refresh_token: 'refresh' });
    expect(response.status).toBe(200);
  });

  it('signs out for SIGNED_OUT event', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });

    createRouteHandlerClient.mockReturnValue({
      auth: {
        setSession: jest.fn(),
        signOut
      }
    });

    const { POST } = await import('@/app/auth/callback/route');
    const request = new Request('https://jobeye.test/auth/callback', {
      method: 'POST',
      body: JSON.stringify({
        event: 'SIGNED_OUT'
      })
    }) as unknown as NextRequest;

    const response = await POST(request);
    expect(signOut).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('returns 400 for unsupported event', async () => {
    createRouteHandlerClient.mockReturnValue({
      auth: {
        setSession: jest.fn(),
        signOut: jest.fn()
      }
    });

    const { POST } = await import('@/app/auth/callback/route');
    const request = new Request('https://jobeye.test/auth/callback', {
      method: 'POST',
      body: JSON.stringify({ event: 'UNKNOWN' })
    }) as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

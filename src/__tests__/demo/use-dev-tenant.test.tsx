/*
AGENT DIRECTIVE BLOCK
file: /src/__tests__/demo/use-dev-tenant.test.tsx
phase: dev-crud
domain: supervisor
purpose: Validate tenant bootstrap hook behavior for demo CRUD tools
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 120
dependencies:
  internal:
    - '@/hooks/useDevTenant'
    - '@/lib/supabase/client'
  external:
    - '@testing-library/react'
voice_considerations:
  - N/A (test)
*/

import { renderHook, waitFor } from '@testing-library/react';
import { useDevTenant } from '@/hooks/useDevTenant';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn()
    }
  }
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;

describe('useDevTenant', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns tenant id from app_metadata when session is available', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: { tenant_id: 'tenant-123' },
            user_metadata: {}
          }
        }
      },
      error: null
    });

    const { result } = renderHook(() => useDevTenant({ redirectPath: '/demo-crud' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tenantId).toBe('tenant-123');
    expect(result.current.requireSignIn).toBe(false);
    expect(result.current.tenantHeaders).toEqual({ 'x-tenant-id': 'tenant-123' });
  });

  it('falls back to demo-company tenant when metadata is missing', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: {},
            user_metadata: {}
          }
        }
      },
      error: null
    });

    const { result } = renderHook(() => useDevTenant({ redirectPath: '/demo-properties' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tenantId).toBe('demo-company');
    expect(result.current.requireSignIn).toBe(false);
  });

  it('requires sign in when session is missing', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    const { result } = renderHook(() => useDevTenant({ redirectPath: '/demo-crud' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tenantId).toBeNull();
    expect(result.current.requireSignIn).toBe(true);
    expect(result.current.statusMessage).toContain('/simple-signin?redirectTo=/demo-crud');
  });
});

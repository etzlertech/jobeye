/*
AGENT DIRECTIVE BLOCK
file: /src/hooks/useDevTenant.ts
phase: dev-crud
domain: supervisor
purpose: Provide reusable tenant bootstrap logic for demo CRUD tooling
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 160
dependencies:
  internal:
    - '@/lib/supabase/client'
  external:
    - 'react'
voice_considerations:
  - Ensure any consumer can surface microphone instructions when sign-in required
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface UseDevTenantOptions {
  redirectPath: string;
  fallbackTenantId?: string;
}

export interface UseDevTenantState {
  tenantId: string | null;
  loading: boolean;
  statusMessage: string;
  requireSignIn: boolean;
  tenantHeaders: Record<string, string>;
  error: Error | null;
  refreshTenant: () => Promise<void>;
}

export function useDevTenant(options: UseDevTenantOptions): UseDevTenantState {
  const { redirectPath, fallbackTenantId = 'demo-company' } = options;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Initializing tenant session…');
  const [requireSignIn, setRequireSignIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshTenant = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!data.session) {
        setTenantId(null);
        setRequireSignIn(true);
        setStatusMessage(`Please sign in via /simple-signin?redirectTo=${redirectPath}`);
        return;
      }

      const metadataTenant =
        (data.session.user.app_metadata?.tenant_id as string | undefined) ||
        (data.session.user.user_metadata?.tenant_id as string | undefined);

      const resolvedTenant = metadataTenant || fallbackTenantId;

      setTenantId(resolvedTenant);
      setRequireSignIn(false);
      setStatusMessage(`Tenant ready: ${resolvedTenant}`);
    } catch (err) {
      const normalizedError = err instanceof Error ? err : new Error('Unknown tenant fetch error');
      setTenantId(null);
      setRequireSignIn(true);
      setStatusMessage('Unable to load Supabase session. Please refresh or sign in again.');
      setError(normalizedError);
    } finally {
      setLoading(false);
    }
  }, [redirectPath, fallbackTenantId]);

  useEffect(() => {
    refreshTenant();
  }, [refreshTenant]);

  const tenantHeaders = useMemo<Record<string, string>>(() => {
    if (!tenantId) {
      return {};
    }

    return { 'x-tenant-id': tenantId };
  }, [tenantId]);

  return {
    tenantId,
    loading,
    statusMessage,
    requireSignIn,
    tenantHeaders,
    error,
    refreshTenant
  };
}

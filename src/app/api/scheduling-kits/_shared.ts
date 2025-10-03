/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/scheduling-kits/_shared.ts
 * phase: 3
 * domain: scheduling-kits
 * purpose: Shared helpers for scheduling kits API handlers (auth + service wiring)
 * spec_ref: .specify/features/003-scheduling-kits/tasks.md#Phase-3.4
 * complexity_budget: 120
 * dependencies:
 *   - internal: KitService, KitRepository, KitVariantRepository, KitAssignmentRepository, KitOverrideLogRepository, createServiceSupabaseClient
 *   - external: next/server, @supabase/auth-helpers-nextjs
 * exports: requireSession, extractCompanyId, buildKitService, SessionPayload
 * voice_considerations:
 *   - Maintains consistent voice metadata across endpoints.
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - Covered indirectly by scheduling-kits API tests.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { KitRepository } from '@/domains/repos/scheduling-kits/kit-repository';
import { KitVariantRepository } from '@/domains/repos/scheduling-kits/kit-variant-repository';
import { KitAssignmentRepository } from '@/domains/repos/scheduling-kits/kit-assignment-repository';
import { KitOverrideLogRepository } from '@/domains/repos/scheduling-kits/kit-override-log-repository';
import { KitService } from '@/domains/services/scheduling-kits/kit-service';

export interface SessionUserMeta {
  tenant_id?: string;
  tenantId?: string;
  tenant_id?: string;
}

export interface SessionPayload {
  user: {
    id: string;
    app_metadata?: SessionUserMeta | Record<string, unknown>;
    user_metadata?: SessionUserMeta | Record<string, unknown>;
  };
}

export type RequireSessionResult =
  | { session: SessionPayload }
  | { response: NextResponse };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) is required');
}
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

declare global {
  // eslint-disable-next-line no-var
  var __supabaseSchedulingAdmin__: SupabaseClient | undefined;
}

export const supabaseAdmin: SupabaseClient =
  globalThis.__supabaseSchedulingAdmin__ ??
  (globalThis.__supabaseSchedulingAdmin__ = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  }));

export function mapPgErrorToHttp(error: unknown) {
  const code = (error as any)?.code ?? (error as any)?.cause?.code;
  if (code === '23505') {
    return {
      status: 409,
      body: { error: 'Duplicate kit_code for this tenant.' },
    } as const;
  }
  return null;
}

export async function requireSession(): Promise<RequireSessionResult> {
  const routeClient = createRouteHandlerClient({ cookies });
  const { data, error } = await routeClient.auth.getSession();

  if (error || !data.session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { session: data.session as SessionPayload };
}

export function extractCompanyId(session: SessionPayload, request: Request): string {
  const headerCompanyId =
    request.headers.get('x-jobeye-company-id') ??
    request.headers.get('x-company-id') ??
    request.headers.get('x-tenant-id');

  if (headerCompanyId) {
    return headerCompanyId;
  }

  const appMeta = (session.user.app_metadata ?? {}) as SessionUserMeta;
  const userMeta = (session.user.user_metadata ?? {}) as SessionUserMeta;

  const tenantId =
    appMeta.tenant_id ??
    appMeta.tenantId ??
    userMeta.tenant_id ??
    userMeta.tenantId ??
    appMeta.tenant_id ??
    userMeta.tenant_id;

  if (!tenantId) {
    throw new Error('Missing company context for request');
  }

  return tenantId;
}

export function buildKitService() {
  return new KitService({
    kitRepository: new KitRepository(supabaseAdmin),
    kitVariantRepository: new KitVariantRepository(supabaseAdmin),
    kitAssignmentRepository: new KitAssignmentRepository(supabaseAdmin),
    kitOverrideLogRepository: new KitOverrideLogRepository(supabaseAdmin),
    clock: { now: () => new Date() },
  });
}

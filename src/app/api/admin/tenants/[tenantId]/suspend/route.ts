/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/admin/tenants/[tenantId]/suspend/route.ts
 * purpose: Suspend tenant accounts with reason capture (system admin workflow)
 * spec_ref: docs/admin-ui-data-contracts.md#phase-33-tenant-management
 * roles: ['system_admin']
 * dependencies: {
 *   internal: [
 *     '@/lib/auth/context',
 *     '@/lib/supabase/server',
 *     '@/domains/tenant/services/tenant.service',
 *     '@/domains/admin/audit/admin-audit-log.service'
 *   ],
 *   external: ['next/server']
 * }
 * audit_log: Persists admin_audit_log records for tenant suspensions
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequestContext, isSystemAdmin } from '@/lib/auth/context';
import { createServiceClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant/services/tenant.service';
import { TenantStatus } from '@/domains/tenant/types';
import { AdminAuditLogService } from '@/domains/admin/audit/admin-audit-log.service';

// Force dynamic rendering - prevents static analysis during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const context = await getRequestContext(request);

    if (!isSystemAdmin(context)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const tenantId = params.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'missing_tenant_id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

    if (!reason) {
      return NextResponse.json({ error: 'reason_required' }, { status: 400 });
    }

    const adminClient = createServiceClient();
    const tenantService = new TenantService(adminClient);
    const auditLog = new AdminAuditLogService(adminClient);
    const previous = await tenantService.getTenant(tenantId);
    const updated = await tenantService.updateTenantStatus(tenantId, TenantStatus.SUSPENDED);

    console.info(`[admin/tenants/${tenantId}] suspended: ${reason}`);

    await auditLog.logTenantLifecycleChange({
      tenantId: updated.id,
      tenantName: updated.name,
      previousStatus: previous?.status,
      newStatus: updated.status,
      action: 'tenant.suspended',
      reason,
      actor: {
        id: context.userId,
        email: context.user?.email ?? undefined,
        roles: context.roles
      }
    });

    return NextResponse.json({
      status: 'success',
      tenant: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        plan: updated.plan,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('No tenant context')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    console.error('[admin/tenants/suspend] failed to suspend tenant', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

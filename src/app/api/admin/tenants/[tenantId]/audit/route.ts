/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/admin/tenants/[tenantId]/audit/route.ts
 * purpose: Fetch admin audit log entries for a specific tenant
 * spec_ref: admin-ui-specs.md#tenant-management
 * roles: ['system_admin']
 * dependencies: {
 *   internal: [
 *     '@/lib/auth/context',
 *     '@/lib/supabase/server',
 *     '@/domains/admin/audit/admin-audit-log.service'
 *   ],
 *   external: ['next/server']
 * }
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequestContext, isSystemAdmin } from '@/lib/auth/context';
import { createServiceClient } from '@/lib/supabase/server';
import { AdminAuditLogService } from '@/domains/admin/audit/admin-audit-log.service';

const DEFAULT_LIMIT = 100;

const actionMap: Record<string, 'approved' | 'suspended' | 'reactivated' | 'updated' | 'comment' | 'created'> = {
  'tenant.approved': 'approved',
  'tenant.suspended': 'suspended',
  'tenant.reactivated': 'reactivated',
  'tenant.status.change': 'updated',
  'tenant.comment': 'comment',
  'tenant.created': 'created'
};

export async function GET(
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

    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(Number.parseInt(limitParam, 10) || DEFAULT_LIMIT, 500) : DEFAULT_LIMIT;

    const adminClient = createServiceClient();
    const auditService = new AdminAuditLogService(adminClient);
    const entries = await auditService.getTenantLifecycleLog(tenantId, limit);

    const events = entries.map((entry) => {
      const metadata = (entry.metadata ?? {}) as Record<string, any>;
      const mappedAction = actionMap[entry.action] ?? 'updated';
      const actorRole = entry.actor.roles?.[0] ?? 'system_admin';

      return {
        id: entry.id,
        timestamp: entry.createdAt,
        action: mappedAction,
        actor: {
          id: entry.actor.id ?? 'unknown',
          name: entry.actor.email ?? actorRole,
          email: entry.actor.email ?? '',
          role: actorRole
        },
        metadata: {
          previousStatus: metadata.previousStatus,
          newStatus: metadata.newStatus,
          reason: entry.reason,
          comment: entry.comment,
          changes: metadata.changes ?? undefined
        }
      };
    });

    return NextResponse.json({ tenantId, events });
  } catch (error) {
    if (error instanceof Error && error.message.includes('No tenant context')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    console.error('[admin/tenants/audit] failed to list audit history', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

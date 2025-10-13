/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/admin/tenants/route.ts
 * purpose: System admin tenant listing endpoint powering admin console table
 * spec_ref: admin-ui-specs.md#tenant-management
 * roles: ['system_admin']
 * dependencies: {
 *   internal: ['@/lib/auth/context', '@/lib/supabase/server', '@/domains/tenant/services/tenant.service'],
 *   external: ['next/server']
 * }
 * audit_log: Pending integration (tenant lifecycle workstream)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequestContext, isSystemAdmin } from '@/lib/auth/context';
import { createServiceClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant/services/tenant.service';
import { TenantStatus } from '@/domains/tenant/types';

const DEFAULT_PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);

    if (!isSystemAdmin(context)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
    const limit = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
    const offset = (Math.max(page, 1) - 1) * limit;

    const adminClient = createServiceClient();
    const tenantService = new TenantService(adminClient);

    const options: { status?: TenantStatus; limit: number; offset: number } = {
      limit,
      offset,
    };

    if (statusParam && statusParam !== 'all') {
      if (!Object.values(TenantStatus).includes(statusParam as TenantStatus)) {
        return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
      }
      options.status = statusParam as TenantStatus;
    }

    const result = await tenantService.listTenants(options);

    const tenants = result.data.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      plan: tenant.plan,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      memberCount: tenant.memberCount,
      usage: {
        activeUsers: tenant.memberCount,
        jobsLast30d: 0, // TODO: integrate job usage metrics
      },
    }));

    return NextResponse.json({
      data: tenants,
      page,
      pageSize: limit,
      total: result.total,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('No tenant context')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    console.error('[admin/tenants] failed to list tenants', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

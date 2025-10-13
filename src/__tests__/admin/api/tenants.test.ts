/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/admin/api/tenants.test.ts
 * phase: 3
 * domain: admin
 * purpose: Validate admin tenant management API endpoints (list + status update)
 * spec_ref: admin-ui-specs.md#tenant-management
 * coverage_target: 85
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/lib/auth/context';
import { TenantStatus } from '@/domains/tenant/types';

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

jest.mock('@/lib/auth/context', () => {
  const actual = jest.requireActual('@/lib/auth/context');
  return {
    __esModule: true,
    ...actual,
    getRequestContext: jest.fn()
  };
});

jest.mock('@/lib/supabase/server', () => ({
  __esModule: true,
  createServiceClient: jest.fn()
}));

jest.mock('@/domains/tenant/services/tenant.service', () => ({
  __esModule: true,
  TenantService: jest.fn()
}));

jest.mock('@/domains/admin/audit/admin-audit-log.service', () => ({
  __esModule: true,
  AdminAuditLogService: jest.fn()
}));

const { getRequestContext } = jest.requireMock('@/lib/auth/context') as {
  getRequestContext: jest.Mock;
};
const { createServiceClient } = jest.requireMock('@/lib/supabase/server') as {
  createServiceClient: jest.Mock;
};
const { TenantService } = jest.requireMock('@/domains/tenant/services/tenant.service') as {
  TenantService: jest.Mock;
};
const { AdminAuditLogService } = jest.requireMock(
  '@/domains/admin/audit/admin-audit-log.service'
) as {
  AdminAuditLogService: jest.Mock;
};

let listTenantsMock: jest.Mock;
let updateTenantStatusMock: jest.Mock;
let getTenantMock: jest.Mock;
let logTenantLifecycleChangeMock: jest.Mock;
let getTenantLifecycleLogMock: jest.Mock;

const buildRequest = (query = '') =>
  ({
    nextUrl: new URL(`https://example.com/api/admin/tenants${query}`)
  } as unknown as NextRequest);

const buildPatchRequest = (body: unknown) =>
  ({
    nextUrl: new URL('https://example.com/api/admin/tenants/tenant-1/status'),
    json: jest.fn().mockResolvedValue(body)
  } as unknown as NextRequest);

const resolveContext = (roles: string[]): RequestContext => ({
  tenantId: 'tenant-ctx',
  roles,
  source: 'session',
  userId: 'user-123'
});

describe('Admin tenant routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listTenantsMock = jest.fn();
    updateTenantStatusMock = jest.fn();
    getTenantMock = jest.fn();
    getTenantMock.mockResolvedValue(null);
    logTenantLifecycleChangeMock = jest.fn().mockResolvedValue(null);
    getTenantLifecycleLogMock = jest.fn().mockResolvedValue([]);

    TenantService.mockImplementation(() => ({
      listTenants: listTenantsMock,
      updateTenantStatus: updateTenantStatusMock,
      getTenant: getTenantMock
    }));
    createServiceClient.mockReturnValue({});
    AdminAuditLogService.mockImplementation(() => ({
      logTenantLifecycleChange: logTenantLifecycleChangeMock,
      getTenantLifecycleLog: getTenantLifecycleLogMock
    }));
  });

  describe('GET /api/admin/tenants', () => {
    it('returns tenant data for system admins', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));
      listTenantsMock.mockResolvedValue({
        data: [
          {
            id: 'tenant-1',
            name: 'Acme Industries',
            slug: 'acme',
            status: TenantStatus.PENDING,
            plan: 'trial',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-02T12:00:00Z',
            memberCount: 4
          }
        ],
        total: 1
      });

      const { GET } = await import('@/app/api/admin/tenants/route');
      const response = await GET(buildRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(listTenantsMock).toHaveBeenCalledWith({ limit: 25, offset: 0 });
      expect(body).toEqual({
        data: [
          {
            id: 'tenant-1',
            name: 'Acme Industries',
            slug: 'acme',
            domain: null,
            status: TenantStatus.PENDING,
            plan: 'trial',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-02T12:00:00Z',
            lastActiveAt: '2025-01-02T12:00:00Z',
            memberCount: 4,
            usage: {
              activeUsers: 4,
              jobsLast30d: 0
            }
          }
        ],
        page: 1,
        pageSize: 25,
        total: 1
      });
    });

    it('passes filters through to the tenant service', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));
      listTenantsMock.mockResolvedValue({ data: [], total: 0 });

      const { GET } = await import('@/app/api/admin/tenants/route');
      const response = await GET(buildRequest('?status=active&page=2&pageSize=10'));

      expect(response.status).toBe(200);
      await response.json();
      expect(listTenantsMock).toHaveBeenCalledWith({
        status: TenantStatus.ACTIVE,
        limit: 10,
        offset: 10
      });
    });

    it('rejects invalid status filters', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));

      const { GET } = await import('@/app/api/admin/tenants/route');
      const response = await GET(buildRequest('?status=invalid'));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_status' });
      expect(listTenantsMock).not.toHaveBeenCalled();
    });

    it('returns 403 for non-system admins', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['tenant_admin']));

      const { GET } = await import('@/app/api/admin/tenants/route');
      const response = await GET(buildRequest());

      expect(response.status).toBe(403);
      expect(listTenantsMock).not.toHaveBeenCalled();
    });

    it('returns 401 when context cannot be resolved', async () => {
      getRequestContext.mockRejectedValue(new Error('No tenant context available'));

      const { GET } = await import('@/app/api/admin/tenants/route');
      const response = await GET(buildRequest());

      expect(response.status).toBe(401);
      expect(listTenantsMock).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/tenants/[tenantId]/status', () => {
    const params = { tenantId: 'tenant-1' };

    it('updates tenant status when requested by system admin', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));
      getTenantMock.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.SUSPENDED
      });
      updateTenantStatusMock.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Industries',
        status: TenantStatus.ACTIVE,
        plan: 'pro',
        updatedAt: '2025-01-03T00:00:00Z'
      });

      const { PATCH } = await import('@/app/api/admin/tenants/[tenantId]/status/route');
      const request = buildPatchRequest({ status: 'ACTIVE' });
      const response = await PATCH(request, { params });

      expect(updateTenantStatusMock).toHaveBeenCalledWith('tenant-1', TenantStatus.ACTIVE);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        tenant: {
          id: 'tenant-1',
          name: 'Acme Industries',
          status: TenantStatus.ACTIVE,
          plan: 'pro',
          updatedAt: '2025-01-03T00:00:00Z'
        }
      });
      expect(logTenantLifecycleChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'tenant.status.change',
          newStatus: TenantStatus.ACTIVE
        })
      );
    });

    it('requires a status payload', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));

      const { PATCH } = await import('@/app/api/admin/tenants/[tenantId]/status/route');
      const request = buildPatchRequest({});
      const response = await PATCH(request, { params });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'status_required' });
      expect(updateTenantStatusMock).not.toHaveBeenCalled();
      expect(logTenantLifecycleChangeMock).not.toHaveBeenCalled();
    });

    it('rejects invalid status values', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));

      const { PATCH } = await import('@/app/api/admin/tenants/[tenantId]/status/route');
      const request = buildPatchRequest({ status: 'invalid' });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_status' });
      expect(updateTenantStatusMock).not.toHaveBeenCalled();
      expect(logTenantLifecycleChangeMock).not.toHaveBeenCalled();
    });

    it('returns 403 for non-system admins', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['tenant_admin']));

      const { PATCH } = await import('@/app/api/admin/tenants/[tenantId]/status/route');
      const request = buildPatchRequest({ status: 'active' });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(403);
      expect(updateTenantStatusMock).not.toHaveBeenCalled();
      expect(logTenantLifecycleChangeMock).not.toHaveBeenCalled();
    });

    it('returns 401 when context resolution fails', async () => {
      getRequestContext.mockRejectedValue(new Error('No tenant context available'));

      const { PATCH } = await import('@/app/api/admin/tenants/[tenantId]/status/route');
      const request = buildPatchRequest({ status: 'active' });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(401);
      expect(updateTenantStatusMock).not.toHaveBeenCalled();
      expect(logTenantLifecycleChangeMock).not.toHaveBeenCalled();
    });

    it('requires tenantId parameter', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));

      const { PATCH } = await import('@/app/api/admin/tenants/[tenantId]/status/route');
      const request = buildPatchRequest({ status: 'active' });
      const response = await PATCH(request, { params: { tenantId: '' } });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'missing_tenant_id' });
      expect(updateTenantStatusMock).not.toHaveBeenCalled();
      expect(logTenantLifecycleChangeMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/tenants/[tenantId]/approve', () => {
    const params = { tenantId: 'tenant-1' };

    it('approves tenant and returns success payload', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));
      getTenantMock.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.PENDING,
        name: 'Acme Industries'
      });
      updateTenantStatusMock.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Industries',
        status: TenantStatus.ACTIVE,
        plan: 'pro',
        updatedAt: '2025-01-04T00:00:00Z'
      });

      const { POST } = await import('@/app/api/admin/tenants/[tenantId]/approve/route');
      const request = buildPatchRequest({ comment: 'Looks good' });
      const response = await POST(request, { params });

      expect(updateTenantStatusMock).toHaveBeenCalledWith('tenant-1', TenantStatus.ACTIVE);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: 'success',
        tenant: {
          id: 'tenant-1',
          name: 'Acme Industries',
          status: TenantStatus.ACTIVE,
          plan: 'pro',
          updatedAt: '2025-01-04T00:00:00Z'
        }
      });
      expect(logTenantLifecycleChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'tenant.approved',
          comment: 'Looks good',
          newStatus: TenantStatus.ACTIVE
        })
      );
    });

    it('requires system admin role', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['tenant_admin']));

      const { POST } = await import('@/app/api/admin/tenants/[tenantId]/approve/route');
      const request = buildPatchRequest({ comment: 'ok' });
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
      expect(updateTenantStatusMock).not.toHaveBeenCalled();
      expect(logTenantLifecycleChangeMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/tenants/[tenantId]/suspend', () => {
    const params = { tenantId: 'tenant-1' };

    it('suspends tenant when reason provided', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));
      getTenantMock.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.ACTIVE,
        name: 'Acme Industries'
      });
      updateTenantStatusMock.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Industries',
        status: TenantStatus.SUSPENDED,
        plan: 'pro',
        updatedAt: '2025-01-05T00:00:00Z'
      });

      const { POST } = await import('@/app/api/admin/tenants/[tenantId]/suspend/route');
      const request = buildPatchRequest({ reason: 'Billing delinquent' });
      const response = await POST(request, { params });

      expect(updateTenantStatusMock).toHaveBeenCalledWith('tenant-1', TenantStatus.SUSPENDED);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: 'success',
        tenant: {
          id: 'tenant-1',
          name: 'Acme Industries',
          status: TenantStatus.SUSPENDED,
          plan: 'pro',
          updatedAt: '2025-01-05T00:00:00Z'
        }
      });
      expect(logTenantLifecycleChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'tenant.suspended',
          reason: 'Billing delinquent',
          newStatus: TenantStatus.SUSPENDED
        })
      );
    });

    it('requires a reason for suspension', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));

      const { POST } = await import('@/app/api/admin/tenants/[tenantId]/suspend/route');
      const request = buildPatchRequest({ reason: '' });
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'reason_required' });
      expect(updateTenantStatusMock).not.toHaveBeenCalled();
      expect(logTenantLifecycleChangeMock).not.toHaveBeenCalled();
    });

    it('requires system admin role', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['tenant_admin']));

      const { POST } = await import('@/app/api/admin/tenants/[tenantId]/suspend/route');
      const request = buildPatchRequest({ reason: 'No longer active' });
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
      expect(updateTenantStatusMock).not.toHaveBeenCalled();
      expect(logTenantLifecycleChangeMock).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/tenants/[tenantId]/audit', () => {
    const params = { tenantId: 'tenant-1' };

    it('returns audit history for system admins', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['system_admin']));
      getTenantLifecycleLogMock.mockResolvedValue([
        {
          id: 'log-1',
          tenantId: 'tenant-1',
          targetId: 'tenant-1',
          targetType: 'tenant',
          action: 'tenant.approved',
          actor: { id: 'user-1', email: 'admin@example.com', roles: ['system_admin'] },
          reason: null,
          comment: 'All good',
          metadata: { previousStatus: 'pending', newStatus: 'active' },
          createdAt: '2025-01-06T00:00:00Z'
        }
      ]);

      const { GET } = await import('@/app/api/admin/tenants/[tenantId]/audit/route');
      const request = buildRequest();
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        tenantId: 'tenant-1',
        events: [
          {
            id: 'log-1',
            timestamp: '2025-01-06T00:00:00Z',
            action: 'approved',
            actor: {
              id: 'user-1',
              name: 'admin@example.com',
              email: 'admin@example.com',
              role: 'system_admin'
            },
            metadata: {
              previousStatus: 'pending',
              newStatus: 'active',
              reason: null,
              comment: 'All good',
              changes: undefined
            }
          }
        ]
      });
      expect(getTenantLifecycleLogMock).toHaveBeenCalledWith('tenant-1', 100);
    });

    it('requires system admin role', async () => {
      getRequestContext.mockResolvedValue(resolveContext(['tenant_admin']));

      const { GET } = await import('@/app/api/admin/tenants/[tenantId]/audit/route');
      const request = buildRequest();
      const response = await GET(request, { params });

      expect(response.status).toBe(403);
      expect(getTenantLifecycleLogMock).not.toHaveBeenCalled();
    });
  });
});

/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/admin/tenants/page.tsx
 * phase: 3
 * domain: admin
 * purpose: Tenant management view for system admins (Phase 3.3.1)
 * spec_ref: docs/admin-ui-specs.md#tenant-management
 * complexity_budget: 220
 * dependencies: {
 *   internal: ['@/components/ui/card', '@/components/ui/badge', '@/components/ui/input', '@/components/ui/button'],
 *   external: ['react']
 * }
 */

'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Filter, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  X
} from 'lucide-react';
import {
  ADMIN_STATUS_COLORS,
  ADMIN_PLAN_COLORS,
  ADMIN_CARD_CLASSES,
  ADMIN_CARD_ITEM_CLASSES,
  getStatusBadgeClass,
  getPlanBadgeClass
} from '../_constants/admin-ui-constants';
import { TenantDetailModal, type TenantDetail } from '@/components/admin/TenantDetailModal';

type TenantStatus = 'pending' | 'active' | 'suspended' | 'expired' | 'cancelled';

interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: TenantStatus;
  plan: string | null;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  memberCount: number;
  usage: {
    activeUsers: number;
    jobsLast30d: number;
  };
}

// Using shared constants from admin-ui-constants.ts

const FILTER_PRESETS: { label: string; value: TenantStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Expired', value: 'expired' },
  { label: 'Cancelled', value: 'cancelled' }
];

interface StatusChangeModal {
  isOpen: boolean;
  tenantId: string | null;
  tenantName: string;
  action: 'approve' | 'suspend' | null;
  reason: string;
}

export default function TenantManagementPage() {
  const [filter, setFilter] = useState<TenantStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<StatusChangeModal>({
    isOpen: false,
    tenantId: null,
    tenantName: '',
    action: null,
    reason: ''
  });
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const matchesFilter = filter === 'all' || tenant.status === filter;
      const matchesQuery =
        query.length === 0 ||
        tenant.name.toLowerCase().includes(query.toLowerCase()) ||
        tenant.slug?.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, tenants]);

  const loadTenants = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const response = await fetch('/api/admin/tenants');
      if (!response.ok) {
        throw new Error(`Failed to load tenants (${response.status})`);
      }
      const payload = (await response.json()) as { data: TenantSummary[] };
      setTenants(payload.data ?? []);
    } catch (err) {
      console.error('Failed to load tenants', err);
      setError('Unable to load tenants. Try again later.');
    } finally {
      if (mode === 'initial') {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const openStatusModal = (tenant: TenantSummary, action: 'approve' | 'suspend') => {
    setStatusModal({
      isOpen: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      action,
      reason: ''
    });
  };

  const closeStatusModal = () => {
    setStatusModal({
      isOpen: false,
      tenantId: null,
      tenantName: '',
      action: null,
      reason: ''
    });
  };

  const handleStatusChange = async () => {
    if (!statusModal.tenantId || !statusModal.action) return;

    const endpointBase = `/api/admin/tenants/${statusModal.tenantId}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      let response: Response;

      if (statusModal.action === 'approve') {
        response = await fetch(`${endpointBase}/approve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ comment: statusModal.reason || 'Approved by system admin' })
        });
      } else if (statusModal.action === 'suspend') {
        response = await fetch(`${endpointBase}/suspend`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason: statusModal.reason || 'Suspended by system admin' })
        });
      } else {
        throw new Error('Invalid action');
      }

      if (!response.ok) {
        throw new Error(`Failed to update tenant (${response.status})`);
      }

      const { tenant } = (await response.json()) as {
        tenant: {
          id: string;
          status: TenantStatus;
          plan: string | null;
          updatedAt: string;
        };
      };
      setTenants((prev) =>
        prev.map((item) =>
          item.id === tenant.id
            ? {
                ...item,
                status: tenant.status,
                plan: tenant.plan,
                updatedAt: tenant.updatedAt,
                lastActiveAt: tenant.status === 'active' ? tenant.updatedAt : item.lastActiveAt
              }
            : item
        )
      );
      
      closeStatusModal();
    } catch (err) {
      console.error('Failed to update tenant status', err);
      setError('Failed to update tenant status. Try again later.');
    }
  };

  const handleRefresh = () => {
    loadTenants('refresh');
  };

  const formatPlan = (plan: string | null) => {
    if (!plan) return 'No Plan';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const handleViewDetails = (tenant: TenantSummary) => {
    // Convert TenantSummary to the format expected by TenantDetailModal.
    // Until the backend surfaces full usage metrics, provide conservative defaults.
    const tenantDetail: TenantDetail = {
      ...tenant,
      lastActiveAt: tenant.lastActiveAt ?? null,
      plan: tenant.plan,
      usage: {
        activeUsers: tenant.usage.activeUsers,
        jobsLast30d: tenant.usage.jobsLast30d,
        totalJobs: tenant.usage.jobsLast30d,
        storageUsedMB: 0,
      },
      contact: undefined,
      billing: undefined,
      integrations: undefined,
    };
    setSelectedTenant(tenantDetail);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Tenant Management</h2>
            <p className="text-sm text-slate-400">
              Approve new tenants, monitor usage, and manage lifecycle states.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-200"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
              Sync from Supabase
            </Button>
            <Button size="sm" className="bg-emerald-500 text-black hover:bg-emerald-400">
              New Tenant
            </Button>
          </div>
        </div>

        <Card className={ADMIN_CARD_CLASSES}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Filter className="h-4 w-4 text-slate-500" />
              <span>Filter by status:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTER_PRESETS.map((preset) => {
                const isActive = filter === preset.value;
                return (
                  <Button
                    key={preset.value}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={
                      isActive
                        ? 'bg-slate-200 text-slate-900 hover:bg-slate-100'
                        : 'border-slate-700 text-slate-300 hover:bg-slate-800/80'
                    }
                    onClick={() => setFilter(preset.value)}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
            <Input
              placeholder="Search tenants by name or domain"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-[220px] border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader className="pb-3">
            <CardTitle className="text-white">Tenants</CardTitle>
            <p className="text-sm text-slate-400">
              {filteredTenants.length} result{filteredTenants.length === 1 ? '' : 's'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            {isLoading && tenants.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                Loading tenants…
              </div>
            )}

            {!isLoading &&
              filteredTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className={ADMIN_CARD_ITEM_CLASSES}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{tenant.name}</h3>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                          {tenant.domain || tenant.slug}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>Created {new Date(tenant.createdAt).toLocaleDateString()}</span>
                        <Separator orientation="vertical" className="h-3 bg-slate-700" />
                        <span>
                          Last active{' '}
                          {tenant.lastActiveAt
                            ? new Date(tenant.lastActiveAt).toLocaleString()
                            : 'Not yet active'}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-slate-300">
                        <span>{tenant.memberCount} members</span>
                        <span>{tenant.usage.jobsLast30d} jobs in last 30d</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getStatusBadgeClass(tenant.status)}>
                        {tenant.status.toUpperCase()}
                      </Badge>
                      <Badge
                        className={
                          tenant.plan
                            ? getPlanBadgeClass(tenant.plan as keyof typeof ADMIN_PLAN_COLORS)
                            : 'bg-slate-800/60 text-slate-300'
                        }
                      >
                        {formatPlan(tenant.plan)}
                      </Badge>
                      <div className="mt-2 flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-slate-700 text-slate-200"
                          onClick={() => handleViewDetails(tenant)}
                        >
                          View
                        </Button>
                        {tenant.status === 'pending' ? (
                          <Button
                            size="sm"
                            className="bg-emerald-500 text-black hover:bg-emerald-400"
                            onClick={() => openStatusModal(tenant, 'approve')}
                          >
                            Approve
                          </Button>
                        ) : tenant.status === 'active' ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="bg-rose-500/90 text-white hover:bg-rose-500"
                            onClick={() => openStatusModal(tenant, 'suspend')}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-sky-500 text-black hover:bg-sky-400"
                            onClick={() => openStatusModal(tenant, 'approve')}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            {!isLoading && filteredTenants.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                No tenants match the current filters.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Status Change Modal */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  {statusModal.action === 'approve' ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                      Approve Tenant
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      Suspend Tenant
                    </>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeStatusModal}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-sm text-slate-400">
                  {statusModal.action === 'approve' ? 'Approving' : 'Suspending'} tenant:
                </p>
                <p className="mt-1 text-base font-semibold text-white">
                  {statusModal.tenantName}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {statusModal.action === 'approve' ? 'Comment (Optional)' : 'Reason (Required)'}
                </label>
                <textarea
                  value={statusModal.reason}
                  onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={
                    statusModal.action === 'approve'
                      ? 'Add any notes about this approval...'
                      : 'Please provide a reason for suspension...'
                  }
                  autoFocus
                />
              </div>

              {statusModal.action === 'suspend' && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-400" />
                    <div className="text-sm text-yellow-300">
                      <p className="font-medium">Important</p>
                      <p className="mt-1 text-yellow-300/80">
                        Suspending this tenant will immediately revoke access for all their users.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={closeStatusModal}
                  className="flex-1 border-slate-700 text-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStatusChange}
                  disabled={statusModal.action === 'suspend' && !statusModal.reason.trim()}
                  className={`flex-1 ${
                    statusModal.action === 'approve'
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                      : 'bg-red-500 text-white hover:bg-red-400'
                  }`}
                >
                  {statusModal.action === 'approve' ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve Tenant
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Suspend Tenant
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tenant Detail Modal */}
      <TenantDetailModal 
        tenant={selectedTenant}
        isOpen={!!selectedTenant}
        onClose={() => setSelectedTenant(null)}
      />
    </div>
  );
}

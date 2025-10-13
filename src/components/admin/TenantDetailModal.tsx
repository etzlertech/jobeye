/**
 * @file /src/components/admin/TenantDetailModal.tsx
 * @purpose Modal component for viewing detailed tenant information including audit history
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TenantAuditHistory, type AuditEvent } from './TenantAuditHistory';
import { 
  getStatusBadgeClass, 
  getPlanBadgeClass,
  ADMIN_PLAN_COLORS 
} from '@/app/admin/_constants/admin-ui-constants';
import {
  X,
  Building2,
  Users,
  Calendar,
  Globe,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Activity,
  FileText,
  ExternalLink
} from 'lucide-react';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: 'pending' | 'active' | 'suspended' | 'expired' | 'cancelled';
  plan: string | null;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  memberCount: number;
  usage: {
    activeUsers: number;
    jobsLast30d: number;
    totalJobs: number;
    storageUsedMB: number;
  };
  contact?: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  billing?: {
    status: 'current' | 'overdue' | 'cancelled';
    nextBillingDate?: string;
    monthlyAmount?: number;
    paymentMethod?: string;
  };
  integrations?: {
    voice: boolean;
    vision: boolean;
    webhook?: string;
  };
}

interface TenantDetailModalProps {
  tenant: TenantDetail | null;
  isOpen: boolean;
  onClose: () => void;
  auditEvents?: AuditEvent[];
}

export function TenantDetailModal({
  tenant,
  isOpen,
  onClose,
  auditEvents
}: TenantDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'billing' | 'history'>('overview');
  const [fetchedAuditEvents, setFetchedAuditEvents] = useState<AuditEvent[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  useEffect(() => {
    if (isOpen && tenant && activeTab === 'history') {
      // Fetch audit history when history tab is selected
      const fetchAuditHistory = async () => {
        setIsLoadingAudit(true);
        try {
          const response = await fetch(`/api/admin/tenants/${tenant.id}/audit`);
          if (response.ok) {
            const { events } = await response.json();
            const mappedEvents: AuditEvent[] = events.map((event: any) => ({
              id: event.id,
              timestamp: event.createdAt,
              action: event.action,
              actor: {
                id: event.actorId || 'system',
                name: event.actorEmail?.split('@')[0] || 'System',
                email: event.actorEmail || 'system@jobeye.com',
                role: event.actorRoles?.[0] || 'system'
              },
              metadata: {
                reason: event.reason,
                comment: event.comment,
                ...event.metadata
              }
            }));
            setFetchedAuditEvents(mappedEvents);
          }
        } catch (error) {
          console.error('Failed to fetch audit history:', error);
        } finally {
          setIsLoadingAudit(false);
        }
      };
      fetchAuditHistory();
    }
  }, [isOpen, tenant, activeTab]);

  if (!isOpen || !tenant) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const formatPlan = (plan: string | null) => {
    if (!plan) return 'No Plan';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-xl text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800">
                  <Building2 className="h-5 w-5 text-blue-400" />
                </div>
                {tenant.name}
              </CardTitle>
              <div className="mt-2 flex items-center gap-3">
                <Badge className={getStatusBadgeClass(tenant.status)}>
                  {tenant.status.toUpperCase()}
                </Badge>
                <Badge className={getPlanBadgeClass(tenant.plan as keyof typeof ADMIN_PLAN_COLORS)}>
                  {formatPlan(tenant.plan)}
                </Badge>
                {tenant.domain && (
                  <Badge variant="outline" className="border-slate-700 text-slate-300">
                    <Globe className="mr-1 h-3 w-3" />
                    {tenant.domain}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Tabs */}
        <div className="border-b border-slate-800 px-6">
          <div className="flex gap-6">
            {(['overview', 'usage', 'billing', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <CardContent className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="mb-4 text-base font-medium text-white">Basic Information</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">Tenant ID</p>
                    <p className="mt-1 font-mono text-sm text-white">{tenant.id}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">Slug</p>
                    <p className="mt-1 text-sm text-white">{tenant.slug}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">Created</p>
                    <p className="mt-1 text-sm text-white">{formatDate(tenant.createdAt)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">Last Active</p>
                    <p className="mt-1 text-sm text-white">{formatDate(tenant.lastActiveAt)}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              {tenant.contact && (
                <div>
                  <h3 className="mb-4 text-base font-medium text-white">Primary Contact</h3>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-white">{tenant.contact.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <a href={`mailto:${tenant.contact.email}`} className="text-sm text-blue-400 hover:underline">
                        {tenant.contact.email}
                      </a>
                    </div>
                    {tenant.contact.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-white">{tenant.contact.phone}</span>
                      </div>
                    )}
                    {tenant.contact.address && (
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-white">{tenant.contact.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Integrations */}
              {tenant.integrations && (
                <div>
                  <h3 className="mb-4 text-base font-medium text-white">Integrations</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <span className="text-sm text-slate-300">Voice Commands</span>
                      <Badge className={tenant.integrations.voice ? 'bg-green-500/10 text-green-300' : 'bg-slate-700 text-slate-400'}>
                        {tenant.integrations.voice ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <span className="text-sm text-slate-300">Vision Analysis</span>
                      <Badge className={tenant.integrations.vision ? 'bg-green-500/10 text-green-300' : 'bg-slate-700 text-slate-400'}>
                        {tenant.integrations.vision ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    {tenant.integrations.webhook && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-sm text-slate-300">Webhook URL</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-xs text-slate-400 font-mono truncate">{tenant.integrations.webhook}</p>
                          <ExternalLink className="h-3 w-3 text-slate-500" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Usage Tab */}
          {activeTab === 'usage' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="h-4 w-4" />
                    <p className="text-sm">Total Members</p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">{tenant.memberCount}</p>
                  <p className="text-xs text-slate-500">All time</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Activity className="h-4 w-4" />
                    <p className="text-sm">Active Users</p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">{tenant.usage.activeUsers}</p>
                  <p className="text-xs text-slate-500">Last 30 days</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <FileText className="h-4 w-4" />
                    <p className="text-sm">Jobs (30d)</p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">{tenant.usage.jobsLast30d}</p>
                  <p className="text-xs text-slate-500">Total: {tenant.usage.totalJobs}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <FileText className="h-4 w-4" />
                    <p className="text-sm">Storage</p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">{(tenant.usage.storageUsedMB / 1024).toFixed(1)}GB</p>
                  <p className="text-xs text-slate-500">Used</p>
                </div>
              </div>

              {/* Usage trends would go here */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
                <Activity className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-2 text-sm text-slate-400">
                  Usage trends and analytics coming soon
                </p>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {tenant.billing ? (
                <>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-medium text-white">Billing Status</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {tenant.billing.status === 'current' ? 'All payments up to date' :
                           tenant.billing.status === 'overdue' ? 'Payment overdue' :
                           'Billing cancelled'}
                        </p>
                      </div>
                      <Badge className={
                        tenant.billing.status === 'current' ? 'bg-green-500/10 text-green-300' :
                        tenant.billing.status === 'overdue' ? 'bg-red-500/10 text-red-300' :
                        'bg-slate-700 text-slate-400'
                      }>
                        {tenant.billing.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-sm text-slate-400">Monthly Amount</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          ${tenant.billing.monthlyAmount?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Next Billing Date</p>
                        <p className="mt-1 text-sm text-white">
                          {tenant.billing.nextBillingDate ? formatDate(tenant.billing.nextBillingDate) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Payment Method</p>
                        <p className="mt-1 text-sm text-white">
                          {tenant.billing.paymentMethod || 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
                    <CreditCard className="mx-auto h-8 w-8 text-slate-500" />
                    <p className="mt-2 text-sm text-slate-400">
                      Detailed billing history and invoices coming soon
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
                  <CreditCard className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="mt-2 text-sm text-slate-400">
                    No billing information available
                  </p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <TenantAuditHistory
              tenantId={tenant.id}
              tenantName={tenant.name}
              events={fetchedAuditEvents}
              isLoading={isLoadingAudit}
              maxHeight="none"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
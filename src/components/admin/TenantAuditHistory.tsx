/**
 * @file /src/components/admin/TenantAuditHistory.tsx
 * @purpose Reusable audit history component for displaying tenant lifecycle events
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ADMIN_CARD_CLASSES } from '@/app/admin/_constants/admin-ui-constants';
import {
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Clock,
  Shield,
  Edit,
  MessageSquare,
  FileText
} from 'lucide-react';

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: 'created' | 'approved' | 'suspended' | 'reactivated' | 'updated' | 'comment';
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  metadata?: {
    previousStatus?: string;
    newStatus?: string;
    reason?: string;
    comment?: string;
    changes?: Record<string, { from: any; to: any }>;
  };
}

interface TenantAuditHistoryProps {
  tenantId: string;
  tenantName?: string;
  events?: AuditEvent[];
  isLoading?: boolean;
  maxHeight?: string;
}

const ACTION_CONFIG = {
  created: {
    label: 'Created',
    icon: User,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10'
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10'
  },
  suspended: {
    label: 'Suspended',
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10'
  },
  reactivated: {
    label: 'Reactivated',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10'
  },
  updated: {
    label: 'Updated',
    icon: Edit,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10'
  },
  comment: {
    label: 'Comment',
    icon: MessageSquare,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10'
  }
};

// Mock data for demonstration
const MOCK_EVENTS: AuditEvent[] = [
  {
    id: 'evt_005',
    timestamp: '2025-10-13T14:30:00Z',
    action: 'comment',
    actor: {
      id: 'admin_001',
      name: 'System Admin',
      email: 'admin@jobeye.com',
      role: 'system_admin'
    },
    metadata: {
      comment: 'Following up on integration setup. All systems operational.'
    }
  },
  {
    id: 'evt_004',
    timestamp: '2025-10-12T10:15:00Z',
    action: 'approved',
    actor: {
      id: 'admin_001',
      name: 'System Admin',
      email: 'admin@jobeye.com',
      role: 'system_admin'
    },
    metadata: {
      previousStatus: 'pending',
      newStatus: 'active',
      comment: 'All verification documents checked. Welcome aboard!'
    }
  },
  {
    id: 'evt_003',
    timestamp: '2025-10-10T16:45:00Z',
    action: 'updated',
    actor: {
      id: 'tenant_admin_001',
      name: 'Sarah Johnson',
      email: 'sarah@greenworks.land',
      role: 'tenant_admin'
    },
    metadata: {
      changes: {
        plan: { from: 'trial', to: 'pro' },
        billing_email: { from: 'billing@greenworks.land', to: 'accounts@greenworks.land' }
      }
    }
  },
  {
    id: 'evt_002',
    timestamp: '2025-10-08T09:00:00Z',
    action: 'created',
    actor: {
      id: 'tenant_admin_001',
      name: 'Sarah Johnson',
      email: 'sarah@greenworks.land',
      role: 'tenant_admin'
    },
    metadata: {
      newStatus: 'pending'
    }
  }
];

export function TenantAuditHistory({
  tenantId,
  tenantName,
  events,
  isLoading = false,
  maxHeight = '400px'
}: TenantAuditHistoryProps) {
  // Only use mock events if no events are provided and not loading
  const displayEvents = events || (!isLoading ? MOCK_EVENTS : []);
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderEventDetails = (event: AuditEvent) => {
    const { metadata } = event;
    if (!metadata) return null;

    if (event.action === 'approved' || event.action === 'suspended' || event.action === 'reactivated') {
      return (
        <>
          {metadata.previousStatus && metadata.newStatus && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge className="bg-slate-700 text-slate-300">
                {metadata.previousStatus}
              </Badge>
              <span className="text-slate-500">→</span>
              <Badge className={
                metadata.newStatus === 'active' ? 'bg-emerald-500/10 text-emerald-300' :
                metadata.newStatus === 'suspended' ? 'bg-red-500/10 text-red-300' :
                'bg-slate-700 text-slate-300'
              }>
                {metadata.newStatus}
              </Badge>
            </div>
          )}
          {(metadata.reason || metadata.comment) && (
            <div className="mt-2 rounded-md bg-slate-800/50 p-3">
              <p className="text-sm text-slate-300">
                {metadata.reason || metadata.comment}
              </p>
            </div>
          )}
        </>
      );
    }

    if (event.action === 'updated' && metadata.changes) {
      return (
        <div className="mt-2 space-y-1">
          {Object.entries(metadata.changes).map(([field, change]) => (
            <div key={field} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="capitalize">{field.replace(/_/g, ' ')}:</span>
              <span className="text-slate-500">{String(change.from)}</span>
              <span>→</span>
              <span className="text-slate-300">{String(change.to)}</span>
            </div>
          ))}
        </div>
      );
    }

    if (event.action === 'comment' && metadata.comment) {
      return (
        <div className="mt-2 rounded-md bg-slate-800/50 p-3">
          <p className="text-sm text-slate-300">{metadata.comment}</p>
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <Card className={ADMIN_CARD_CLASSES}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <History className="h-5 w-5" />
            Audit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-solid border-slate-600 border-r-transparent" />
              <p className="mt-2 text-sm text-slate-400">Loading audit history...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={ADMIN_CARD_CLASSES}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <History className="h-5 w-5" />
          Audit History
          {tenantName && (
            <span className="text-sm font-normal text-slate-400">
              for {tenantName}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayEvents.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-2 text-sm text-slate-400">
              No audit history available
            </p>
          </div>
        ) : (
          <ScrollArea className={`pr-4`} style={{ maxHeight }}>
            <div className="space-y-4">
              {displayEvents.map((event, index) => {
                const config = ACTION_CONFIG[event.action];
                const Icon = config.icon;

                return (
                  <div key={event.id} className="relative">
                    {/* Timeline connector */}
                    {index < displayEvents.length - 1 && (
                      <div className="absolute left-5 top-10 h-full w-px bg-slate-700" />
                    )}

                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`relative z-10 rounded-full p-2 ${config.bgColor}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {event.actor.name}
                          </span>
                          <span className="text-sm text-slate-400">
                            {config.label.toLowerCase()} this tenant
                          </span>
                          <Badge className="bg-slate-700 text-slate-300 text-xs">
                            {event.actor.role.replace('_', ' ')}
                          </Badge>
                        </div>

                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(event.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{event.actor.email}</span>
                          </div>
                        </div>

                        {renderEventDetails(event)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
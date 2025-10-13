/**
 * @file /src/app/tenant-admin/approvals/page.tsx
 * @phase 3.4.2
 * @domain tenant-admin
 * @purpose Approval workflows for tenant administrators
 * @spec_ref docs/admin-ui-specs.md#approval-rejection-workflows
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ADMIN_CARD_CLASSES, 
  ADMIN_CARD_ITEM_CLASSES 
} from '@/app/admin/_constants/admin-ui-constants';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Users,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  FileText,
  Calendar,
  Filter,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

type ApprovalType = 'user_invite' | 'role_change' | 'integration' | 'access_request';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  requester: {
    id: string;
    name: string | null;
    email: string;
  };
  submittedAt: string;
  payload: Record<string, any>;
  history: Array<{
    id: string;
    actor: string;
    action: 'submitted' | 'commented' | 'approved' | 'rejected';
    comment?: string;
    timestamp: string;
  }>;
}

// Mock data
const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    id: 'apr_001',
    type: 'user_invite',
    status: 'pending',
    requester: {
      id: 'usr_sarah',
      name: 'Sarah Johnson',
      email: 'sarah@greenworks.land'
    },
    submittedAt: '2025-10-13T10:00:00Z',
    payload: {
      inviteeEmail: 'mike.chen@greenworks.land',
      inviteeName: 'Mike Chen',
      requestedRole: 'supervisor',
      reason: 'New supervisor for north region crews'
    },
    history: [
      {
        id: 'hist_001',
        actor: 'Sarah Johnson',
        action: 'submitted',
        comment: 'Mike has 5 years of experience and will manage our north region crews.',
        timestamp: '2025-10-13T10:00:00Z'
      }
    ]
  },
  {
    id: 'apr_002',
    type: 'role_change',
    status: 'pending',
    requester: {
      id: 'usr_mike',
      name: 'Mike Torres',
      email: 'mike@greenworks.land'
    },
    submittedAt: '2025-10-12T14:30:00Z',
    payload: {
      targetUser: 'Alex Rivera',
      targetEmail: 'alex@greenworks.land',
      currentRole: 'crew',
      requestedRole: 'supervisor',
      reason: 'Promotion based on excellent performance'
    },
    history: [
      {
        id: 'hist_002',
        actor: 'Mike Torres',
        action: 'submitted',
        comment: 'Alex has shown exceptional leadership skills and completed advanced training.',
        timestamp: '2025-10-12T14:30:00Z'
      }
    ]
  },
  {
    id: 'apr_003',
    type: 'integration',
    status: 'pending',
    requester: {
      id: 'usr_sarah',
      name: 'Sarah Johnson',
      email: 'sarah@greenworks.land'
    },
    submittedAt: '2025-10-11T09:15:00Z',
    payload: {
      integrationType: 'webhook',
      webhookUrl: 'https://api.greenworks.land/jobeye-events',
      events: ['job.created', 'job.completed', 'user.login']
    },
    history: [
      {
        id: 'hist_003',
        actor: 'Sarah Johnson',
        action: 'submitted',
        comment: 'Need webhook integration for our internal dashboard.',
        timestamp: '2025-10-11T09:15:00Z'
      }
    ]
  },
  {
    id: 'apr_004',
    type: 'role_change',
    status: 'approved',
    requester: {
      id: 'usr_sarah',
      name: 'Sarah Johnson',
      email: 'sarah@greenworks.land'
    },
    submittedAt: '2025-10-10T11:00:00Z',
    payload: {
      targetUser: 'Jamie Kim',
      currentRole: 'crew',
      requestedRole: 'supervisor'
    },
    history: [
      {
        id: 'hist_004a',
        actor: 'Sarah Johnson',
        action: 'submitted',
        timestamp: '2025-10-10T11:00:00Z'
      },
      {
        id: 'hist_004b',
        actor: 'System Admin',
        action: 'approved',
        comment: 'Approved based on tenure and training completion.',
        timestamp: '2025-10-10T15:30:00Z'
      }
    ]
  },
  {
    id: 'apr_005',
    type: 'user_invite',
    status: 'rejected',
    requester: {
      id: 'usr_mike',
      name: 'Mike Torres',
      email: 'mike@greenworks.land'
    },
    submittedAt: '2025-10-09T16:45:00Z',
    payload: {
      inviteeEmail: 'contractor@external.com',
      requestedRole: 'crew'
    },
    history: [
      {
        id: 'hist_005a',
        actor: 'Mike Torres',
        action: 'submitted',
        timestamp: '2025-10-09T16:45:00Z'
      },
      {
        id: 'hist_005b',
        actor: 'Sarah Johnson',
        action: 'rejected',
        comment: 'External contractors need a different onboarding process. Please use the contractor portal.',
        timestamp: '2025-10-09T17:00:00Z'
      }
    ]
  }
];

const TYPE_CONFIG = {
  user_invite: {
    label: 'User Invitation',
    icon: User,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10'
  },
  role_change: {
    label: 'Role Change',
    icon: Users,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10'
  },
  integration: {
    label: 'Integration',
    icon: ArrowRight,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10'
  },
  access_request: {
    label: 'Access Request',
    icon: FileText,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10'
  }
};

export default function TenantApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | ApprovalStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ApprovalType>('all');
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const filteredApprovals = MOCK_APPROVALS.filter(approval => {
    const matchesStatus = statusFilter === 'all' || approval.status === statusFilter;
    const matchesType = typeFilter === 'all' || approval.type === typeFilter;
    return matchesStatus && matchesType;
  });

  const pendingCount = MOCK_APPROVALS.filter(a => a.status === 'pending').length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleApprove = (requestId: string) => {
    // TODO: API call to approve request
    console.log('Approving request:', requestId, 'with comment:', approvalComment);
    setSelectedRequest(null);
    setApprovalComment('');
  };

  const handleReject = (requestId: string) => {
    // TODO: API call to reject request
    console.log('Rejecting request:', requestId, 'with comment:', approvalComment);
    setSelectedRequest(null);
    setApprovalComment('');
  };

  const renderPayloadDetails = (type: ApprovalType, payload: Record<string, any>) => {
    switch (type) {
      case 'user_invite':
        return (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-400">Invitee</span>
              <span className="text-sm text-white">{payload.inviteeName} ({payload.inviteeEmail})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-400">Requested Role</span>
              <Badge className="bg-blue-500/10 text-blue-300">{payload.requestedRole}</Badge>
            </div>
            {payload.reason && (
              <div>
                <span className="text-sm text-slate-400">Reason</span>
                <p className="mt-1 text-sm text-slate-300">{payload.reason}</p>
              </div>
            )}
          </div>
        );
      
      case 'role_change':
        return (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-400">User</span>
              <span className="text-sm text-white">{payload.targetUser}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Role Change</span>
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-500/10 text-slate-300">{payload.currentRole}</Badge>
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <Badge className="bg-purple-500/10 text-purple-300">{payload.requestedRole}</Badge>
              </div>
            </div>
            {payload.reason && (
              <div>
                <span className="text-sm text-slate-400">Reason</span>
                <p className="mt-1 text-sm text-slate-300">{payload.reason}</p>
              </div>
            )}
          </div>
        );
      
      case 'integration':
        return (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-400">Type</span>
              <span className="text-sm text-white capitalize">{payload.integrationType}</span>
            </div>
            {payload.webhookUrl && (
              <div>
                <span className="text-sm text-slate-400">Webhook URL</span>
                <p className="mt-1 text-xs text-slate-300 font-mono bg-slate-800/50 p-2 rounded">
                  {payload.webhookUrl}
                </p>
              </div>
            )}
            {payload.events && (
              <div>
                <span className="text-sm text-slate-400">Events</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {payload.events.map((event: string) => (
                    <Badge key={event} className="bg-slate-700 text-slate-300 text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Approval Workflows</h2>
            <p className="text-sm text-slate-400">
              Review and manage pending requests for your organization.
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="w-fit">
              {pendingCount} pending approval{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Filters */}
        <Card className={ADMIN_CARD_CLASSES}>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-400">Filter by:</span>
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200"
              >
                <option value="all">All Types</option>
                <option value="user_invite">User Invitations</option>
                <option value="role_change">Role Changes</option>
                <option value="integration">Integrations</option>
                <option value="access_request">Access Requests</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Approvals List */}
      <section>
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock className="w-5 h-5" />
              Approval Queue ({filteredApprovals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredApprovals.map((approval) => {
              const config = TYPE_CONFIG[approval.type];
              const Icon = config.icon;
              const isExpanded = expandedRequest === approval.id;
              
              return (
                <div
                  key={approval.id}
                  className={ADMIN_CARD_ITEM_CLASSES}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-md p-2 ${config.bgColor}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-white">
                              {config.label}
                            </h3>
                            <Badge className={
                              approval.status === 'pending' ? 'bg-yellow-500/10 text-yellow-300' :
                              approval.status === 'approved' ? 'bg-green-500/10 text-green-300' :
                              'bg-red-500/10 text-red-300'
                            }>
                              {approval.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-400">
                            Requested by {approval.requester.name} • {formatDate(approval.submittedAt)}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedRequest(isExpanded ? null : approval.id)}
                        className="text-slate-400"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </div>

                    {/* Expandable Content */}
                    {isExpanded && (
                      <>
                        <Separator className="bg-slate-700" />
                        
                        {/* Payload Details */}
                        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
                          {renderPayloadDetails(approval.type, approval.payload)}
                        </div>

                        {/* History */}
                        <div>
                          <h4 className="mb-3 text-sm font-medium text-white flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Activity History
                          </h4>
                          <div className="space-y-3">
                            {approval.history.map((event) => (
                              <div key={event.id} className="flex gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400">
                                  {event.actor.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-white">{event.actor}</span>
                                    <span className="text-xs text-slate-500">
                                      {event.action} • {formatDate(event.timestamp)}
                                    </span>
                                  </div>
                                  {event.comment && (
                                    <p className="mt-1 text-sm text-slate-400">{event.comment}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        {approval.status === 'pending' && (
                          <>
                            <Separator className="bg-slate-700" />
                            <div className="space-y-3">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">
                                  Decision Comment (Optional)
                                </label>
                                <textarea
                                  value={selectedRequest === approval.id ? approvalComment : ''}
                                  onChange={(e) => {
                                    setSelectedRequest(approval.id);
                                    setApprovalComment(e.target.value);
                                  }}
                                  rows={3}
                                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                                  placeholder="Add a comment for the audit trail..."
                                />
                              </div>
                              <div className="flex gap-3">
                                <Button
                                  onClick={() => handleReject(approval.id)}
                                  variant="outline"
                                  className="flex-1 border-red-700 text-red-300 hover:bg-red-900/20"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                                <Button
                                  onClick={() => handleApprove(approval.id)}
                                  className="flex-1 bg-green-500 text-white hover:bg-green-400"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Approve
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredApprovals.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center">
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-slate-500" />
                <p className="text-sm text-slate-400">
                  No approval requests match the current filters.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
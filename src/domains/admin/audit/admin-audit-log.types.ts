/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/domains/admin/audit/admin-audit-log.types.ts
 * phase: 3
 * domain: admin
 * purpose: Shared types for admin audit logging workflow
 * spec_ref: admin-ui-specs.md#tenant-management
 * complexity_budget: 80
 * dependencies: {}
 */

export type AdminAuditAction =
  | 'tenant.status.change'
  | 'tenant.approved'
  | 'tenant.suspended'
  | 'tenant.updated';

export interface AdminAuditActor {
  id?: string;
  email?: string;
  roles: string[];
}

export interface AdminAuditLogInsert {
  tenantId?: string | null;
  targetId: string;
  targetType: 'tenant' | 'user' | 'system';
  action: AdminAuditAction;
  actor: AdminAuditActor;
  reason?: string | null;
  comment?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdminAuditLogEntry extends AdminAuditLogInsert {
  id: string;
  createdAt: string;
}

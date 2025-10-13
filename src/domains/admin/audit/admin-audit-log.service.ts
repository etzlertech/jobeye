/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/domains/admin/audit/admin-audit-log.service.ts
 * phase: 3
 * domain: admin
 * purpose: High-level helper for recording admin lifecycle events
 * spec_ref: admin-ui-specs.md#tenant-management
 * complexity_budget: 160
 * dependencies: {
 *   internal: [
 *     '@/domains/admin/audit/admin-audit-log.repository',
 *     '@/domains/admin/audit/admin-audit-log.types'
 *   ]
 * }
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { AdminAuditLogRepository } from './admin-audit-log.repository';
import type {
  AdminAuditAction,
  AdminAuditActor,
  AdminAuditLogInsert,
  AdminAuditLogEntry
} from './admin-audit-log.types';

export interface TenantLifecycleAuditInput {
  tenantId: string;
  tenantName?: string;
  actor: AdminAuditActor;
  action: AdminAuditAction;
  previousStatus?: string;
  newStatus: string;
  reason?: string;
  comment?: string;
}

export class AdminAuditLogService {
  private readonly repository: AdminAuditLogRepository;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.repository = new AdminAuditLogRepository(supabase);
  }

  async log(input: AdminAuditLogInsert): Promise<AdminAuditLogEntry | null> {
    return this.repository.insert(input);
  }

  async getTenantLifecycleLog(tenantId: string, limit = 100): Promise<AdminAuditLogEntry[]> {
    return this.repository.findByTenant(tenantId, limit);
  }

  async logTenantLifecycleChange({
    tenantId,
    tenantName,
    actor,
    action,
    previousStatus,
    newStatus,
    reason,
    comment
  }: TenantLifecycleAuditInput): Promise<AdminAuditLogEntry | null> {
    const metadata: Record<string, unknown> = {
      tenantName,
      previousStatus,
      newStatus
    };

    return this.log({
      tenantId,
      targetId: tenantId,
      targetType: 'tenant',
      action,
      actor,
      reason: reason ?? undefined,
      comment: comment ?? undefined,
      metadata
    });
  }
}

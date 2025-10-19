/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/domains/admin/audit/admin-audit-log.repository.ts
 * phase: 3
 * domain: admin
 * purpose: Persist admin audit events to Supabase admin_audit_log table
 * spec_ref: admin-ui-specs.md#tenant-management
 * complexity_budget: 140
 * dependencies: {
 *   external: ['@supabase/supabase-js'],
 *   internal: ['@/domains/admin/audit/admin-audit-log.types']
 * }
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AdminAuditLogInsert, AdminAuditLogEntry, AdminAuditAction } from './admin-audit-log.types';

const TABLE_NAME = 'admin_audit_log';
type AdminAuditRow = Database['public']['Tables']['admin_audit_log']['Row'];

const normalizeMetadata = (
  metadata: Database['public']['Tables']['admin_audit_log']['Row']['metadata']
): Record<string, unknown> | null | undefined => {
  if (metadata === null) return null;
  if (typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return undefined;
};

const mapRowToEntry = (row: AdminAuditRow): AdminAuditLogEntry => ({
  id: row.id,
  tenantId: row.tenant_id ?? undefined,
  targetId: row.target_id,
  targetType: (row.target_type ?? 'system') as AdminAuditLogEntry['targetType'],
  action: (row.action ?? 'tenant.updated') as AdminAuditAction,
  actor: {
    id: row.actor_id ?? undefined,
    email: row.actor_email ?? undefined,
    roles: Array.isArray(row.actor_roles) ? row.actor_roles : []
  },
  reason: row.reason ?? undefined,
  comment: row.comment ?? undefined,
  metadata: normalizeMetadata(row.metadata),
  createdAt: row.created_at
});

export class AdminAuditLogRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async insert(entry: AdminAuditLogInsert): Promise<AdminAuditLogEntry | null> {
    const payload: Database['public']['Tables']['admin_audit_log']['Insert'] = {
      tenant_id: entry.tenantId ?? null,
      target_id: entry.targetId,
      target_type: entry.targetType,
      action: entry.action,
      actor_id: entry.actor.id ?? null,
      actor_email: entry.actor.email ?? null,
      actor_roles: entry.actor.roles?.length ? entry.actor.roles : null,
      reason: entry.reason ?? null,
      comment: entry.comment ?? null,
      metadata: (entry.metadata ?? null) as Database['public']['Tables']['admin_audit_log']['Insert']['metadata']
    };

    const { data, error } = await (this.supabase as any)
      .from(TABLE_NAME)
      .insert(payload)
      .select()
      .single() as { data: AdminAuditRow; error: any };

    if (error) {
      console.error('[AdminAuditLogRepository] Failed to insert audit log', error);
      return null;
    }

    return mapRowToEntry(data);
  }

  async findByTenant(tenantId: string, limit = 100): Promise<AdminAuditLogEntry[]> {
    const { data, error } = await (this.supabase as any)
      .from(TABLE_NAME)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit) as { data: AdminAuditRow[]; error: any };

    if (error) {
      console.error('[AdminAuditLogRepository] Failed to fetch audit logs', error);
      return [];
    }

    return (data ?? []).map(mapRowToEntry);
  }
}

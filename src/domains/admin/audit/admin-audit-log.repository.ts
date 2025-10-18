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
import type { Database } from '@/lib/supabase/types';
import type { AdminAuditLogInsert, AdminAuditLogEntry } from './admin-audit-log.types';

const TABLE_NAME = 'admin_audit_log';
type AdminAuditRow = Database['public']['Tables']['admin_audit_log']['Row'];

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
      metadata: entry.metadata ?? null
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

    return {
      id: data.id,
      tenantId: data.tenant_id,
      targetId: data.target_id,
      targetType: data.target_type,
      action: data.action,
      actor: {
        id: data.actor_id ?? undefined,
        email: data.actor_email ?? undefined,
        roles: data.actor_roles ?? []
      },
      reason: data.reason ?? undefined,
      comment: data.comment ?? undefined,
      metadata: data.metadata ?? undefined,
      createdAt: data.created_at
    };
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

    return (data || []).map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      targetId: row.target_id,
      targetType: row.target_type,
      action: row.action,
      actor: {
        id: row.actor_id ?? undefined,
        email: row.actor_email ?? undefined,
        roles: row.actor_roles ?? []
      },
      reason: row.reason ?? undefined,
      comment: row.comment ?? undefined,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at
    }));
  }
}

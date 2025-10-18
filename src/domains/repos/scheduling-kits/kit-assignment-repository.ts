import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  CreateKitAssignmentInput,
  KitAssignment,
  JsonValue,
} from '@/domains/lib/scheduling-kits/kit-types';

type KitAssignmentTable = Database['public']['Tables']['kit_assignments'];
type KitAssignmentRow = KitAssignmentTable['Row'];
type KitAssignmentInsert = KitAssignmentTable['Insert'];

export class KitAssignmentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createAssignment(payload: CreateKitAssignmentInput): Promise<KitAssignment> {
    const insertPayload: KitAssignmentInsert = {
      tenant_id: payload.tenantId,
      kit_id: payload.kitId,
      variant_id: payload.variantId ?? null,
      external_ref: payload.externalRef,
      notes: payload.notes ?? null,
      metadata: (payload.metadata ?? null) as KitAssignmentInsert['metadata'],
    };

    const { data, error } = await this.supabase
      .from('kit_assignments')
      .insert(insertPayload)
      .select('id, tenant_id, kit_id, variant_id, external_ref, notes, metadata, created_at, updated_at')
      .single();

    if (error) {
      throw this.asRepositoryError('Failed to create kit assignment', error);
    }

    return this.mapRow(data as KitAssignmentRow);
  }

  async findByExternalRef(tenantId: string, externalRef: string): Promise<KitAssignment | null> {
    const { data, error } = await this.supabase
      .from('kit_assignments')
      .select('id, tenant_id, kit_id, variant_id, external_ref, notes, metadata, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('external_ref', externalRef)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw this.asRepositoryError('Failed to find kit assignment', error);
    }

    if (!data) {
      return null;
    }

    return this.mapRow(data as KitAssignmentRow);
  }

  private mapRow(row: KitAssignmentRow): KitAssignment {
    if (!row.tenant_id) {
      throw new Error('Kit assignment row missing tenant_id');
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      kitId: row.kit_id,
      variantId: row.variant_id,
      externalRef: row.external_ref,
      notes: row.notes,
      metadata: (row.metadata ?? undefined) as JsonValue | undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    } satisfies KitAssignment;
  }

  private asRepositoryError(message: string, error: PostgrestError): Error {
    const repositoryError = new Error(message);
    (repositoryError as Error & { cause?: unknown }).cause = error;
    return repositoryError;
  }
}

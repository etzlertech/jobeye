import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import {
  CreateKitAssignmentInput,
  KitAssignment,
} from '@/domains/lib/scheduling-kits/kit-types';

type KitAssignmentRow = {
  id: string;
  company_id: string;
  kit_id: string;
  variant_id: string | null;
  external_ref: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export class KitAssignmentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createAssignment(payload: CreateKitAssignmentInput): Promise<KitAssignment> {
    const insertPayload = {
      company_id: payload.companyId,
      kit_id: payload.kitId,
      variant_id: payload.variantId ?? null,
      external_ref: payload.externalRef,
      notes: payload.notes ?? null,
      metadata: payload.metadata ?? {},
    };

    const { data, error } = await this.supabase
      .from('kit_assignments')
      .insert(insertPayload)
      .select('id, company_id, kit_id, variant_id, external_ref, notes, metadata, created_at, updated_at')
      .single();

    if (error) {
      throw this.asRepositoryError('Failed to create kit assignment', error);
    }

    return this.mapRow(data as KitAssignmentRow);
  }

  async findByExternalRef(companyId: string, externalRef: string): Promise<KitAssignment | null> {
    const { data, error } = await this.supabase
      .from('kit_assignments')
      .select('id, company_id, kit_id, variant_id, external_ref, notes, metadata, created_at, updated_at')
      .eq('company_id', companyId)
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
    return {
      id: row.id,
      companyId: row.company_id,
      kitId: row.kit_id,
      variantId: row.variant_id,
      externalRef: row.external_ref,
      notes: row.notes,
      metadata: row.metadata ?? undefined,
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

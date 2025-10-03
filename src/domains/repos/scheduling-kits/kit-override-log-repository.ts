import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { CreateKitOverrideLogInput } from '@/domains/lib/scheduling-kits/kit-types';

type KitOverrideLogRow = {
  id: string;
};

export class KitOverrideLogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createOverride(payload: CreateKitOverrideLogInput): Promise<KitOverrideLogRow> {
    const insertPayload = {
      tenant_id: payload.tenantId,
      assignment_id: payload.assignmentId,
      item_id: payload.itemId ?? null,
      reason: payload.reason,
      delta: payload.delta ?? {},
      metadata: payload.metadata ?? {},
    };

    const { data, error } = await this.supabase
      .from('kit_override_logs')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      throw this.asRepositoryError('Failed to create kit override log', error);
    }

    return data as KitOverrideLogRow;
  }

  private asRepositoryError(message: string, error: PostgrestError): Error {
    const repositoryError = new Error(message);
    (repositoryError as Error & { cause?: unknown }).cause = error;
    return repositoryError;
  }
}

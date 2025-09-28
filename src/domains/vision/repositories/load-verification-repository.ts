import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/core/logger/logger';
import {
  LoadVerificationPersistencePayload,
  LoadVerificationRecord,
} from '@/domains/vision/types/load-verification-types';

const repositoryLogger = new Logger('load-verification-repository');

type AnySupabaseClient = SupabaseClient<any, any, any>;

export class LoadVerificationRepository {
  constructor(private readonly supabase: AnySupabaseClient) {}

  private mapRow(row: any): LoadVerificationRecord {
    return {
      id: row.id,
      jobId: row.job_id,
      mediaId: row.media_id,
      provider: row.provider,
      modelId: row.model_id,
      detectedContainers: row.detected_containers || [],
      detectedItems: row.detected_items || [],
      verifiedChecklistItemIds: row.verified_checklist_items || [],
      missingChecklistItemIds: row.missing_items || [],
      unexpectedItems: row.unexpected_items || [],
      tokensUsed: row.tokens_used,
      costUsd: row.cost_usd,
      processingTimeMs: row.processing_time_ms,
      createdAt: row.created_at,
    };
  }

  async create(payload: LoadVerificationPersistencePayload): Promise<LoadVerificationRecord> {
    const insertPayload = {
      job_id: payload.jobId,
      media_id: payload.mediaId,
      provider: payload.provider,
      model_id: payload.modelId,
      detected_containers: payload.detectedContainers,
      detected_items: payload.detectedItems,
      verified_checklist_items: payload.verifiedChecklistItemIds,
      missing_items: payload.missingChecklistItemIds,
      unexpected_items: payload.unexpectedItems,
      tokens_used: payload.tokensUsed,
      cost_usd: payload.costUsd,
      processing_time_ms: payload.processingTimeMs,
    };

    const { data, error } = await this.supabase
      .from('load_verifications')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      repositoryLogger.error('Failed to insert load verification', { error, payload });
      throw error;
    }

    return this.mapRow(data);
  }

  async findLatestByJob(jobId: string): Promise<LoadVerificationRecord | null> {
    const { data, error } = await this.supabase
      .from('load_verifications')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      repositoryLogger.error('Failed to fetch latest load verification', { error, jobId });
      throw error;
    }

    if (!data) return null;
    return this.mapRow(data);
  }

  async listByJob(jobId: string, limit: number = 20): Promise<LoadVerificationRecord[]> {
    const { data, error } = await this.supabase
      .from('load_verifications')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      repositoryLogger.error('Failed to list load verifications', { error, jobId, limit });
      throw error;
    }

    return (data || []).map(row => this.mapRow(row));
  }
}

export function createLoadVerificationRepository(supabase: AnySupabaseClient) {
  return new LoadVerificationRepository(supabase);
}

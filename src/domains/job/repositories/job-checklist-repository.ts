import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/core/logger/logger';

const repositoryLogger = new Logger('job-checklist-repository');

type AnySupabaseClient = SupabaseClient<any, any, any>;

export type ChecklistStatus = 'pending' | 'loaded' | 'verified' | 'missing';
export type ChecklistAutoStatus = ChecklistStatus | 'wrong_container' | 'low_confidence';

export interface JobChecklistItem {
  id: string;
  jobId: string;
  sequenceNumber: number;
  itemType: 'equipment' | 'material';
  itemId: string;
  itemName: string;
  quantity: number;
  containerId?: string | null;
  status: ChecklistStatus;
  createdAt: string;
  updatedAt: string;
  autoStatus?: ChecklistAutoStatus | null;
  autoConfidence?: number | null;
  lastVerificationId?: string | null;
  autoVerifiedAt?: string | null;
  manualOverrideStatus?: ChecklistStatus | null;
  manualOverrideReason?: string | null;
  manualOverrideBy?: string | null;
  manualOverrideAt?: string | null;
}

function mapRow(row: any): JobChecklistItem {
  return {
    id: row.id,
    jobId: row.job_id,
    sequenceNumber: row.sequence_number,
    itemType: row.item_type,
    itemId: row.item_id,
    itemName: row.item_name,
    quantity: row.quantity,
    containerId: row.container_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    autoStatus: row.auto_status,
    autoConfidence: row.auto_confidence,
    lastVerificationId: row.last_verification_id,
    autoVerifiedAt: row.auto_verified_at,
    manualOverrideStatus: row.manual_override_status,
    manualOverrideReason: row.manual_override_reason,
    manualOverrideBy: row.manual_override_by,
    manualOverrideAt: row.manual_override_at,
  } as JobChecklistItem;
}

export class JobChecklistRepository {
  constructor(private readonly supabase: AnySupabaseClient) {}

  async listByJob(jobId: string): Promise<JobChecklistItem[]> {
    const { data, error } = await this.supabase
      .from('job_checklist_items')
      .select('*')
      .eq('job_id', jobId)
      .order('sequence_number', { ascending: true });

    if (error) {
      repositoryLogger.error('Failed to load job checklist items', { error, jobId });
      throw error;
    }

    return (data || []).map(mapRow);
  }

  async updateAutoVerification(itemId: string, updates: Partial<{
    status: ChecklistStatus;
    autoStatus: ChecklistAutoStatus | null;
    autoConfidence: number | null;
    autoVerifiedAt: string | null;
    lastVerificationId: string | null;
  }>): Promise<JobChecklistItem> {
    const payload: Record<string, any> = {};

    if (updates.status) payload.status = updates.status;
    if (updates.autoStatus !== undefined) payload.auto_status = updates.autoStatus;
    if (updates.autoConfidence !== undefined) payload.auto_confidence = updates.autoConfidence;
    if (updates.autoVerifiedAt !== undefined) payload.auto_verified_at = updates.autoVerifiedAt;
    if (updates.lastVerificationId !== undefined) payload.last_verification_id = updates.lastVerificationId;

    if (Object.keys(payload).length === 0) {
      throw new Error('No updates provided for checklist auto verification');
    }

    const { data, error } = await this.supabase
      .from('job_checklist_items')
      .update(payload)
      .eq('id', itemId)
      .select('*')
      .single();

    if (error) {
      repositoryLogger.error('Failed to update checklist item auto verification', {
        error,
        itemId,
        payload,
      });
      throw error;
    }

    return mapRow(data);
  }

  async applyManualOverride(itemId: string, updates: {
    manualOverrideStatus: ChecklistStatus | null;
    manualOverrideReason?: string | null;
    manualOverrideBy?: string | null;
    manualOverrideAt?: string | null;
  }): Promise<JobChecklistItem> {
    const payload = {
      manual_override_status: updates.manualOverrideStatus,
      manual_override_reason: updates.manualOverrideReason ?? null,
      manual_override_by: updates.manualOverrideBy ?? null,
      manual_override_at: updates.manualOverrideAt ?? null,
      status: updates.manualOverrideStatus ?? undefined,
    };

    const { data, error } = await this.supabase
      .from('job_checklist_items')
      .update(payload)
      .eq('id', itemId)
      .select('*')
      .single();

    if (error) {
      repositoryLogger.error('Failed to apply manual override', { error, itemId, payload });
      throw error;
    }

    repositoryLogger.info('Manual override applied', {
      itemId,
      status: updates.manualOverrideStatus,
      userId: updates.manualOverrideBy,
    });

    return mapRow(data);
  }
}

export function createJobChecklistRepository(supabase: AnySupabaseClient) {
  return new JobChecklistRepository(supabase);
}

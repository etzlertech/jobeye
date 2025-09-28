/**
 * AGENT DIRECTIVE BLOCK
 * file: src/domains/job/services/job-load-list-service.ts
 * phase: 4
 * domain: job
 * purpose: Service for managing job load lists and verification workflows
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 300
 * dependencies:
 *   - internal: JobRepository, ChecklistRepository, LoadVerificationRepository, ContainerService
 *   - external: uuid
 * exports: JobLoadListService
 * voice_considerations:
 *   - Voice commands: "show load list", "what's missing", "mark as loaded"
 *   - Status announcements: "5 of 10 items loaded"
 * offline_capability: REQUIRED
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/domains/job/services/__tests__/job-load-list-service.test.ts
 * tasks:
 *   - [x] Define service interface
 *   - [x] Implement load list generation
 *   - [x] Add verification status tracking
 *   - [x] Implement voice-friendly status reporting
 *   - [x] Add offline support
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from '@/types/database';
import { ContainerService } from '@/domains/equipment/services/container-service';
import { LoadVerificationRepository } from '@/domains/vision/repositories/load-verification-repository';
import { VoiceLogger } from '@/core/logger/voice-logger';

export interface LoadListItem {
  id: string;
  sequence_number: number;
  item_type: 'equipment' | 'material';
  item_id: string;
  item_name: string;
  quantity: number;
  container_id?: string;
  container_name?: string;
  status: 'pending' | 'loaded' | 'verified' | 'missing';
  auto_status?: 'pending' | 'loaded' | 'verified' | 'missing' | 'wrong_container' | 'low_confidence';
  auto_confidence?: number;
  manual_override_status?: 'pending' | 'loaded' | 'verified' | 'missing';
  manual_override_reason?: string;
}

export interface LoadListSummary {
  job_id: string;
  job_title: string;
  total_items: number;
  loaded_items: number;
  verified_items: number;
  missing_items: number;
  completion_percentage: number;
  containers_used: Array<{
    id: string;
    name: string;
    item_count: number;
  }>;
  voice_summary: string;
}

export interface LoadVerificationRequest {
  job_id: string;
  media_id: string;
  frame_timestamp?: number;
  container_context?: string;
}

export interface LoadVerificationResult {
  verification_id: string;
  status: 'success' | 'partial' | 'failed';
  items_verified: string[];
  items_missing: string[];
  confidence_scores: Record<string, number>;
  suggestions?: string[];
}

interface OfflineOperation {
  id: string;
  type: 'update_status' | 'manual_override' | 'verify_load';
  job_id: string;
  payload: any;
  timestamp: number;
}

export class JobLoadListService {
  private supabase: SupabaseClient<Database>;
  private containerService: ContainerService;
  private loadVerificationRepo: LoadVerificationRepository;
  private logger: VoiceLogger;
  private offlineQueue: OfflineOperation[] = [];

  constructor(
    supabase: SupabaseClient<Database>,
    containerService?: ContainerService,
    loadVerificationRepo?: LoadVerificationRepository,
    logger?: VoiceLogger
  ) {
    this.supabase = supabase;
    this.containerService = containerService || new ContainerService(supabase);
    this.loadVerificationRepo = loadVerificationRepo || new LoadVerificationRepository(supabase);
    this.logger = logger || new VoiceLogger();
    this.loadOfflineQueue();
  }

  async getLoadList(jobId: string): Promise<LoadListItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('job_checklist_items')
        .select(`
          *,
          containers:container_id (
            id,
            name,
            identifier,
            container_type,
            color
          )
        `)
        .eq('job_id', jobId)
        .order('sequence_number');

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        sequence_number: item.sequence_number,
        item_type: item.item_type as 'equipment' | 'material',
        item_id: item.item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        container_id: item.container_id,
        container_name: item.containers?.name,
        status: item.manual_override_status || item.status,
        auto_status: item.auto_status,
        auto_confidence: item.auto_confidence,
        manual_override_status: item.manual_override_status,
        manual_override_reason: item.manual_override_reason
      }));
    } catch (error) {
      await this.logger.error('Failed to get load list', error as Error, { jobId });
      throw error;
    }
  }

  async getLoadListSummary(jobId: string): Promise<LoadListSummary> {
    try {
      // Get job details
      const { data: job } = await this.supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .single();

      if (!job) throw new Error('Job not found');

      // Get load list
      const loadList = await this.getLoadList(jobId);

      // Calculate summary
      const summary: LoadListSummary = {
        job_id: jobId,
        job_title: job.title,
        total_items: loadList.length,
        loaded_items: loadList.filter(i => ['loaded', 'verified'].includes(i.status)).length,
        verified_items: loadList.filter(i => i.status === 'verified').length,
        missing_items: loadList.filter(i => i.status === 'missing').length,
        completion_percentage: loadList.length > 0 
          ? Math.round((loadList.filter(i => i.status === 'verified').length / loadList.length) * 100)
          : 0,
        containers_used: [],
        voice_summary: ''
      };

      // Group by container
      const containerMap = new Map<string, { name: string; items: LoadListItem[] }>();
      loadList.forEach(item => {
        if (item.container_id && item.container_name) {
          if (!containerMap.has(item.container_id)) {
            containerMap.set(item.container_id, { name: item.container_name, items: [] });
          }
          containerMap.get(item.container_id)!.items.push(item);
        }
      });

      summary.containers_used = Array.from(containerMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        item_count: data.items.length
      }));

      // Generate voice-friendly summary
      summary.voice_summary = this.generateVoiceSummary(summary);

      return summary;
    } catch (error) {
      await this.logger.error('Failed to get load list summary', error as Error, { jobId });
      throw error;
    }
  }

  async updateItemStatus(
    jobId: string,
    itemId: string,
    status: LoadListItem['status'],
    userId: string
  ): Promise<boolean> {
    if (!navigator.onLine) {
      this.queueOfflineOperation('update_status', jobId, { itemId, status, userId });
      return true;
    }

    try {
      const { error } = await this.supabase
        .from('job_checklist_items')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('id', itemId);

      if (error) throw error;

      await this.logger.info('Load list item status updated', {
        jobId,
        itemId,
        status,
        userId
      });

      return true;
    } catch (error) {
      await this.logger.error('Failed to update item status', error as Error, {
        jobId,
        itemId,
        status
      });
      return false;
    }
  }

  async applyManualOverride(
    jobId: string,
    itemId: string,
    overrideStatus: LoadListItem['status'],
    reason: string,
    userId: string
  ): Promise<boolean> {
    if (!navigator.onLine) {
      this.queueOfflineOperation('manual_override', jobId, { 
        itemId, 
        overrideStatus, 
        reason, 
        userId 
      });
      return true;
    }

    try {
      const { error } = await this.supabase
        .from('job_checklist_items')
        .update({
          manual_override_status: overrideStatus,
          manual_override_reason: reason,
          manual_override_by: userId,
          manual_override_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('id', itemId);

      if (error) throw error;

      await this.logger.info('Manual override applied', {
        jobId,
        itemId,
        overrideStatus,
        reason,
        userId
      });

      return true;
    } catch (error) {
      await this.logger.error('Failed to apply manual override', error as Error, {
        jobId,
        itemId,
        overrideStatus
      });
      return false;
    }
  }

  async verifyLoadWithVision(request: LoadVerificationRequest): Promise<LoadVerificationResult> {
    try {
      // Get load list for the job
      const loadList = await this.getLoadList(request.job_id);
      
      // Create load verification record
      const verification = await this.loadVerificationRepo.create({
        job_id: request.job_id,
        media_id: request.media_id,
        verified_checklist_items: [],
        missing_items: [],
        detected_containers: [],
        detected_items: [],
        confidence_scores: {},
        provider: 'multi-object-vision',
        model: 'yolo-vlm-hybrid',
        processing_time_ms: 0,
        cost: 0
      });

      // TODO: Integrate with actual vision service
      // For now, return a mock result
      const result: LoadVerificationResult = {
        verification_id: verification.id,
        status: 'partial',
        items_verified: [],
        items_missing: loadList.filter(i => i.status === 'pending').map(i => i.id),
        confidence_scores: {},
        suggestions: ['Position camera to capture all items', 'Ensure good lighting']
      };

      return result;
    } catch (error) {
      await this.logger.error('Failed to verify load with vision', error as Error, request);
      throw error;
    }
  }

  async assignItemToContainer(
    jobId: string,
    itemId: string,
    containerId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('job_checklist_items')
        .update({ 
          container_id: containerId,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('id', itemId);

      if (error) throw error;

      await this.logger.info('Item assigned to container', {
        jobId,
        itemId,
        containerId,
        userId
      });

      return true;
    } catch (error) {
      await this.logger.error('Failed to assign item to container', error as Error, {
        jobId,
        itemId,
        containerId
      });
      return false;
    }
  }

  async getMissingItems(jobId: string): Promise<LoadListItem[]> {
    const loadList = await this.getLoadList(jobId);
    return loadList.filter(item => 
      item.status === 'missing' || 
      (item.auto_status === 'missing' && !item.manual_override_status)
    );
  }

  async getItemsInWrongContainer(jobId: string): Promise<LoadListItem[]> {
    const loadList = await this.getLoadList(jobId);
    return loadList.filter(item => item.auto_status === 'wrong_container');
  }

  private generateVoiceSummary(summary: LoadListSummary): string {
    const parts = [];

    // Overall progress
    if (summary.total_items === 0) {
      parts.push('No items in load list');
    } else if (summary.verified_items === summary.total_items) {
      parts.push('All items verified and loaded');
    } else {
      parts.push(`${summary.verified_items} of ${summary.total_items} items verified`);
      
      if (summary.missing_items > 0) {
        parts.push(`${summary.missing_items} items missing`);
      }
      
      const remaining = summary.total_items - summary.verified_items - summary.missing_items;
      if (remaining > 0) {
        parts.push(`${remaining} items pending`);
      }
    }

    // Container summary
    if (summary.containers_used.length > 0) {
      const containerParts = summary.containers_used.map(c => 
        `${c.item_count} items in ${c.name}`
      );
      parts.push(containerParts.join(', '));
    }

    return parts.join('. ');
  }

  // Offline support methods
  private loadOfflineQueue() {
    const stored = localStorage.getItem('job-load-list-offline-queue');
    if (stored) {
      this.offlineQueue = JSON.parse(stored);
    }
  }

  private saveOfflineQueue() {
    localStorage.setItem('job-load-list-offline-queue', JSON.stringify(this.offlineQueue));
  }

  private queueOfflineOperation(type: OfflineOperation['type'], jobId: string, payload: any) {
    const operation: OfflineOperation = {
      id: uuidv4(),
      type,
      job_id: jobId,
      payload,
      timestamp: Date.now()
    };

    this.offlineQueue.push(operation);
    this.saveOfflineQueue();
  }

  async syncOfflineOperations(): Promise<void> {
    if (!navigator.onLine || this.offlineQueue.length === 0) {
      return;
    }

    const operations = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'update_status':
            await this.updateItemStatus(
              operation.job_id,
              operation.payload.itemId,
              operation.payload.status,
              operation.payload.userId
            );
            break;
          case 'manual_override':
            await this.applyManualOverride(
              operation.job_id,
              operation.payload.itemId,
              operation.payload.overrideStatus,
              operation.payload.reason,
              operation.payload.userId
            );
            break;
          case 'verify_load':
            await this.verifyLoadWithVision(operation.payload);
            break;
        }
      } catch (error) {
        console.error('Failed to sync offline operation:', error);
        this.offlineQueue.push(operation);
      }
    }

    this.saveOfflineQueue();
  }
}
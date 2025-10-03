/**
 * AGENT DIRECTIVE BLOCK
 * file: src/domains/job/services/checklist-verification-service.ts
 * phase: 4
 * domain: job
 * purpose: Service for verifying job checklist items against vision detection results
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 250
 * dependencies:
 *   - internal: JobLoadListService, LoadVerificationRepository, MultiObjectVisionService
 *   - external: uuid
 * exports: ChecklistVerificationService
 * voice_considerations:
 *   - Voice feedback: "3 items verified, 2 missing"
 *   - Confirmation prompts: "Override missing status for lawn mower?"
 * offline_capability: REQUIRED
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/domains/job/services/__tests__/checklist-verification-service.test.ts
 * tasks:
 *   - [x] Define verification interfaces
 *   - [x] Implement checklist matching logic
 *   - [x] Add confidence threshold handling
 *   - [x] Implement manual override support
 *   - [x] Add voice-friendly status reporting
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from '@/types/database';
import { JobLoadListService, LoadListItem } from './job-load-list-service';
import { LoadVerificationRepository } from '@/domains/vision/repositories/load-verification-repository';
import { MultiObjectVisionService } from '@/domains/vision/services/multi-object-vision-service';
import { VoiceLogger } from '@/core/logger/voice-logger';
import type { 
  DetectedContainer, 
  DetectedItem,
  LoadVerification 
} from '@/domains/vision/types/load-verification-types';

export interface VerificationRequest {
  job_id: string;
  media_id?: string;
  frame_data?: string; // Base64 encoded image
  verification_mode: 'auto' | 'manual' | 'hybrid';
  confidence_threshold?: number;
  user_id: string;
}

export interface VerificationResult {
  verification_id: string;
  job_id: string;
  verified_items: Array<{
    checklist_item_id: string;
    item_name: string;
    confidence: number;
    container_id?: string;
    container_name?: string;
    status: 'verified' | 'loaded' | 'missing' | 'wrong_container' | 'low_confidence';
  }>;
  missing_items: Array<{
    checklist_item_id: string;
    item_name: string;
    expected_container_id?: string;
  }>;
  unexpected_items: Array<{
    item_name: string;
    container_id?: string;
    confidence: number;
  }>;
  containers_detected: Array<{
    container_id?: string;
    identifier?: string;
    type: string;
    color?: string;
    confidence: number;
  }>;
  overall_status: 'complete' | 'partial' | 'failed';
  completion_percentage: number;
  voice_summary: string;
  suggestions: string[];
}

export interface ManualOverrideRequest {
  job_id: string;
  checklist_item_id: string;
  new_status: 'verified' | 'loaded' | 'missing';
  reason: string;
  user_id: string;
}

interface OfflineVerification {
  id: string;
  type: 'verification' | 'override';
  payload: any;
  timestamp: number;
}

export class ChecklistVerificationService {
  private supabase: SupabaseClient<Database>;
  private loadListService: JobLoadListService;
  private loadVerificationRepo: LoadVerificationRepository;
  private visionService: MultiObjectVisionService;
  private logger: VoiceLogger;
  private offlineQueue: OfflineVerification[] = [];

  private readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
  private readonly CONTAINER_MATCH_THRESHOLD = 0.8;

  constructor(
    supabase: SupabaseClient<Database>,
    loadListService?: JobLoadListService,
    loadVerificationRepo?: LoadVerificationRepository,
    visionService?: MultiObjectVisionService,
    logger?: VoiceLogger
  ) {
    this.supabase = supabase;
    this.loadListService = loadListService || new JobLoadListService(supabase);
    this.loadVerificationRepo = loadVerificationRepo || new LoadVerificationRepository(supabase);
    this.visionService = visionService || new MultiObjectVisionService(supabase);
    this.logger = logger || new VoiceLogger();
    this.loadOfflineQueue();
  }

  async verifyChecklist(request: VerificationRequest): Promise<VerificationResult> {
    if (!navigator.onLine && request.verification_mode === 'auto') {
      return this.createOfflineResult(request);
    }

    try {
      // Get job checklist
      const checklist = await this.loadListService.getLoadList(request.job_id);
      if (checklist.length === 0) {
        return this.createEmptyResult(request.job_id, 'No checklist items found');
      }

      let verification: LoadVerification;

      if (request.verification_mode === 'auto' && (request.media_id || request.frame_data)) {
        // Run vision analysis
        const visionResult = await this.runVisionAnalysis(request, checklist);
        verification = visionResult;
      } else {
        // Manual or hybrid mode - use existing verification data
        const latest = await this.loadVerificationRepo.getLatestForJob(request.job_id);
        if (!latest) {
          return this.createEmptyResult(request.job_id, 'No verification data available');
        }
        verification = latest;
      }

      // Match detected items with checklist
      const result = await this.matchChecklistWithDetections(
        checklist,
        verification,
        request.confidence_threshold || this.DEFAULT_CONFIDENCE_THRESHOLD
      );

      // Update checklist statuses
      if (request.verification_mode !== 'manual') {
        await this.updateChecklistStatuses(request.job_id, result, request.user_id);
      }

      // Generate voice summary
      result.voice_summary = this.generateVoiceSummary(result);
      result.suggestions = this.generateSuggestions(result, checklist);

      await this.logger.info('Checklist verification completed', {
        jobId: request.job_id,
        verificationId: result.verification_id,
        mode: request.verification_mode,
        completionPercentage: result.completion_percentage
      });

      return result;
    } catch (error) {
      await this.logger.error('Failed to verify checklist', error as Error, request);
      throw error;
    }
  }

  async applyManualOverride(override: ManualOverrideRequest): Promise<boolean> {
    if (!navigator.onLine) {
      this.queueOfflineOperation('override', override);
      return true;
    }

    try {
      const success = await this.loadListService.applyManualOverride(
        override.job_id,
        override.checklist_item_id,
        override.new_status,
        override.reason,
        override.user_id
      );

      if (success) {
        await this.logger.info('Manual override applied', override);
      }

      return success;
    } catch (error) {
      await this.logger.error('Failed to apply manual override', error as Error, override);
      return false;
    }
  }

  private async runVisionAnalysis(
    request: VerificationRequest,
    checklist: LoadListItem[]
  ): Promise<LoadVerification> {
    // Prepare media for vision service
    let mediaId = request.media_id;
    
    if (!mediaId && request.frame_data) {
      // Upload frame data as media asset
      const { data: media } = await this.supabase
        .from('media_assets')
        .insert({
          tenant_id: await this.getUserTenantId(request.user_id),
          uploaded_by: request.user_id,
          media_type: 'photo',
          file_name: `verification_${request.job_id}_${Date.now()}.jpg`,
          file_size: request.frame_data.length,
          mime_type: 'image/jpeg',
          storage_path: `verifications/${request.job_id}/${uuidv4()}.jpg`,
          job_id: request.job_id,
          metadata: {
            source: 'checklist_verification',
            frame_capture: true
          }
        })
        .select()
        .single();

      if (media) {
        mediaId = media.id;
        // TODO: Upload actual image data to Supabase storage
      }
    }

    if (!mediaId) {
      throw new Error('No media available for vision analysis');
    }

    // Run multi-object vision analysis
    const analysisResult = await this.visionService.analyzeLoadingScene(
      mediaId!,
      request.job_id,
      {
        expectedItems: checklist.map(item => ({
          id: item.id,
          name: item.item_name,
          type: item.item_type,
          quantity: item.quantity,
          expectedContainer: item.container_id
        }))
      }
    );

    // Create verification record
    const verification = await this.loadVerificationRepo.create({
      job_id: request.job_id,
      media_id: mediaId!,
      detected_containers: analysisResult.containers,
      detected_items: analysisResult.items,
      verified_checklist_items: [],
      missing_items: [],
      confidence_scores: analysisResult.confidenceScores || {},
      provider: analysisResult.provider,
      model: analysisResult.model,
      processing_time_ms: analysisResult.processingTime,
      cost: analysisResult.cost
    });

    return verification;
  }

  private async matchChecklistWithDetections(
    checklist: LoadListItem[],
    verification: LoadVerification,
    confidenceThreshold: number
  ): Promise<VerificationResult> {
    const result: VerificationResult = {
      verification_id: verification.id,
      job_id: verification.job_id,
      verified_items: [],
      missing_items: [],
      unexpected_items: [],
      containers_detected: [],
      overall_status: 'failed',
      completion_percentage: 0,
      voice_summary: '',
      suggestions: []
    };

    // Process detected containers
    if (verification.detected_containers) {
      result.containers_detected = (verification.detected_containers as DetectedContainer[]).map(c => ({
        container_id: c.container_id,
        identifier: c.identifier,
        type: c.container_type,
        color: c.color,
        confidence: c.confidence
      }));
    }

    // Match checklist items with detected items
    const detectedItems = verification.detected_items as DetectedItem[];
    const matchedDetectedItems = new Set<string>();

    for (const checklistItem of checklist) {
      // Skip if already has manual override
      if (checklistItem.manual_override_status) {
        result.verified_items.push({
          checklist_item_id: checklistItem.id,
          item_name: checklistItem.item_name,
          confidence: 1.0,
          container_id: checklistItem.container_id,
          container_name: checklistItem.container_name,
          status: checklistItem.manual_override_status
        });
        continue;
      }

      // Find matching detected item
      const matches = this.findMatchingItems(checklistItem, detectedItems);
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        matchedDetectedItems.add(bestMatch.id || '');

        // Check confidence
        if (bestMatch.confidence < confidenceThreshold) {
          result.verified_items.push({
            checklist_item_id: checklistItem.id,
            item_name: checklistItem.item_name,
            confidence: bestMatch.confidence,
            container_id: bestMatch.container_id,
            container_name: this.getContainerName(bestMatch.container_id, result.containers_detected),
            status: 'low_confidence'
          });
        } else {
          // Check container match
          const containerMatch = this.checkContainerMatch(
            checklistItem.container_id,
            bestMatch.container_id
          );

          if (!containerMatch && checklistItem.container_id) {
            result.verified_items.push({
              checklist_item_id: checklistItem.id,
              item_name: checklistItem.item_name,
              confidence: bestMatch.confidence,
              container_id: bestMatch.container_id,
              container_name: this.getContainerName(bestMatch.container_id, result.containers_detected),
              status: 'wrong_container'
            });
          } else {
            result.verified_items.push({
              checklist_item_id: checklistItem.id,
              item_name: checklistItem.item_name,
              confidence: bestMatch.confidence,
              container_id: bestMatch.container_id || checklistItem.container_id,
              container_name: checklistItem.container_name,
              status: 'verified'
            });
          }
        }
      } else {
        // Item not found
        result.missing_items.push({
          checklist_item_id: checklistItem.id,
          item_name: checklistItem.item_name,
          expected_container_id: checklistItem.container_id
        });
      }
    }

    // Find unexpected items
    for (const detectedItem of detectedItems) {
      if (!matchedDetectedItems.has(detectedItem.id || '')) {
        result.unexpected_items.push({
          item_name: detectedItem.item_name,
          container_id: detectedItem.container_id,
          confidence: detectedItem.confidence
        });
      }
    }

    // Calculate completion
    const verifiedCount = result.verified_items.filter(i => i.status === 'verified').length;
    result.completion_percentage = Math.round((verifiedCount / checklist.length) * 100);
    
    if (result.completion_percentage === 100) {
      result.overall_status = 'complete';
    } else if (result.completion_percentage > 0) {
      result.overall_status = 'partial';
    }

    return result;
  }

  private findMatchingItems(
    checklistItem: LoadListItem,
    detectedItems: DetectedItem[]
  ): DetectedItem[] {
    return detectedItems
      .filter(detected => {
        // Type match
        if (detected.item_type !== checklistItem.item_type) return false;
        
        // Name similarity
        const nameSimilarity = this.calculateNameSimilarity(
          checklistItem.item_name.toLowerCase(),
          detected.item_name.toLowerCase()
        );
        
        return nameSimilarity > 0.7;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    if (name1 === name2) return 1.0;
    if (name1.includes(name2) || name2.includes(name1)) return 0.9;
    
    // Simple token overlap
    const tokens1 = new Set(name1.split(/\s+/));
    const tokens2 = new Set(name2.split(/\s+/));
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    
    return intersection.size / Math.max(tokens1.size, tokens2.size);
  }

  private checkContainerMatch(expected?: string, detected?: string): boolean {
    if (!expected) return true; // No container requirement
    if (!detected) return false; // Required but not detected
    return expected === detected;
  }

  private getContainerName(
    containerId?: string, 
    containers: VerificationResult['containers_detected']
  ): string | undefined {
    if (!containerId) return undefined;
    const container = containers.find(c => c.container_id === containerId);
    return container?.identifier;
  }

  private async updateChecklistStatuses(
    jobId: string,
    result: VerificationResult,
    userId: string
  ): Promise<void> {
    const updates = [];

    for (const item of result.verified_items) {
      if (!item.checklist_item_id) continue;

      updates.push(
        this.supabase
          .from('job_checklist_items')
          .update({
            auto_status: item.status,
            auto_confidence: item.confidence,
            auto_verified_at: new Date().toISOString(),
            last_verification_id: result.verification_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.checklist_item_id)
      );
    }

    for (const item of result.missing_items) {
      if (!item.checklist_item_id) continue;

      updates.push(
        this.supabase
          .from('job_checklist_items')
          .update({
            auto_status: 'missing',
            auto_confidence: 0,
            auto_verified_at: new Date().toISOString(),
            last_verification_id: result.verification_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.checklist_item_id)
      );
    }

    await Promise.all(updates);
  }

  private generateVoiceSummary(result: VerificationResult): string {
    const parts = [];
    
    const verified = result.verified_items.filter(i => i.status === 'verified').length;
    const total = result.verified_items.length + result.missing_items.length;

    if (result.overall_status === 'complete') {
      parts.push(`All ${total} items verified and loaded correctly`);
    } else {
      parts.push(`${verified} of ${total} items verified`);
      
      if (result.missing_items.length > 0) {
        parts.push(`${result.missing_items.length} items missing`);
      }
      
      const wrongContainer = result.verified_items.filter(i => i.status === 'wrong_container').length;
      if (wrongContainer > 0) {
        parts.push(`${wrongContainer} items in wrong container`);
      }
      
      const lowConfidence = result.verified_items.filter(i => i.status === 'low_confidence').length;
      if (lowConfidence > 0) {
        parts.push(`${lowConfidence} items need manual verification`);
      }
    }

    if (result.unexpected_items.length > 0) {
      parts.push(`${result.unexpected_items.length} unexpected items detected`);
    }

    return parts.join('. ');
  }

  private generateSuggestions(
    result: VerificationResult,
    checklist: LoadListItem[]
  ): string[] {
    const suggestions: string[] = [];

    if (result.missing_items.length > 0) {
      suggestions.push('Check if missing items are in other containers or still at the shop');
    }

    if (result.verified_items.some(i => i.status === 'wrong_container')) {
      suggestions.push('Reorganize items into their assigned containers');
    }

    if (result.verified_items.some(i => i.status === 'low_confidence')) {
      suggestions.push('Take a clearer photo or manually verify uncertain items');
    }

    if (result.containers_detected.length === 0) {
      suggestions.push('Ensure containers are visible in the camera view');
    }

    if (result.completion_percentage < 50) {
      suggestions.push('Position camera to capture more of the loading area');
    }

    return suggestions;
  }

  private createEmptyResult(jobId: string, message: string): VerificationResult {
    return {
      verification_id: uuidv4(),
      job_id: jobId,
      verified_items: [],
      missing_items: [],
      unexpected_items: [],
      containers_detected: [],
      overall_status: 'failed',
      completion_percentage: 0,
      voice_summary: message,
      suggestions: []
    };
  }

  private createOfflineResult(request: VerificationRequest): VerificationResult {
    this.queueOfflineOperation('verification', request);
    
    return {
      verification_id: uuidv4(),
      job_id: request.job_id,
      verified_items: [],
      missing_items: [],
      unexpected_items: [],
      containers_detected: [],
      overall_status: 'failed',
      completion_percentage: 0,
      voice_summary: 'Verification queued for processing when online',
      suggestions: ['Connect to internet to process verification']
    };
  }

  private async getUserTenantId(userId: string): Promise<string> {
    const { data } = await this.supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();
    
    return data?.tenant_id || '';
  }

  // Offline support
  private loadOfflineQueue() {
    const stored = localStorage.getItem('checklist-verification-offline-queue');
    if (stored) {
      this.offlineQueue = JSON.parse(stored);
    }
  }

  private saveOfflineQueue() {
    localStorage.setItem('checklist-verification-offline-queue', JSON.stringify(this.offlineQueue));
  }

  private queueOfflineOperation(type: OfflineVerification['type'], payload: any) {
    const operation: OfflineVerification = {
      id: uuidv4(),
      type,
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
          case 'verification':
            await this.verifyChecklist(operation.payload);
            break;
          case 'override':
            await this.applyManualOverride(operation.payload);
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
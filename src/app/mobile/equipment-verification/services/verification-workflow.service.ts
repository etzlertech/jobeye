/**
 * @file verification-workflow.service.ts
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose Orchestrates YOLO + VLM + offline queue for equipment verification workflow
 * @complexity_budget 500
 */

import { YOLOInferenceService } from '@/domains/vision/services/yolo-inference.service';
import { VLMFallbackService } from '@/domains/vision/services/vlm-fallback.service';
import { VisionVerificationService } from '@/domains/vision/services/vision-verification.service';
import { MediaAssetService } from '@/domains/vision/services/media-asset.service';
import { getOfflineQueue } from '@/domains/vision/lib/offline-queue';
import type { DetectedItem } from '@/domains/vision/types';

export interface EquipmentChecklistItem {
  id: string;
  name: string;
  category: string;
  required: boolean;
  verified: boolean;
}

export interface VerificationSession {
  sessionId: string;
  jobId: string;
  kitId: string;
  tenantId: string;
  checklist: EquipmentChecklistItem[];
  retryCount: number;
  startedAt: string;
}

export interface DetectionResult {
  detectedItems: DetectedItem[];
  confidenceScore: number;
  shouldFallback: boolean;
  usedVLM: boolean;
  retryCount: number;
}

export interface VerificationComplete {
  verificationId: string;
  verified: boolean;
  detectedItems: DetectedItem[];
  missingItems: string[];
  offlineQueued: boolean;
}

/**
 * Orchestration service for equipment verification workflow
 * Coordinates YOLO detection, VLM fallback, and offline queueing
 */
export class VerificationWorkflowService {
  private yoloService: YOLOInferenceService;
  private vlmService: VLMFallbackService;
  private verificationService: VisionVerificationService;
  private mediaAssetService: MediaAssetService;
  private offlineQueue: ReturnType<typeof getOfflineQueue>;

  constructor() {
    this.yoloService = new YOLOInferenceService();
    this.vlmService = new VLMFallbackService();
    this.verificationService = new VisionVerificationService();
    this.mediaAssetService = new MediaAssetService();
    this.offlineQueue = getOfflineQueue();
  }

  /**
   * Start verification session - fetch equipment checklist from job
   */
  async startVerification(jobId: string, tenantId: string): Promise<VerificationSession> {
    try {
      // TODO: Fetch from jobs domain (out of scope for initial implementation)
      // For now, return mock checklist
      const checklist: EquipmentChecklistItem[] = [
        { id: '1', name: 'Lawn Mower', category: 'equipment', required: true, verified: false },
        { id: '2', name: 'String Trimmer', category: 'equipment', required: true, verified: false },
        { id: '3', name: 'Leaf Blower', category: 'equipment', required: true, verified: false },
        { id: '4', name: 'Hedge Trimmer', category: 'equipment', required: false, verified: false },
      ];

      const session: VerificationSession = {
        sessionId: `session-${Date.now()}`,
        jobId,
        kitId: `kit-${jobId}`,
        tenantId,
        checklist,
        retryCount: 0,
        startedAt: new Date().toISOString(),
      };

      return session;

    } catch (error) {
      console.error('[VerificationWorkflow] Failed to start verification:', error);
      throw new Error('Failed to load equipment checklist');
    }
  }

  /**
   * Process detection from camera frame
   * Uses YOLO first, falls back to VLM if confidence too low or retries exhausted
   */
  async processDetection(
    imageData: ImageData,
    session: VerificationSession
  ): Promise<DetectionResult> {
    try {
      const expectedItems = session.checklist.map(item => item.name);

      // Attempt YOLO detection first
      const yoloResult = await this.yoloService.detectObjects(imageData, {
        expectedItems,
        confidenceThreshold: 0.7,
      });

      // Check if VLM fallback needed
      const shouldFallback =
        yoloResult.confidenceScore < 0.7 ||
        session.retryCount >= 3;

      if (shouldFallback) {
        console.log('[VerificationWorkflow] Triggering VLM fallback', {
          confidence: yoloResult.confidenceScore,
          retries: session.retryCount,
        });

        // Convert ImageData to base64 for VLM
        const base64Photo = this.imageDataToBase64(imageData);

        const vlmResult = await this.vlmService.verify({
          photo: base64Photo,
          expectedItems,
        });

        return {
          detectedItems: vlmResult.detectedItems,
          confidenceScore: vlmResult.confidenceScore,
          shouldFallback: false, // Already used VLM
          usedVLM: true,
          retryCount: session.retryCount,
        };
      }

      // YOLO result sufficient
      return {
        detectedItems: yoloResult.detectedItems,
        confidenceScore: yoloResult.confidenceScore,
        shouldFallback: false,
        usedVLM: false,
        retryCount: session.retryCount,
      };

    } catch (error) {
      console.error('[VerificationWorkflow] Detection failed:', error);
      throw new Error('Detection processing failed');
    }
  }

  /**
   * Complete verification - save to Supabase or queue if offline
   */
  async completeVerification(
    session: VerificationSession,
    photo: ImageData,
    detectedItems: DetectedItem[]
  ): Promise<VerificationComplete> {
    try {
      const expectedItems = session.checklist.filter(item => item.required).map(item => item.name);
      const detectedNames = detectedItems.map(item => item.class_name);
      const missingItems = expectedItems.filter(name => !detectedNames.includes(name));
      const verified = missingItems.length === 0;

      // Check if online
      const isOnline = this.offlineQueue.getIsOnline();

      if (isOnline) {
        // Upload photo to Supabase Storage
        console.log('[VerificationWorkflow] Uploading verification photo...');

        const uploadResult = await this.mediaAssetService.uploadVerificationPhoto(photo, {
          tenantId: session.tenantId,
          jobId: session.jobId,
          userId: 'system', // TODO: Get from auth context
          category: 'verification',
          metadata: {
            kitId: session.kitId,
            sessionId: session.sessionId,
            verificationResult: verified ? 'complete' : 'incomplete',
            detectedItemsCount: detectedItems.length,
            missingItemsCount: missingItems.length,
          },
        });

        if (uploadResult.error) {
          console.error('[VerificationWorkflow] Photo upload failed:', uploadResult.error);
          throw new Error(`Failed to upload photo: ${uploadResult.error.message}`);
        }

        console.log('[VerificationWorkflow] Photo uploaded successfully:', {
          mediaAssetId: uploadResult.data?.mediaAssetId,
          publicUrl: uploadResult.data?.publicUrl,
        });

        // Save verification with media asset reference
        const base64Photo = this.imageDataToBase64(photo);

        const result = await this.verificationService.verifyKit({
          photo: base64Photo,
          kitId: session.kitId,
          jobId: session.jobId,
          tenantId: session.tenantId,
          expectedItems,
          mediaAssetId: uploadResult.data?.mediaAssetId, // Link to uploaded photo
        });

        return {
          verificationId: result.verificationId,
          verified,
          detectedItems,
          missingItems,
          offlineQueued: false,
        };

      } else {
        // Queue for offline sync
        const queueId = await this.offlineQueue.enqueue({
          kitId: session.kitId,
          tenantId: session.tenantId,
          imageData: photo,
          expectedItems,
        });

        console.log('[VerificationWorkflow] Queued verification for offline sync:', queueId);

        return {
          verificationId: queueId,
          verified,
          detectedItems,
          missingItems,
          offlineQueued: true,
        };
      }

    } catch (error) {
      console.error('[VerificationWorkflow] Failed to complete verification:', error);
      throw new Error('Failed to save verification');
    }
  }

  /**
   * Convert ImageData to base64 data URL
   */
  private imageDataToBase64(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }
}

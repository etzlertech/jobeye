/**
 * @file /src/domains/vision/lib/vision-types.ts
 * @phase 4
 * @domain Vision
 * @purpose Core type definitions for vision-based kit verification
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

// Verification result types
export type VerificationResult = 'complete' | 'incomplete' | 'failed' | 'unverified';
export type ProcessingMethod = 'local_yolo' | 'cloud_vlm' | 'manual';
export type MatchStatus = 'matched' | 'unmatched' | 'uncertain';

// Detection confidence configuration
export interface DetectionConfig {
  confidenceThreshold: number; // 0.00-1.00, default 0.70
  maxDailyVlmRequests: number; // default 100
  dailyBudgetUsd: number; // default 10.00
}

// YOLO detection types
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface YoloDetection {
  itemType: string;
  confidence: number; // 0.00-1.00
  boundingBox: BoundingBox;
}

export interface YoloInferenceResult {
  detections: YoloDetection[];
  processingTimeMs: number;
  modelVersion: string;
}

// Vision verification record
export interface VisionVerificationRecord {
  id: string;
  tenantId: string;
  technicianId: string;
  kitId: string;
  jobId?: string;
  containerId?: string;
  photoStoragePath: string;
  verificationResult: VerificationResult;
  processingMethod: ProcessingMethod;
  confidenceScore?: number;
  detectedItemsCount: number;
  missingItemsCount: number;
  processingDurationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Detected item
export interface DetectedItem {
  id: string;
  verificationId: string;
  itemType: string;
  confidenceScore: number;
  boundingBox?: BoundingBox;
  matchedKitItemId?: string;
  matchStatus: MatchStatus;
  createdAt: Date;
}

// Cost tracking
export interface VisionCostRecord {
  id: string;
  tenantId: string;
  verificationId: string;
  provider: string; // 'openai', 'anthropic', etc.
  operationType: string; // 'vlm_analysis', 'image_upload', etc.
  estimatedCostUsd: number;
  actualCostUsd?: number;
  requestTimestamp: Date;
  responseTimestamp?: Date;
  createdAt: Date;
}

// VLM fallback types
export interface VlmAnalysisRequest {
  imageData: string | Blob;
  kitItems: string[]; // Expected items to detect
  tenantId: string;
  estimatedCost: number;
}

export interface VlmAnalysisResponse {
  detectedItems: YoloDetection[];
  confidence: number;
  processingTimeMs: number;
  actualCost: number;
  provider: string;
}

// Offline queue types
export interface OfflineVerificationEntry {
  id: string;
  photo: Blob;
  kitId: string;
  containerId?: string;
  technicianId: string;
  tenantId: string;
  timestamp: Date;
  retryCount: number;
  lastError?: string;
}

export interface OfflineQueueStatus {
  queuedCount: number;
  syncingCount: number;
  failedCount: number;
  lastSyncAt?: Date;
  storageUsedMb: number;
  capacityMb: number;
}

// API request/response types
export interface VerifyKitRequest {
  kitId: string;
  photo: File | Blob;
  containerId?: string;
}

export interface VerifyKitResponse {
  result: VerificationResult;
  detectedItems: Array<{
    type: string;
    confidence: number;
  }>;
  missingItems: Array<{
    itemId: string;
    itemType: string;
  }>;
  requiresVlmFallback: boolean;
  estimatedCost?: number;
  verificationId: string;
}

export interface VerificationHistoryParams {
  technicianId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface VerificationHistoryResponse {
  verifications: VisionVerificationRecord[];
  stats: {
    totalVerifications: number;
    successRate: number; // percentage
    avgProcessingTimeMs: number;
    totalCostUsd: number;
  };
}

// FPS throttle controller types
export interface FpsThrottleConfig {
  targetFps: number; // default 1
  toleranceFps: number; // default 0.1
}

export interface FrameCaptureEvent {
  frameId: string;
  timestamp: Date;
  blob: Blob;
  actualFps: number;
}

// Container detection types
export interface ContainerBoundary {
  containerId: string;
  containerType: 'truck' | 'trailer' | 'bin';
  boundingBox: BoundingBox;
  confidence: number;
}

export interface ContainerDetectionResult {
  containers: ContainerBoundary[];
  itemsInContainers: Map<string, YoloDetection[]>; // containerId -> items
}
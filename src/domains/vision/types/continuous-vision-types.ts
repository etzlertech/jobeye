// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/vision/types/continuous-vision-types.ts
// phase: 4
// domain: vision-pipeline
// purpose: Types for continuous real-time vision verification
// spec_ref: phase4/vision#continuous-verification
// version: 2025-08-1
// complexity_budget: 200 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/vision/types/vision-types
//     - /src/core/types/base-types
//   external:
//     - zod: ^3.22.0
//
// exports:
//   - LoadVerificationSession: interface - Active verification session
//   - FrameAnalysis: interface - Single frame analysis result
//   - IncrementalUpdate: interface - Frame-to-frame changes
//   - ContinuousVisionConfig: interface - System configuration
//
// voice_considerations: |
//   Voice feedback for verification progress.
//   Natural language item confirmation.
//   Voice alerts for issues.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/vision/types/continuous-vision-types.test.ts
//
// tasks:
//   1. Define session management types
//   2. Create frame analysis types
//   3. Add incremental update types
//   4. Define context detection types
//   5. Create feedback types
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
import { DetectedItem, DetectedContainer } from '../services/multi-object-vision-service';

// Continuous capture configuration
export interface ContinuousVisionConfig {
  captureRate: number; // frames per second
  autoProcessing: boolean;
  backgroundMode: boolean;
  batteryOptimized: boolean;
  motionDetectionEnabled: boolean;
  lowBatteryThreshold: number; // percentage
  offlineQueueSize: number; // max frames to queue
}

// GPS location data
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  altitude?: number;
  heading?: number;
}

// Network conditions
export type NetworkCondition = 'wifi' | '4g' | '5g' | 'offline';

// Active verification session
export interface LoadVerificationSession {
  id: string;
  jobId: string;
  startedAt: Date;
  lastActiveAt: Date;
  location: LocationData;
  
  // Persistent state
  verifiedItems: Set<string>; // Checklist item IDs
  detectedContainers: Map<string, DetectedContainer>;
  currentContainer?: string;
  
  // Session metadata
  totalFramesProcessed: number;
  totalItemsVerified: number;
  batteryLevelStart: number;
  currentBatteryLevel?: number;
  networkConditions: NetworkCondition;
  
  // Performance tracking
  averageProcessingTimeMs?: number;
  totalProcessingTimeMs?: number;
  skippedFrames?: number;
}

// Single frame analysis result
export interface FrameAnalysis {
  timestamp: Date;
  frameNumber?: number;
  detectedItems: DetectedItem[];
  detectedContainers: DetectedContainer[];
  confidence: number;
  processingTimeMs: number;
  skipped?: boolean;
  skipReason?: string;
}

// Incremental changes between frames
export interface IncrementalUpdate {
  newlyVerifiedItems: string[];
  maintainedItems: string[]; // Still visible from previous frame
  removedItems: string[]; // No longer visible
  confidenceBoosts: Map<string, number>; // Item ID to boost amount
  warnings?: Array<{
    type: 'wrong_container' | 'low_confidence' | 'item_removed';
    itemId: string;
    message?: string;
    expectedContainer?: string;
    actualContainer?: string;
  }>;
  skipped?: boolean;
  reason?: string;
}

// Context detection result
export interface ActiveJobContext {
  job: {
    id: string;
    scheduledStart: Date;
    location?: LocationData;
    assignedContainers?: string[];
    unfinishedItems: number;
  };
  loadList: any[]; // JobChecklistItem[]
  unfinishedItems: any[]; // JobChecklistItem[]
  lastActivity?: Date;
  confidenceScore: number;
}

// Container to job matching
export interface JobContainerMatch {
  jobId: string;
  containerId: string;
  matchConfidence: number;
  matchReasons: Array<'gps_proximity' | 'container_id_match' | 'time_continuity' | 'user_assignment'>;
}

// Context switch result
export interface ContextSwitchResult {
  jobSwitched: boolean;
  previousJobId?: string;
  newJobId?: string;
  reason: 'container_change' | 'location_change' | 'user_selection' | 'timeout';
  savedState?: LoadVerificationSession;
}

// User feedback
export interface UserFeedback {
  messages: string[];
  itemStatuses: Record<string, 'newly_verified' | 'already_verified' | 'warning' | 'error'>;
  progressPercentage: number;
  warnings?: string[];
  suggestions?: string[];
}

// Processing configuration based on conditions
export interface ProcessingConfig {
  frameRate: number;
  useLocalModel: boolean;
  skipNonEssential: boolean;
  maxProcessingTimeMs: number;
  compressionQuality: number;
}

// Frame processing request
export interface FrameProcessRequest {
  frameData: Buffer | ArrayBuffer | string;
  session: LoadVerificationSession;
  previousFrame?: FrameAnalysis;
  forceProcessing?: boolean;
  location?: LocationData;
}

// Validation schemas

export const LocationDataSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  altitude: z.number().optional(),
  heading: z.number().min(0).max(360).optional(),
});

export const LoadVerificationSessionSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  startedAt: z.date(),
  lastActiveAt: z.date(),
  location: LocationDataSchema,
  verifiedItems: z.set(z.string()),
  detectedContainers: z.map(z.string(), z.any()),
  currentContainer: z.string().optional(),
  totalFramesProcessed: z.number().int().min(0),
  totalItemsVerified: z.number().int().min(0),
  batteryLevelStart: z.number().min(0).max(100),
  currentBatteryLevel: z.number().min(0).max(100).optional(),
  networkConditions: z.enum(['wifi', '4g', '5g', 'offline']),
});

export const FrameAnalysisSchema = z.object({
  timestamp: z.date(),
  frameNumber: z.number().int().optional(),
  detectedItems: z.array(z.any()),
  detectedContainers: z.array(z.any()),
  confidence: z.number().min(0).max(1),
  processingTimeMs: z.number().positive(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
});

// Helper functions

export const calculateDistance = (loc1: LocationData, loc2: LocationData): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = loc1.latitude * Math.PI / 180;
  const φ2 = loc2.latitude * Math.PI / 180;
  const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

export const isSessionActive = (session: LoadVerificationSession, maxIdleMinutes: number = 30): boolean => {
  const idleTime = Date.now() - session.lastActiveAt.getTime();
  return idleTime < maxIdleMinutes * 60 * 1000;
};

export const shouldSkipFrame = (
  currentFrame: Buffer,
  previousFrame?: FrameAnalysis,
  motionThreshold: number = 0.05
): boolean => {
  if (!previousFrame || previousFrame.skipped) return false;
  
  // In real implementation, would use motion detection algorithm
  // For now, always process if more than 1 second has passed
  const timeDiff = Date.now() - previousFrame.timestamp.getTime();
  return timeDiff < 1000;
};
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/vision/services/continuous-vision-verification-service.ts
// phase: 4
// domain: vision-pipeline
// purpose: Continuous real-time vision verification with state management
// spec_ref: phase4/vision#continuous-verification
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/vision/services/multi-object-vision-service
//     - /src/domains/vision/types/continuous-vision-types
//     - /src/core/logger/voice-logger
//   external:
//     - none
//
// exports:
//   - ContinuousVisionVerificationService: class - Main continuous verification service
//   - processFrame: function - Process single frame with state
//   - detectActiveJob: function - GPS-based job detection
//   - resumeSession: function - Resume previous session
//
// estimated_llm_cost:
//   tokens_per_operation: 3000
//   operations_per_day: 10000 (1 FPS * hours of operation)
//   monthly_cost_usd: 900.00
//
// voice_considerations: |
//   Real-time voice feedback for verification.
//   Progress announcements.
//   Warning alerts for issues.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/vision/services/continuous-vision-verification.test.ts
//
// tasks:
//   1. Implement frame processing pipeline
//   2. Add state management
//   3. Create context detection
//   4. Implement session persistence
//   5. Add performance optimizations
//   6. Create feedback generation
// --- END DIRECTIVE BLOCK ---

import { VoiceLogger } from '@/core/logger/voice-logger';
import { MultiObjectVisionService } from './multi-object-vision-service';
import {
  LoadVerificationSession,
  FrameAnalysis,
  IncrementalUpdate,
  ActiveJobContext,
  JobContainerMatch,
  ContextSwitchResult,
  UserFeedback,
  ProcessingConfig,
  LocationData,
  calculateDistance,
  isSessionActive,
  shouldSkipFrame,
} from '../types/continuous-vision-types';

export class ContinuousVisionVerificationService {
  private visionService: MultiObjectVisionService;
  private logger: VoiceLogger;
  private confidenceThreshold = 0.7;
  private maxSessionIdleMinutes = 30;
  private maxLocationDriftMeters = 100;

  constructor(logger?: VoiceLogger) {
    this.logger = logger || new VoiceLogger();
    this.visionService = new MultiObjectVisionService(this.logger);
  }

  /**
   * Process a single frame with incremental state updates
   */
  async processFrame(
    frameData: Buffer | ArrayBuffer | string,
    session: LoadVerificationSession,
    previousFrame?: FrameAnalysis
  ): Promise<IncrementalUpdate> {
    try {
      // Check if we should skip this frame
      if (shouldSkipFrame(frameData as Buffer, previousFrame)) {
        return {
          newlyVerifiedItems: [],
          maintainedItems: Array.from(session.verifiedItems),
          removedItems: [],
          confidenceBoosts: new Map(),
          skipped: true,
          reason: 'no_motion_detected',
        };
      }

      // Process frame through vision service
      const analysis = await this.analyzeFrame(frameData, session);
      
      // Update session state
      session.lastActiveAt = new Date();
      session.totalFramesProcessed++;

      // Calculate incremental updates
      const update = this.calculateIncrementalUpdate(
        analysis,
        session,
        previousFrame
      );

      // Update verified items count based on new items
      session.totalItemsVerified += update.newlyVerifiedItems.length;

      // Update verified items
      update.newlyVerifiedItems.forEach(itemId => {
        session.verifiedItems.add(itemId);
      });

      // Update detected containers
      analysis.detectedContainers.forEach(container => {
        if (container.containerId) {
          session.detectedContainers.set(container.containerId, container);
        }
      });

      // Log the update
      await this.logger.info('Frame processed', {
        sessionId: session.id,
        frameNumber: session.totalFramesProcessed,
        newItems: update.newlyVerifiedItems.length,
        totalVerified: session.verifiedItems.size,
      });

      return update;
    } catch (error) {
      await this.logger.error('Failed to process frame', error as Error);
      throw error;
    }
  }

  /**
   * Detect active job based on GPS location
   */
  async detectActiveJob(
    location: GeolocationPosition,
    userId: string,
    companyId: string
  ): Promise<ActiveJobContext | null> {
    try {
      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };

      // Mock implementation - would call job service
      const nearbyJobs = await this.getNearbyJobs(locationData, companyId);
      
      if (nearbyJobs.length === 0) return null;

      // Find closest job
      let closestJob = nearbyJobs[0];
      let minDistance = Infinity;

      for (const job of nearbyJobs) {
        if (job.location) {
          const distance = calculateDistance(locationData, job.location);
          if (distance < minDistance) {
            minDistance = distance;
            closestJob = job;
          }
        }
      }

      // Calculate confidence based on distance
      const confidenceScore = Math.max(0, 1 - (minDistance / 500)); // 500m max range

      return {
        job: closestJob,
        loadList: [], // Would fetch from job service
        unfinishedItems: [], // Would calculate
        lastActivity: closestJob.lastActivity,
        confidenceScore,
      };
    } catch (error) {
      await this.logger.error('Failed to detect active job', error as Error);
      return null;
    }
  }

  /**
   * Match detected container to a job
   */
  async matchContainerToJob(
    detectedContainer: any,
    nearbyJobs: any[]
  ): Promise<JobContainerMatch | null> {
    for (const job of nearbyJobs) {
      if (job.assignedContainers?.includes(detectedContainer.containerId)) {
        return {
          jobId: job.id,
          containerId: detectedContainer.containerId,
          matchConfidence: 0.95,
          matchReasons: ['container_id_match'],
        };
      }
    }
    return null;
  }

  /**
   * Resume a previous session if conditions match
   */
  async resumeSession(
    jobId: string,
    currentLocation: LocationData,
    detectedContainer?: string
  ): Promise<LoadVerificationSession | null> {
    try {
      // Mock implementation - would load from state store
      const savedSession = await this.loadSession(jobId);
      
      if (!savedSession) return null;

      // Check if session is still active
      if (!isSessionActive(savedSession, this.maxSessionIdleMinutes)) {
        await this.logger.info('Session expired', { 
          sessionId: savedSession.id,
          idleMinutes: (Date.now() - savedSession.lastActiveAt.getTime()) / 60000,
        });
        return null;
      }

      // Check location drift
      const locationDrift = calculateDistance(currentLocation, savedSession.location);
      if (locationDrift > this.maxLocationDriftMeters) {
        await this.logger.info('Location drift too large', {
          sessionId: savedSession.id,
          driftMeters: locationDrift,
        });
        return null;
      }

      // Verify container match if provided
      if (detectedContainer && savedSession.currentContainer !== detectedContainer) {
        await this.logger.info('Container mismatch', {
          sessionId: savedSession.id,
          expected: savedSession.currentContainer,
          detected: detectedContainer,
        });
        return null;
      }

      // Resume session
      await this.logger.info('Session resumed', {
        sessionId: savedSession.id,
        verifiedItems: savedSession.verifiedItems.size,
        idleMinutes: (Date.now() - savedSession.lastActiveAt.getTime()) / 60000,
      });

      return savedSession;
    } catch (error) {
      await this.logger.error('Failed to resume session', error as Error);
      return null;
    }
  }

  /**
   * Handle container switch during active session
   */
  async handleContainerSwitch(
    currentSession: LoadVerificationSession,
    newContainer: any,
    location: LocationData
  ): Promise<ContextSwitchResult> {
    try {
      // Save current session state
      await this.saveSession(currentSession);

      // Find job for new container
      const nearbyJobs = await this.getNearbyJobs(location, 'company-id');
      const match = await this.matchContainerToJob(newContainer, nearbyJobs);

      if (match && match.jobId !== currentSession.jobId) {
        return {
          jobSwitched: true,
          previousJobId: currentSession.jobId,
          newJobId: match.jobId,
          reason: 'container_change',
          savedState: currentSession,
        };
      }

      return {
        jobSwitched: false,
        reason: 'container_change',
      };
    } catch (error) {
      await this.logger.error('Failed to handle container switch', error as Error);
      return {
        jobSwitched: false,
        reason: 'container_change',
      };
    }
  }

  /**
   * Get processing configuration based on conditions
   */
  async getProcessingConfig(session: LoadVerificationSession): Promise<ProcessingConfig> {
    const batteryLevel = session.currentBatteryLevel || session.batteryLevelStart;
    const isLowBattery = batteryLevel < 20;
    const isOffline = session.networkConditions === 'offline';

    return {
      frameRate: isLowBattery ? 0.5 : 1.0,
      useLocalModel: isLowBattery || isOffline,
      skipNonEssential: isLowBattery,
      maxProcessingTimeMs: isLowBattery ? 500 : 1000,
      compressionQuality: isLowBattery ? 0.6 : 0.8,
    };
  }

  /**
   * Generate user feedback from frame update
   */
  generateUserFeedback(
    update: IncrementalUpdate,
    session: LoadVerificationSession
  ): UserFeedback {
    const messages: string[] = [];
    const itemStatuses: Record<string, any> = {};

    // New items message
    if (update.newlyVerifiedItems.length > 0) {
      messages.push(`✓ ${update.newlyVerifiedItems.length} new items verified`);
      update.newlyVerifiedItems.forEach(id => {
        itemStatuses[id] = 'newly_verified';
      });
    }

    // Already verified items
    update.maintainedItems.forEach(id => {
      itemStatuses[id] = 'already_verified';
    });

    // Calculate progress
    const totalItems = 10; // Would get from job
    const progressPercentage = (session.verifiedItems.size / totalItems) * 100;

    // Warnings
    const warnings: string[] = [];
    if (update.warnings) {
      update.warnings.forEach(warning => {
        if (warning.type === 'wrong_container') {
          warnings.push(`Item in wrong container: ${warning.itemId}`);
          itemStatuses[warning.itemId] = 'warning';
        }
      });
    }

    return {
      messages,
      itemStatuses,
      progressPercentage,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Private helper methods

  public async analyzeFrame(
    frameData: Buffer | ArrayBuffer | string,
    session: LoadVerificationSession
  ): Promise<FrameAnalysis> {
    const startTime = Date.now();
    
    // Mock implementation for testing
    // In real implementation, would call:
    // const result = await this.visionService.analyzeLoadingScene({
    //   imageData: frameData,
    //   loadRequirements: this.getLoadRequirements(session),
    //   knownContainers: Array.from(session.detectedContainers.values()),
    //   jobContext: { jobId: session.jobId }
    // });
    
    // For now, return mock data that can be controlled by tests
    const mockItems: DetectedItem[] = [];
    const mockContainers = Array.from(session.detectedContainers.values());

    return {
      timestamp: new Date(),
      detectedItems: mockItems,
      detectedContainers: mockContainers,
      confidence: 0.85,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private calculateIncrementalUpdate(
    currentFrame: FrameAnalysis,
    session: LoadVerificationSession,
    previousFrame?: FrameAnalysis
  ): IncrementalUpdate {
    const newlyVerifiedItems: string[] = [];
    const maintainedItems: string[] = [];
    const removedItems: string[] = [];
    const confidenceBoosts = new Map<string, number>();

    // Find new items above confidence threshold
    currentFrame.detectedItems.forEach(item => {
      if (item.itemId && item.confidence >= this.confidenceThreshold) {
        if (!session.verifiedItems.has(item.itemId)) {
          newlyVerifiedItems.push(item.itemId);
        } else {
          maintainedItems.push(item.itemId);
        }
      }
    });

    // Find removed items (in previous but not current)
    if (previousFrame) {
      previousFrame.detectedItems.forEach(prevItem => {
        if (prevItem.itemId) {
          const stillExists = currentFrame.detectedItems.some(
            item => item.itemId === prevItem.itemId
          );
          if (!stillExists && !removedItems.includes(prevItem.itemId)) {
            removedItems.push(prevItem.itemId);
          }
        }
      });

      // Calculate confidence boosts
      currentFrame.detectedItems.forEach(item => {
        if (item.itemId) {
          const prevItem = previousFrame.detectedItems.find(
            p => p.itemId === item.itemId
          );
          if (prevItem && item.confidence > prevItem.confidence) {
            confidenceBoosts.set(item.itemId, item.confidence - prevItem.confidence);
          }
        }
      });
    }

    return {
      newlyVerifiedItems,
      maintainedItems,
      removedItems,
      confidenceBoosts,
    };
  }

  private async getNearbyJobs(location: LocationData, companyId: string): Promise<any[]> {
    // Mock implementation
    return [
      {
        id: 'job-123',
        scheduledStart: new Date(),
        location: {
          latitude: location.latitude + 0.0002,
          longitude: location.longitude + 0.0002,
        },
        assignedContainers: ['container-1'],
        unfinishedItems: 5,
      },
    ];
  }

  private async loadSession(jobId: string): Promise<LoadVerificationSession | null> {
    // Mock implementation - would load from state store
    return null;
  }

  private async saveSession(session: LoadVerificationSession): Promise<void> {
    // Mock implementation - would save to state store
    await this.logger.info('Session saved', {
      sessionId: session.id,
      verifiedItems: session.verifiedItems.size,
    });
  }

  /**
   * Detect motion between frames (mock implementation)
   */
  private detectMotion(
    currentFrame: Buffer,
    previousFrame?: FrameAnalysis
  ): boolean {
    // In real implementation, would use computer vision motion detection
    return true; // Always detect motion for now
  }
}
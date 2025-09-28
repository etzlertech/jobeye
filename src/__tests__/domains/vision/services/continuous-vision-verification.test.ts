// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import { ContinuousVisionVerificationService } from '@/domains/vision/services/continuous-vision-verification-service';
import { LoadVerificationSession, FrameAnalysis, IncrementalUpdate } from '@/domains/vision/types/continuous-vision-types';
import { Container } from '@/domains/equipment/types/container-types';

// Mock the multi-object vision service
jest.mock('@/domains/vision/services/multi-object-vision-service');
jest.mock('@/core/logger/voice-logger');
jest.mock('@/domains/vision/types/continuous-vision-types', () => ({
  ...jest.requireActual('@/domains/vision/types/continuous-vision-types'),
  shouldSkipFrame: jest.fn().mockReturnValue(false),
}));

describe('ContinuousVisionVerificationService', () => {
  let service: ContinuousVisionVerificationService;
  let mockSession: LoadVerificationSession;

  beforeEach(() => {
    jest.clearAllMocks();
    
    service = new ContinuousVisionVerificationService();
    
    mockSession = {
      id: 'session-123',
      jobId: 'job-123',
      startedAt: new Date(),
      lastActiveAt: new Date(),
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
      },
      verifiedItems: new Set(['item-1', 'item-2']),
      detectedContainers: new Map([
        ['container-1', {
          containerId: 'container-1',
          containerType: 'truck',
          color: 'red',
          identifier: 'VH-TKR',
          confidence: 0.95,
        }],
      ]),
      currentContainer: 'container-1',
      totalFramesProcessed: 10,
      totalItemsVerified: 2,
      batteryLevelStart: 85,
      networkConditions: 'wifi',
    };
  });

  describe('processFrame', () => {
    it('should detect and verify new items while preserving previous checks', async () => {
      const frameData = Buffer.from('test-image-data');
      
      // Mock the analyzeFrame method to return 3 items (2 old, 1 new)
      const mockAnalysis: FrameAnalysis = {
        timestamp: new Date(),
        detectedItems: [
          {
            itemType: 'equipment',
            itemId: 'item-1',
            itemName: 'Chainsaw',
            confidence: 0.9,
            containerId: 'container-1',
          },
          {
            itemType: 'equipment',
            itemId: 'item-2',
            itemName: 'Mower',
            confidence: 0.88,
            containerId: 'container-1',
          },
          {
            itemType: 'material',
            itemId: 'item-3',
            itemName: 'Gas Can',
            confidence: 0.85,
            containerId: 'container-1',
          },
        ],
        detectedContainers: [{
          containerId: 'container-1',
          containerType: 'truck',
          color: 'red',
          identifier: 'VH-TKR',
          confidence: 0.95,
        }],
        confidence: 0.88,
        processingTimeMs: 250,
      };

      // Mock the analyzeFrame method directly on the service instance
      jest.spyOn(service, 'analyzeFrame').mockResolvedValueOnce(mockAnalysis);

      const result = await service.processFrame(frameData, mockSession);

      expect(result.newlyVerifiedItems).toEqual(['item-3']);
      expect(result.maintainedItems).toEqual(['item-1', 'item-2']);
      expect(result.removedItems).toEqual([]);
      
      // Session should now have 3 verified items
      expect(mockSession.verifiedItems.size).toBe(3);
      expect(mockSession.verifiedItems.has('item-3')).toBe(true);
      expect(mockSession.totalItemsVerified).toBe(3);
      expect(mockSession.totalFramesProcessed).toBe(11);
    });

    it('should handle items that disappear from view', async () => {
      const frameData = Buffer.from('test-image-data');
      
      // Previous frame analysis showing both items
      const previousFrame: FrameAnalysis = {
        timestamp: new Date(Date.now() - 1000),
        detectedItems: [
          {
            itemType: 'equipment',
            itemId: 'item-1',
            itemName: 'Chainsaw',
            confidence: 0.9,
            containerId: 'container-1',
          },
          {
            itemType: 'equipment',
            itemId: 'item-2',
            itemName: 'Mower',
            confidence: 0.88,
            containerId: 'container-1',
          },
        ],
        detectedContainers: [],
        confidence: 0.9,
        processingTimeMs: 200,
      };
      
      // Current frame analysis showing only 1 of the 2 items
      const mockAnalysis: FrameAnalysis = {
        timestamp: new Date(),
        detectedItems: [
          {
            itemType: 'equipment',
            itemId: 'item-1',
            itemName: 'Chainsaw',
            confidence: 0.9,
            containerId: 'container-1',
          },
        ],
        detectedContainers: [{
          containerId: 'container-1',
          containerType: 'truck',
          color: 'red',
          identifier: 'VH-TKR',
          confidence: 0.95,
        }],
        confidence: 0.9,
        processingTimeMs: 200,
      };

      // Mock the analyzeFrame method directly on the service instance
      jest.spyOn(service, 'analyzeFrame').mockResolvedValueOnce(mockAnalysis);

      const result = await service.processFrame(frameData, mockSession, previousFrame);

      expect(result.newlyVerifiedItems).toEqual([]);
      expect(result.maintainedItems).toEqual(['item-1']);
      expect(result.removedItems).toEqual(['item-2']); // item-2 was in previous frame but not in current
      
      // Verified items should still include item-2 (once verified, stays verified)
      expect(mockSession.verifiedItems.size).toBe(2);
      expect(mockSession.verifiedItems.has('item-2')).toBe(true);
    });

    it('should boost confidence for items seen multiple times', async () => {
      const frameData = Buffer.from('test-image-data');
      
      // First frame
      const firstAnalysis: FrameAnalysis = {
        timestamp: new Date(),
        detectedItems: [
          {
            itemType: 'equipment',
            itemId: 'item-new',
            itemName: 'Trimmer',
            confidence: 0.65, // Below threshold
            containerId: 'container-1',
          },
        ],
        detectedContainers: [],
        confidence: 0.65,
        processingTimeMs: 200,
      };

      // Mock the analyzeFrame method directly on the service instance
      jest.spyOn(service, 'analyzeFrame').mockResolvedValueOnce(firstAnalysis);

      const result1 = await service.processFrame(frameData, mockSession);
      expect(result1.newlyVerifiedItems).toEqual([]); // Not verified yet

      // Second frame - same item with higher confidence
      const secondAnalysis: FrameAnalysis = {
        timestamp: new Date(),
        detectedItems: [
          {
            itemType: 'equipment',
            itemId: 'item-new',
            itemName: 'Trimmer',
            confidence: 0.75, // Now above threshold
            containerId: 'container-1',
          },
        ],
        detectedContainers: [],
        confidence: 0.75,
        processingTimeMs: 200,
      };

      jest.spyOn(service, 'analyzeFrame').mockResolvedValueOnce(secondAnalysis);

      const result2 = await service.processFrame(frameData, mockSession, firstAnalysis);
      
      expect(result2.newlyVerifiedItems).toEqual(['item-new']);
      expect(result2.confidenceBoosts.get('item-new')).toBeGreaterThan(0);
    });
  });

  describe('detectActiveJob', () => {
    it('should detect job based on GPS location', async () => {
      const location = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
        timestamp: Date.now(),
      } as GeolocationPosition;

      // Mock the getNearbyJobs method
      jest.spyOn(service as any, 'getNearbyJobs').mockResolvedValueOnce([
        {
          id: 'job-123',
          scheduledStart: new Date(),
          location: {
            latitude: 40.7130,
            longitude: -74.0062,
          },
          unfinishedItems: 5,
          lastActivity: new Date(),
        },
        {
          id: 'job-456',
          scheduledStart: new Date(),
          location: {
            latitude: 40.8000,
            longitude: -74.1000,
          },
          unfinishedItems: 3,
        },
      ]);

      const result = await service.detectActiveJob(location, 'user-1', 'company-1');

      expect(result).not.toBeNull();
      expect(result?.job.id).toBe('job-123'); // Closest job
      expect(result?.confidenceScore).toBeGreaterThan(0.8); // High confidence due to proximity
    });

    it('should match container to correct job', async () => {
      const detectedContainer = {
        containerId: 'container-1',
        containerType: 'truck',
        identifier: 'VH-TKR',
        confidence: 0.95,
      };

      const nearbyJobs = [
        {
          id: 'job-123',
          assignedContainers: ['container-1', 'container-2'],
          unfinishedItems: 5,
        },
        {
          id: 'job-456',
          assignedContainers: ['container-3'],
          unfinishedItems: 3,
        },
      ];

      const result = await service.matchContainerToJob(detectedContainer, nearbyJobs);

      expect(result).not.toBeNull();
      expect(result?.jobId).toBe('job-123');
      expect(result?.matchReasons).toContain('container_id_match');
    });
  });

  describe('resumeSession', () => {
    it('should resume previous session if location and container match', async () => {
      const savedSession = {
        ...mockSession,
        lastActiveAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      };

      // Mock the loadSession method
      jest.spyOn(service as any, 'loadSession').mockResolvedValueOnce(savedSession);

      const currentLocation = {
        latitude: 40.7129,
        longitude: -74.0061,
        accuracy: 15,
      };

      const result = await service.resumeSession('job-123', currentLocation, 'container-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('session-123');
      expect(result?.verifiedItems.size).toBe(2);
    });

    it('should create new session if too much time has passed', async () => {
      const oldSession = {
        ...mockSession,
        lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };

      // Mock the loadSession method
      jest.spyOn(service as any, 'loadSession').mockResolvedValueOnce(oldSession);

      const currentLocation = {
        latitude: 40.7129,
        longitude: -74.0061,
        accuracy: 15,
      };

      const result = await service.resumeSession('job-123', currentLocation, 'container-1');

      expect(result).toBeNull(); // Should not resume old session
    });

    it('should create new session if location changed significantly', async () => {
      const savedSession = {
        ...mockSession,
        lastActiveAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      };

      // Mock the loadSession method
      jest.spyOn(service as any, 'loadSession').mockResolvedValueOnce(savedSession);

      const differentLocation = {
        latitude: 40.8000, // Different location
        longitude: -74.1000,
        accuracy: 10,
      };

      const result = await service.resumeSession('job-123', differentLocation, 'container-1');

      expect(result).toBeNull(); // Should not resume due to location change
    });
  });

  describe('handleContainerSwitch', () => {
    it('should switch active job when different container detected', async () => {
      const currentSession = { ...mockSession };
      
      const newContainer = {
        containerId: 'container-2',
        containerType: 'trailer',
        identifier: 'TR-DU12R',
        confidence: 0.92,
      };

      const mockJobs = [
        {
          id: 'job-456',
          assignedContainers: ['container-2'],
          unfinishedItems: 8,
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
          },
        },
      ];

      // Mock the getNearbyJobs method
      jest.spyOn(service as any, 'getNearbyJobs').mockResolvedValueOnce(mockJobs);
      // Mock the saveSession method
      jest.spyOn(service as any, 'saveSession').mockResolvedValueOnce(undefined);

      const result = await service.handleContainerSwitch(
        currentSession,
        newContainer,
        currentSession.location
      );

      expect(result.jobSwitched).toBe(true);
      expect(result.newJobId).toBe('job-456');
      expect(result.reason).toBe('container_change');
    });
  });

  describe('Performance optimizations', () => {
    it('should skip processing identical frames', async () => {
      const frameData = Buffer.from('test-image-data');
      const previousFrame: FrameAnalysis = {
        timestamp: new Date(Date.now() - 500), // 0.5 seconds ago
        detectedItems: [{
          itemType: 'equipment',
          itemId: 'item-1',
          itemName: 'Chainsaw',
          confidence: 0.9,
          containerId: 'container-1',
        }],
        detectedContainers: [],
        confidence: 0.9,
        processingTimeMs: 200,
      };

      // Mock shouldSkipFrame to return true (no motion detected)
      const shouldSkipFrameMock = jest.requireMock('@/domains/vision/types/continuous-vision-types').shouldSkipFrame;
      shouldSkipFrameMock.mockReturnValueOnce(true);

      const result = await service.processFrame(frameData, mockSession, previousFrame);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_motion_detected');
      expect(mockSession.totalFramesProcessed).toBe(10); // Not incremented
    });

    it('should reduce processing rate on low battery', async () => {
      const lowBatterySession = {
        ...mockSession,
        batteryLevelStart: 85,
        currentBatteryLevel: 15, // Low battery
      };

      const processingConfig = await service.getProcessingConfig(lowBatterySession);

      expect(processingConfig.frameRate).toBeLessThan(1); // Reduced from 1 FPS
      expect(processingConfig.useLocalModel).toBe(true); // Prefer local processing
      expect(processingConfig.skipNonEssential).toBe(true);
    });
  });

  describe('Real-time feedback generation', () => {
    it('should generate appropriate user feedback', async () => {
      const frameAnalysis: IncrementalUpdate = {
        newlyVerifiedItems: ['item-3', 'item-4'],
        maintainedItems: ['item-1', 'item-2'],
        removedItems: [],
        confidenceBoosts: new Map([['item-5', 0.1]]),
      };

      const feedback = service.generateUserFeedback(frameAnalysis, mockSession);

      expect(feedback.messages).toContain('✓ 2 new items verified');
      expect(feedback.itemStatuses).toHaveProperty('item-3', 'newly_verified');
      expect(feedback.itemStatuses).toHaveProperty('item-1', 'already_verified');
      expect(feedback.progressPercentage).toBeGreaterThan(0);
    });

    it('should warn about wrong container placement', async () => {
      const wrongContainerUpdate: IncrementalUpdate = {
        newlyVerifiedItems: [],
        maintainedItems: [],
        removedItems: [],
        confidenceBoosts: new Map(),
        warnings: [{
          type: 'wrong_container',
          itemId: 'item-5',
          expectedContainer: 'container-1',
          actualContainer: 'container-2',
        }],
      };

      const feedback = service.generateUserFeedback(wrongContainerUpdate, mockSession);

      expect(feedback.warnings).toHaveLength(1);
      expect(feedback.warnings[0]).toContain('wrong container');
    });
  });
});
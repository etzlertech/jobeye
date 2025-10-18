/**
 * @file batch-verification.service.test.ts
 * @purpose Unit tests for batch verification service
 * @coverage_target ≥90%
 */

import { BatchVerificationService } from '../../services/batch-verification.service';
import { VisionVerificationService } from '../../services/vision-verification.service';

// Mock the vision verification service
jest.mock('../../services/vision-verification.service');

describe('BatchVerificationService', () => {
  let service: BatchVerificationService;
  let mockVisionService: jest.Mocked<VisionVerificationService>;

  beforeEach(() => {
    mockVisionService = new VisionVerificationService(null as any) as jest.Mocked<VisionVerificationService>;
    service = new BatchVerificationService(mockVisionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyBatch', () => {
    it('should verify multiple photos successfully', async () => {
      // Arrange
      const photos = [
        { data: new Uint8ClampedArray(400), containerId: 'truck' },
        { data: new Uint8ClampedArray(400), containerId: 'trailer' }
      ];

      mockVisionService.verifyKit = jest.fn()
        .mockResolvedValueOnce({
          verificationId: 'vrfy-001',
          verified: true,
          detectedItems: ['mower', 'trimmer'],
          missingItems: [],
          confidence: 0.92,
          cost: 0.00
        })
        .mockResolvedValueOnce({
          verificationId: 'vrfy-002',
          verified: true,
          detectedItems: ['blower', 'edger'],
          missingItems: [],
          confidence: 0.89,
          cost: 0.00
        });

      // Act
      const result = await service.verifyBatch({
        photos,
        kitId: 'kit-001',
        tenantId: 'company-123'
      });

      // Assert
      expect(result.verified).toBe(true);
      expect(result.verifications).toHaveLength(2);
      expect(result.allDetectedItems).toEqual(['mower', 'trimmer', 'blower', 'edger']);
      expect(result.missingItems).toEqual([]);
      expect(result.totalCost).toBe(0.00);
    });

    it('should aggregate missing items across all photos', async () => {
      // Arrange
      const photos = [
        { data: new Uint8ClampedArray(400), containerId: 'truck' },
        { data: new Uint8ClampedArray(400), containerId: 'trailer' }
      ];

      mockVisionService.verifyKit = jest.fn()
        .mockResolvedValueOnce({
          verificationId: 'vrfy-001',
          verified: false,
          detectedItems: ['mower'],
          missingItems: ['chainsaw'],
          confidence: 0.90,
          cost: 0.00
        })
        .mockResolvedValueOnce({
          verificationId: 'vrfy-002',
          verified: false,
          detectedItems: ['blower'],
          missingItems: ['safety_harness'],
          confidence: 0.88,
          cost: 0.00
        });

      // Act
      const result = await service.verifyBatch({
        photos,
        kitId: 'kit-001',
        tenantId: 'company-123'
      });

      // Assert
      expect(result.verified).toBe(false);
      expect(result.missingItems).toContain('chainsaw');
      expect(result.missingItems).toContain('safety_harness');
    });

    it('should sum costs from all verifications', async () => {
      // Arrange
      const photos = [
        { data: new Uint8ClampedArray(400), containerId: 'truck' },
        { data: new Uint8ClampedArray(400), containerId: 'trailer' }
      ];

      mockVisionService.verifyKit = jest.fn()
        .mockResolvedValueOnce({
          verificationId: 'vrfy-001',
          verified: true,
          detectedItems: ['mower'],
          missingItems: [],
          confidence: 0.65,
          cost: 0.10,
          method: 'vlm'
        })
        .mockResolvedValueOnce({
          verificationId: 'vrfy-002',
          verified: true,
          detectedItems: ['blower'],
          missingItems: [],
          confidence: 0.92,
          cost: 0.00,
          method: 'yolo'
        });

      // Act
      const result = await service.verifyBatch({
        photos,
        kitId: 'kit-001',
        tenantId: 'company-123'
      });

      // Assert
      expect(result.totalCost).toBe(0.10);
      expect(result.verifications[0].cost).toBe(0.10);
      expect(result.verifications[1].cost).toBe(0.00);
    });

    it('should handle empty photo array', async () => {
      // Act & Assert
      await expect(service.verifyBatch({
        photos: [],
        kitId: 'kit-001',
        tenantId: 'company-123'
      })).rejects.toThrow(/at least one photo/);
    });

    it('should handle verification failure in one photo', async () => {
      // Arrange
      const photos = [
        { data: new Uint8ClampedArray(400), containerId: 'truck' },
        { data: new Uint8ClampedArray(400), containerId: 'trailer' }
      ];

      mockVisionService.verifyKit = jest.fn()
        .mockResolvedValueOnce({
          verificationId: 'vrfy-001',
          verified: true,
          detectedItems: ['mower'],
          missingItems: [],
          confidence: 0.92,
          cost: 0.00
        })
        .mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await service.verifyBatch({
        photos,
        kitId: 'kit-001',
        tenantId: 'company-123',
        continueOnError: true
      });

      // Assert
      expect(result.verifications).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/Network error/);
    });

    it('should associate verifications with container IDs', async () => {
      // Arrange
      const photos = [
        { data: new Uint8ClampedArray(400), containerId: 'truck_bed' },
        { data: new Uint8ClampedArray(400), containerId: 'trailer_01' }
      ];

      mockVisionService.verifyKit = jest.fn()
        .mockResolvedValue({
          verificationId: 'vrfy-001',
          verified: true,
          detectedItems: ['mower'],
          missingItems: [],
          confidence: 0.92,
          cost: 0.00
        });

      // Act
      const result = await service.verifyBatch({
        photos,
        kitId: 'kit-001',
        tenantId: 'company-123'
      });

      // Assert
      expect(result.verifications[0].containerId).toBe('truck_bed');
      expect(result.verifications[1].containerId).toBe('trailer_01');
    });
  });

  describe('estimateBatchCost', () => {
    it('should estimate cost based on photo count', () => {
      const estimate = service.estimateBatchCost(5);

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThanOrEqual(0.50); // 5 photos * $0.10 max
    });

    it('should return zero for no photos', () => {
      const estimate = service.estimateBatchCost(0);

      expect(estimate).toBe(0);
    });

    it('should scale linearly with photo count', () => {
      const estimate1 = service.estimateBatchCost(1);
      const estimate2 = service.estimateBatchCost(2);

      expect(estimate2).toBeGreaterThanOrEqual(estimate1 * 2);
    });
  });

  describe('getProgress', () => {
    it('should track batch verification progress', async () => {
      // Arrange
      const photos = [
        { data: new Uint8ClampedArray(400), containerId: 'truck' },
        { data: new Uint8ClampedArray(400), containerId: 'trailer' }
      ];

      let progressUpdates: number[] = [];
      const onProgress = (progress: number) => {
        progressUpdates.push(progress);
      };

      mockVisionService.verifyKit = jest.fn()
        .mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                verificationId: 'vrfy-001',
                verified: true,
                detectedItems: ['mower'],
                missingItems: [],
                confidence: 0.92,
                cost: 0.00
              });
            }, 10);
          });
        });

      // Act
      await service.verifyBatch({
        photos,
        kitId: 'kit-001',
        tenantId: 'company-123',
        onProgress
      });

      // Assert
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });
});
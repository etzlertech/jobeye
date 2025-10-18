/**
 * @file /src/domains/vision/__tests__/scenarios/batch-verification.scenario.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose End-to-end scenario tests for batch verification feature
 * @test_coverage Full scenario coverage
 */

import { getBatchVerificationService } from '../../services/batch-verification.service';
import { getVisionVerificationService } from '../../services/vision-verification.service';

// Mock dependencies
jest.mock('../../services/vision-verification.service');
jest.mock('../../lib/yolo-inference');
jest.mock('../../repositories/vision-verification.repository');
jest.mock('../../repositories/detected-item.repository');
jest.mock('../../repositories/cost-record.repository');

describe('Batch Verification - End-to-End Scenarios', () => {
  let batchService: ReturnType<typeof getBatchVerificationService>;
  let mockVerifyKit: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    batchService = getBatchVerificationService();

    // Mock the vision service's verifyKit method
    mockVerifyKit = jest.fn();
    (getVisionVerificationService as jest.Mock).mockReturnValue({
      verifyKit: mockVerifyKit
    });
  });

  describe('Scenario 1: Successful batch of 5 kits', () => {
    it('should process all 5 kits successfully with concurrency control', async () => {
      // Arrange: Create mock image data and expected items
      const createMockImageData = () => {
        const data = new Uint8ClampedArray(400); // 10x10 RGBA
        return new ImageData(data, 10, 10);
      };

      const batchItems = [
        { kitId: 'kit-001', imageData: createMockImageData(), expectedItems: ['wrench', 'hammer'] },
        { kitId: 'kit-002', imageData: createMockImageData(), expectedItems: ['screwdriver', 'pliers'] },
        { kitId: 'kit-003', imageData: createMockImageData(), expectedItems: ['drill', 'tape'] },
        { kitId: 'kit-004', imageData: createMockImageData(), expectedItems: ['level', 'saw'] },
        { kitId: 'kit-005', imageData: createMockImageData(), expectedItems: ['wrench', 'screwdriver'] }
      ];

      // Mock successful verifications
      mockVerifyKit.mockImplementation(async (request: any) => ({
        data: {
          verificationId: `ver-${request.kitId}`,
          verificationResult: 'complete',
          processingMethod: 'local_yolo',
          confidenceScore: 0.92,
          detectedItems: request.expectedItems.map((item: string) => ({
            itemType: item,
            confidence: 0.95,
            matchStatus: 'matched'
          })),
          missingItems: [],
          unexpectedItems: [],
          costUsd: 0,
          processingTimeMs: 250
        },
        error: null
      }));

      // Act: Process batch
      const result = await batchService.verifyBatch({
        tenantId: 'company-123',
        items: batchItems,
        concurrency: 2,
        maxBudgetUsd: 10.0,
        maxRequestsPerDay: 100
      });

      // Assert: All successful
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!.totalItems).toBe(5);
      expect(result.data!.completedItems).toBe(5);
      expect(result.data!.successCount).toBe(5);
      expect(result.data!.failureCount).toBe(0);
      expect(result.data!.results).toHaveLength(5);

      // Verify all results are successful
      result.data!.results.forEach((res) => {
        expect(res.success).toBe(true);
        expect(res.result).toBeDefined();
        expect(res.result!.verificationResult).toBe('complete');
      });

      // Verify verifyKit was called for each item
      expect(mockVerifyKit).toHaveBeenCalledTimes(5);
    });
  });

  describe('Scenario 2: Mixed success and failure batch', () => {
    it('should handle failures gracefully without stopping batch', async () => {
      // Arrange
      const createMockImageData = () => {
        const data = new Uint8ClampedArray(400);
        return new ImageData(data, 10, 10);
      };

      const batchItems = [
        { kitId: 'kit-001', imageData: createMockImageData(), expectedItems: ['wrench'] },
        { kitId: 'kit-002', imageData: createMockImageData(), expectedItems: ['hammer'] },
        { kitId: 'kit-003', imageData: createMockImageData(), expectedItems: ['drill'] }
      ];

      // Mock mixed results: success, failure, success
      mockVerifyKit
        .mockResolvedValueOnce({
          data: {
            verificationId: 'ver-001',
            verificationResult: 'complete',
            processingMethod: 'local_yolo',
            confidenceScore: 0.95,
            detectedItems: [{ itemType: 'wrench', confidence: 0.95, matchStatus: 'matched' }],
            missingItems: [],
            unexpectedItems: [],
            costUsd: 0,
            processingTimeMs: 200
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: {
            code: 'YOLO_FAILED',
            message: 'YOLO detection failed',
            details: {}
          }
        })
        .mockResolvedValueOnce({
          data: {
            verificationId: 'ver-003',
            verificationResult: 'complete',
            processingMethod: 'local_yolo',
            confidenceScore: 0.89,
            detectedItems: [{ itemType: 'drill', confidence: 0.89, matchStatus: 'matched' }],
            missingItems: [],
            unexpectedItems: [],
            costUsd: 0,
            processingTimeMs: 180
          },
          error: null
        });

      // Act
      const result = await batchService.verifyBatch({
        tenantId: 'company-123',
        items: batchItems,
        stopOnError: false,
        concurrency: 3
      });

      // Assert
      expect(result.error).toBeNull();
      expect(result.data!.successCount).toBe(2);
      expect(result.data!.failureCount).toBe(1);
      expect(result.data!.completedItems).toBe(3);

      // Check individual results
      expect(result.data!.results[0].success).toBe(true);
      expect(result.data!.results[1].success).toBe(false);
      expect(result.data!.results[1].error).toBeDefined();
      expect(result.data!.results[2].success).toBe(true);
    });
  });

  describe('Scenario 3: Stop on first error', () => {
    it('should stop processing when stopOnError is true', async () => {
      // Arrange
      const createMockImageData = () => {
        const data = new Uint8ClampedArray(400);
        return new ImageData(data, 10, 10);
      };

      const batchItems = [
        { kitId: 'kit-001', imageData: createMockImageData(), expectedItems: ['wrench'] },
        { kitId: 'kit-002', imageData: createMockImageData(), expectedItems: ['hammer'] },
        { kitId: 'kit-003', imageData: createMockImageData(), expectedItems: ['drill'] }
      ];

      // Mock: first fails
      mockVerifyKit.mockResolvedValueOnce({
        data: null,
        error: {
          code: 'YOLO_FAILED',
          message: 'YOLO detection failed'
        }
      });

      // Act
      const result = await batchService.verifyBatch({
        tenantId: 'company-123',
        items: batchItems,
        stopOnError: true,
        concurrency: 1
      });

      // Assert: Should stop after first failure
      expect(result.data!.completedItems).toBe(1);
      expect(result.data!.successCount).toBe(0);
      expect(result.data!.failureCount).toBe(1);

      // Only first item should be called
      expect(mockVerifyKit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 4: Large batch with concurrency control', () => {
    it('should process 15 kits with concurrency of 3', async () => {
      // Arrange
      const createMockImageData = () => {
        const data = new Uint8ClampedArray(400);
        return new ImageData(data, 10, 10);
      };

      const batchItems = Array.from({ length: 15 }, (_, i) => ({
        kitId: `kit-${String(i + 1).padStart(3, '0')}`,
        imageData: createMockImageData(),
        expectedItems: ['tool-1', 'tool-2']
      }));

      // Track call order to verify concurrency
      const callTimes: number[] = [];
      mockVerifyKit.mockImplementation(async () => {
        callTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing
        return {
          data: {
            verificationId: 'ver-' + Math.random(),
            verificationResult: 'complete',
            processingMethod: 'local_yolo',
            confidenceScore: 0.9,
            detectedItems: [
              { itemType: 'tool-1', confidence: 0.9, matchStatus: 'matched' },
              { itemType: 'tool-2', confidence: 0.9, matchStatus: 'matched' }
            ],
            missingItems: [],
            unexpectedItems: [],
            costUsd: 0,
            processingTimeMs: 100
          },
          error: null
        };
      });

      // Act
      const result = await batchService.verifyBatch({
        tenantId: 'company-123',
        items: batchItems,
        concurrency: 3
      });

      // Assert
      expect(result.data!.successCount).toBe(15);
      expect(mockVerifyKit).toHaveBeenCalledTimes(15);

      // Verify processing time is faster than sequential
      // With concurrency 3, should process in ~5 chunks = ~500ms
      // Sequential would be ~1500ms
      expect(result.data!.totalProcessingTimeMs).toBeLessThan(1500);
    });
  });

  describe('Scenario 5: Empty batch validation', () => {
    it('should return error for empty batch', async () => {
      // Act
      const result = await batchService.verifyBatch({
        tenantId: 'company-123',
        items: [],
        concurrency: 3
      });

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('No items provided');
      expect(result.data).toBeNull();
    });
  });

  describe('Scenario 6: Batch cost accumulation', () => {
    it('should correctly accumulate costs across batch', async () => {
      // Arrange
      const createMockImageData = () => {
        const data = new Uint8ClampedArray(400);
        return new ImageData(data, 10, 10);
      };

      const batchItems = [
        { kitId: 'kit-001', imageData: createMockImageData(), expectedItems: ['wrench'] },
        { kitId: 'kit-002', imageData: createMockImageData(), expectedItems: ['hammer'] },
        { kitId: 'kit-003', imageData: createMockImageData(), expectedItems: ['drill'] }
      ];

      // Mock VLM usage with costs
      mockVerifyKit.mockImplementation(async () => ({
        data: {
          verificationId: 'ver-' + Math.random(),
          verificationResult: 'complete',
          processingMethod: 'cloud_vlm',
          confidenceScore: 0.95,
          detectedItems: [{ itemType: 'tool', confidence: 0.95, matchStatus: 'matched' }],
          missingItems: [],
          unexpectedItems: [],
          costUsd: 0.03, // $0.03 per verification
          processingTimeMs: 1200
        },
        error: null
      }));

      // Act
      const result = await batchService.verifyBatch({
        tenantId: 'company-123',
        items: batchItems,
        concurrency: 3
      });

      // Assert
      expect(result.data!.totalCostUsd).toBeCloseTo(0.09); // 3 * $0.03
      expect(result.data!.successCount).toBe(3);
    });
  });
});
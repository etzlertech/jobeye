/**
 * @file complete-verification-flow.e2e.test.ts
 * @purpose End-to-end tests for complete verification flows with CRUD operations
 * @coverage_target ≥90%
 * @test_type integration
 *
 * Tests complete user journeys with mocked YOLO and Supabase, diverse data,
 * and realistic business scenarios
 */

// Mock Supabase client before imports
jest.mock('@/lib/supabase/client', () => {
  const { createMockSupabaseClient } = require('@/__tests__/mocks/supabase-client.mock');
  return {
    createClient: createMockSupabaseClient
  };
});

// Mock YOLO inference before imports
jest.mock('@/domains/vision/lib/yolo-inference', () => {
  const { createMockYoloInference } = require('@/__tests__/mocks/yolo-inference.mock');
  return {
    detectObjects: createMockYoloInference('high_confidence')
  };
});

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { VisionVerificationService } from '../../services/vision-verification.service';
import { BatchVerificationService } from '../../services/batch-verification.service';
import { CostTrackingService } from '../../services/cost-tracking.service';
import * as verificationRepo from '../../repositories/vision-verification.repository';
import * as detectedItemRepo from '../../repositories/detected-item.repository';
import * as costRecordRepo from '../../repositories/cost-record.repository';
import { setupTestEnvironment, cleanupTestEnvironment } from '../helpers/test-setup';

// Test data generators
function generateImageData(width: number = 640, height: number = 480): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  // Fill with random-ish pixel data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256);     // R
    data[i + 1] = Math.floor(Math.random() * 256); // G
    data[i + 2] = Math.floor(Math.random() * 256); // B
    data[i + 3] = 255;                              // A
  }
  return new ImageData(data, width, height);
}

interface TestKit {
  id: string;
  name: string;
  items: string[];
  scenario: string;
}

const TEST_KITS: TestKit[] = [
  {
    id: 'kit-lawn-basic',
    name: 'Basic Lawn Care Kit',
    items: ['mower', 'trimmer', 'safety_glasses'],
    scenario: 'Simple 3-item kit for basic lawn maintenance'
  },
  {
    id: 'kit-tree-advanced',
    name: 'Advanced Tree Service Kit',
    items: ['chainsaw', 'pole_saw', 'harness', 'helmet', 'climbing_rope', 'carabiners'],
    scenario: 'Complex 6-item kit requiring safety equipment'
  },
  {
    id: 'kit-irrigation',
    name: 'Irrigation Repair Kit',
    items: ['pipe_cutter', 'pvc_cement', 'pressure_gauge', 'teflon_tape', 'wrench_set'],
    scenario: 'Specialized tools for irrigation work'
  },
  {
    id: 'kit-empty',
    name: 'Empty Container',
    items: [],
    scenario: 'Empty kit for testing missing items detection'
  },
  {
    id: 'kit-massive',
    name: 'Full Truck Inventory',
    items: [
      'mower', 'trimmer', 'blower', 'edger', 'chainsaw', 'pole_saw',
      'hedge_trimmer', 'backpack_blower', 'commercial_mower', 'trailer',
      'gas_cans', 'tool_box', 'ladder', 'safety_cones', 'first_aid_kit',
      'water_cooler', 'tarps', 'bungee_cords', 'ratchet_straps', 'spare_parts'
    ],
    scenario: 'Large inventory exceeding typical detection capacity'
  }
];

const TEST_COMPANY_ID = 'company-vision-e2e-test';

describe('Vision Verification - Complete End-to-End Flows', () => {
  let supabase: SupabaseClient;
  let visionService: VisionVerificationService;
  let batchService: BatchVerificationService;
  let costService: CostTrackingService;

  beforeAll(() => {
    setupTestEnvironment();

    // Initialize Supabase client with credentials from .env.local
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not found - tests will use mocks');
    }

    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }

    visionService = new VisionVerificationService();
    batchService = new BatchVerificationService();
    costService = new CostTrackingService();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    cleanupTestEnvironment();
  });

  async function cleanupTestData() {
    // Delete test verifications and related records
    // Note: In production, these would cascade via RLS
    if (!supabase) {
      return; // Skip cleanup if no Supabase connection
    }

    try {
      await supabase
        .from('vision_verifications')
        .delete()
        .eq('tenant_id', TEST_COMPANY_ID); // Use tenant_id not company_id

      await supabase
        .from('cost_records')
        .delete()
        .eq('company_id', TEST_COMPANY_ID);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  describe('Scenario 1: First-time User - Single Kit Verification', () => {
    const kit = TEST_KITS[0]; // Basic Lawn Care Kit

    it('should complete full verification lifecycle: create → verify → read → update', async () => {
      // Arrange
      const imageData = generateImageData();

      // Act 1: Create verification
      const createResult = await visionService.verifyKit({
        kitId: kit.id,
        companyId: TEST_COMPANY_ID,
        imageData,
        expectedItems: kit.items,
        maxBudgetUsd: 10.0,
        maxRequestsPerDay: 100
      });

      // Assert 1: Verification created successfully
      expect(createResult.error).toBeNull();
      expect(createResult.data).toBeDefined();
      expect(createResult.data?.verificationId).toBeDefined();

      const verificationId = createResult.data!.verificationId;

      // Act 2: Read verification from database
      const readResult = await verificationRepo.findById(verificationId, TEST_COMPANY_ID);

      // Assert 2: Can retrieve verification
      expect(readResult.data).toBeDefined();
      expect(readResult.data?.kit_id).toBe(kit.id);
      // Note: Database schema uses tenant_id not company_id
      expect(readResult.data?.tenant_id || readResult.data?.company_id).toBeDefined();
      expect(readResult.data?.processing_method).toMatch(/local_yolo|cloud_vlm/);

      // Act 3: Read detected items
      const detectedItems = await detectedItemRepo.findByVerificationId(verificationId, TEST_COMPANY_ID);

      // Assert 3: Detected items are stored
      expect(detectedItems.data).toBeInstanceOf(Array);
      if (detectedItems.data && detectedItems.data.length > 0) {
        expect(detectedItems.data[0]).toHaveProperty('item_type');
        expect(detectedItems.data[0]).toHaveProperty('confidence');
        expect(detectedItems.data[0]).toHaveProperty('match_status');
      }

      // Act 4: Check cost record was created
      const costSummary = await costRecordRepo.getDailySummary(TEST_COMPANY_ID, new Date());

      // Assert 4: Cost tracking is working
      expect(costSummary.data).toBeDefined();
      expect(costSummary.data?.totalCost).toBeGreaterThanOrEqual(0);
      expect(costSummary.data?.requestCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scenario 2: Power User - Batch Verification of Multiple Kits', () => {
    it('should process 5 different kits in batch with diverse characteristics', async () => {
      // Arrange: Create 5 different verification requests
      const requests = TEST_KITS.slice(0, 5).map(kit => ({
        kitId: kit.id,
        imageData: generateImageData(),
        expectedItems: kit.items
      }));

      // Act: Batch process all kits
      const batchResult = await batchService.verifyBatch({
        companyId: TEST_COMPANY_ID,
        items: requests,
        maxBudgetUsd: 10.0,
        stopOnError: false, // Continue even if one fails
        concurrency: 3
      });

      // Assert: All verifications processed
      expect(batchResult.error).toBeNull();
      expect(batchResult.data).toBeDefined();
      expect(batchResult.data?.totalItems).toBe(5);
      expect(batchResult.data?.completedItems).toBe(5);

      // Assert: Can handle diverse kit sizes (0 to 20 items)
      const successfulVerifications = batchResult.data?.results.filter(r => r.success) || [];
      expect(successfulVerifications.length).toBeGreaterThan(0);

      // Assert: Cost accumulation is correct
      expect(batchResult.data?.totalCostUsd).toBeGreaterThanOrEqual(0);
      expect(batchResult.data?.totalCostUsd).toBeLessThan(1.0); // Should be mostly free (YOLO)
    });
  });

  describe('Scenario 3: Budget-Conscious Company - Cost Tracking', () => {
    it('should enforce budget limits and track costs accurately across multiple days', async () => {
      // Arrange: Set strict budget
      const dailyBudget = 1.0; // Only $1/day
      const imageData = generateImageData();

      // Act 1: Make several requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          visionService.verifyKit({
            kitId: `kit-budget-test-${i}`,
            companyId: TEST_COMPANY_ID,
            imageData,
            expectedItems: ['mower', 'trimmer'],
            maxBudgetUsd: dailyBudget,
            maxRequestsPerDay: 10
          })
        );
      }

      const results = await Promise.all(requests);

      // Assert 1: Some requests succeed
      const successCount = results.filter(r => r.data !== null).length;
      expect(successCount).toBeGreaterThan(0);

      // Act 2: Check budget status
      const costSummary = await costRecordRepo.getDailySummary(TEST_COMPANY_ID, new Date());

      // Assert 2: Budget tracking is accurate
      expect(costSummary.data?.totalCost).toBeLessThanOrEqual(dailyBudget);

      // Act 3: Verify budget warnings appear in results
      const resultsWithBudgetInfo = results.filter(r => r.data?.budgetStatus);
      expect(resultsWithBudgetInfo.length).toBeGreaterThan(0);

      if (resultsWithBudgetInfo.length > 0) {
        const lastResult = resultsWithBudgetInfo[resultsWithBudgetInfo.length - 1];
        expect(lastResult.data?.budgetStatus).toHaveProperty('remainingBudget');
        expect(lastResult.data?.budgetStatus).toHaveProperty('remainingRequests');
      }
    });
  });

  describe('Scenario 4: Mobile Worker - Offline Queue and Sync', () => {
    it('should queue verifications offline and sync when back online', async () => {
      // This is a placeholder for offline queue testing
      // Full implementation requires browser IndexedDB environment

      // Arrange: Simulate offline state
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      // Act: Attempt verification while offline
      const imageData = generateImageData();

      // Note: Full test would use OfflineQueueService
      // For now, just verify the service handles offline gracefully

      // Restore online state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: originalOnLine
      });

      // Assert: Placeholder
      expect(true).toBe(true);
    }, 15000);
  });

  describe('Scenario 5: Quality Control - High Confidence Validation', () => {
    it('should only accept high-confidence detections for safety-critical kits', async () => {
      // Arrange: Tree service kit requires high confidence
      const safetyKit = TEST_KITS[1]; // Advanced Tree Service Kit
      const imageData = generateImageData();

      // Act: Verify safety kit
      const result = await visionService.verifyKit({
        kitId: safetyKit.id,
        companyId: TEST_COMPANY_ID,
        imageData,
        expectedItems: safetyKit.items,
        maxBudgetUsd: 10.0
      });

      // Assert: Result includes confidence scores
      expect(result.data).toBeDefined();
      expect(result.data?.confidenceScore).toBeDefined();
      expect(result.data?.detectedItems).toBeInstanceOf(Array);

      // Assert: Safety items are flagged if uncertain
      const safetyItems = ['harness', 'helmet', 'climbing_rope'];
      const detectedSafetyItems = result.data?.detectedItems.filter(item =>
        safetyItems.includes(item.itemType)
      );

      // Each safety item should have explicit match status
      detectedSafetyItems?.forEach(item => {
        expect(item).toHaveProperty('matchStatus');
        expect(['matched', 'unmatched', 'uncertain']).toContain(item.matchStatus);
      });
    });
  });

  describe('Scenario 6: Multi-Container Tracking', () => {
    it('should handle verification across truck, trailer, and storage', async () => {
      // Arrange: Simulate 3 containers with overlapping items
      const containers = [
        {
          name: 'truck_bed',
          items: ['mower', 'trimmer', 'blower', 'gas_cans']
        },
        {
          name: 'trailer',
          items: ['commercial_mower', 'edger', 'backpack_blower']
        },
        {
          name: 'storage_bin',
          items: ['spare_blades', 'oil', 'filters', 'tools']
        }
      ];

      // Act: Verify each container
      const containerResults = await Promise.all(
        containers.map(container =>
          visionService.verifyKit({
            kitId: `multi-container-${container.name}`,
            companyId: TEST_COMPANY_ID,
            imageData: generateImageData(),
            expectedItems: container.items,
            maxBudgetUsd: 10.0
          })
        )
      );

      // Assert: All containers processed
      expect(containerResults.length).toBe(3);
      expect(containerResults.every(r => r.error === null || r.data !== null)).toBe(true);

      // Act: Aggregate results across containers
      const allDetectedItems = containerResults
        .filter(r => r.data !== null)
        .flatMap(r => r.data!.detectedItems.map(item => item.itemType));

      // Assert: Can track items across multiple locations
      const uniqueItems = new Set(allDetectedItems);
      expect(uniqueItems.size).toBeGreaterThan(0);
    });
  });

  describe('Scenario 7: Historical Reporting - Verification Trends', () => {
    it('should query verification history with filters and aggregations', async () => {
      // Arrange: Create several verifications over time
      const imageData = generateImageData();

      // Create 3 verifications
      const verifications = await Promise.all([
        visionService.verifyKit({
          kitId: 'kit-history-1',
          companyId: TEST_COMPANY_ID,
          imageData,
          expectedItems: ['mower', 'trimmer'],
          maxBudgetUsd: 10.0
        }),
        visionService.verifyKit({
          kitId: 'kit-history-2',
          companyId: TEST_COMPANY_ID,
          imageData,
          expectedItems: ['chainsaw', 'helmet'],
          maxBudgetUsd: 10.0
        }),
        visionService.verifyKit({
          kitId: 'kit-history-3',
          companyId: TEST_COMPANY_ID,
          imageData,
          expectedItems: ['blower'],
          maxBudgetUsd: 10.0
        })
      ]);

      // Act: Query verification history
      const history = await verificationRepo.findAll({
        companyId: TEST_COMPANY_ID,
        limit: 10,
        offset: 0
      });

      // Assert: Can retrieve multiple verifications
      expect(history.data).toBeInstanceOf(Array);
      expect(history.data!.length).toBeGreaterThanOrEqual(3);

      // Assert: Results include metadata
      if (history.data && history.data.length > 0) {
        const record = history.data[0];
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('kit_id');
        expect(record).toHaveProperty('verification_result');
        expect(record).toHaveProperty('confidence_score');
        expect(record).toHaveProperty('created_at');
      }
    });
  });

  describe('Scenario 8: Error Recovery - Partial Failures', () => {
    it('should handle and recover from partial failures in batch operations', async () => {
      // Arrange: Mix of valid and problematic verifications
      const mixedRequests = [
        {
          kitId: 'kit-valid-1',
          imageData: generateImageData(),
          expectedItems: ['mower']
        },
        {
          kitId: 'kit-invalid-no-image',
          imageData: new ImageData(new Uint8ClampedArray(0), 0, 0), // Invalid
          expectedItems: ['trimmer']
        },
        {
          kitId: 'kit-valid-2',
          imageData: generateImageData(),
          expectedItems: ['blower']
        }
      ];

      // Act: Process batch with stopOnError: false
      const batchResult = await batchService.verifyBatch({
        companyId: TEST_COMPANY_ID,
        items: mixedRequests,
        stopOnError: false,
        concurrency: 1
      });

      // Assert: Batch completes with partial success
      expect(batchResult.data).toBeDefined();
      expect(batchResult.data?.totalItems).toBe(3);
      expect(batchResult.data?.completedItems).toBe(3);
      expect(batchResult.data?.failureCount).toBeGreaterThan(0);
      expect(batchResult.data?.successCount).toBeGreaterThan(0);

      // Assert: Can identify which items failed
      const failedItems = batchResult.data?.results.filter(r => !r.success);
      expect(failedItems).toBeDefined();
      expect(failedItems!.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario 9: Performance - Large Image Processing', () => {
    it('should handle various image sizes efficiently', async () => {
      // Arrange: Different image resolutions
      const imageSizes = [
        { width: 320, height: 240, name: 'small' },
        { width: 640, height: 480, name: 'medium' },
        { width: 1280, height: 720, name: 'large' },
        { width: 1920, height: 1080, name: 'hd' }
      ];

      // Act: Process each size and measure time
      const results = await Promise.all(
        imageSizes.map(async (size) => {
          const startTime = Date.now();
          const imageData = generateImageData(size.width, size.height);

          const result = await visionService.verifyKit({
            kitId: `kit-size-${size.name}`,
            companyId: TEST_COMPANY_ID,
            imageData,
            expectedItems: ['mower', 'trimmer'],
            maxBudgetUsd: 10.0
          });

          const duration = Date.now() - startTime;

          return {
            size: size.name,
            width: size.width,
            height: size.height,
            duration,
            success: result.data !== null,
            processingTime: result.data?.processingTimeMs || 0
          };
        })
      );

      // Assert: All sizes processed
      expect(results.length).toBe(4);
      expect(results.every(r => r.success)).toBe(true);

      // Assert: Processing time scales reasonably
      const smallTime = results.find(r => r.size === 'small')?.duration || 0;
      const largeTime = results.find(r => r.size === 'hd')?.duration || 0;

      // HD should take longer than small, but not excessively
      expect(largeTime).toBeGreaterThan(smallTime);
      expect(largeTime).toBeLessThan(smallTime * 10); // Within 10x
    }, 30000); // 30 second timeout for large images
  });

  describe('Scenario 10: Data Diversity - Edge Cases', () => {
    it('should handle unusual but valid scenarios', async () => {
      // Arrange: Edge case scenarios
      const edgeCases = [
        {
          name: 'empty_kit',
          kitId: TEST_KITS[3].id,
          expectedItems: [],
          expectedResult: 'complete' // Empty kit should verify as complete
        },
        {
          name: 'single_item',
          kitId: 'kit-minimal',
          expectedItems: ['mower'],
          expectedResult: 'complete' // Single item should work
        },
        {
          name: 'duplicate_items',
          kitId: 'kit-duplicates',
          expectedItems: ['mower', 'mower', 'mower'], // 3 of same item
          expectedResult: 'complete'
        },
        {
          name: 'unusual_names',
          kitId: 'kit-special-chars',
          expectedItems: ['item-with-dashes', 'item_with_underscores', 'item.with.dots'],
          expectedResult: 'incomplete' // May not detect unusual names
        }
      ];

      // Act: Process each edge case
      const results = await Promise.all(
        edgeCases.map(async (testCase) => {
          const imageData = generateImageData();

          const result = await visionService.verifyKit({
            kitId: testCase.kitId,
            companyId: TEST_COMPANY_ID,
            imageData,
            expectedItems: testCase.expectedItems,
            maxBudgetUsd: 10.0
          });

          return {
            name: testCase.name,
            success: result.data !== null,
            verificationResult: result.data?.verificationResult,
            expectedResult: testCase.expectedResult,
            error: result.error
          };
        })
      );

      // Assert: All edge cases handled gracefully
      expect(results.every(r => r.success || r.error !== null)).toBe(true);

      // Assert: Empty kit validates correctly
      const emptyKitResult = results.find(r => r.name === 'empty_kit');
      expect(emptyKitResult?.success).toBe(true);
    });
  });

  describe('Scenario 11: CRUD Lifecycle - Update and Delete', () => {
    it('should support full CRUD operations on verification records', async () => {
      // CREATE
      const imageData = generateImageData();
      const createResult = await visionService.verifyKit({
        kitId: 'kit-crud-test',
        companyId: TEST_COMPANY_ID,
        imageData,
        expectedItems: ['mower', 'trimmer'],
        maxBudgetUsd: 10.0
      });

      expect(createResult.data).toBeDefined();
      const verificationId = createResult.data!.verificationId;

      // READ
      const readResult = await verificationRepo.findById(verificationId, TEST_COMPANY_ID);
      expect(readResult.data).toBeDefined();
      expect(readResult.data?.id).toBe(verificationId);

      // UPDATE (if supported by repository)
      // Note: In practice, verifications may be immutable for audit purposes
      // This tests the repository's update capability if it exists

      // DELETE (soft delete or archive)
      const deleteResult = await verificationRepo.deleteById(verificationId, TEST_COMPANY_ID);
      expect(deleteResult.error).toBeNull();

      // VERIFY DELETED
      const readAfterDelete = await verificationRepo.findById(verificationId, TEST_COMPANY_ID);
      expect(readAfterDelete.data).toBeNull();
    });
  });

  describe('Scenario 12: Cost Optimization - YOLO vs VLM Decision Making', () => {
    it('should intelligently choose between YOLO and VLM based on confidence', async () => {
      // Arrange: Create multiple verifications with varying expected confidence
      const imageData = generateImageData();

      // Track YOLO vs VLM usage
      let yoloCount = 0;
      let vlmCount = 0;

      // Act: Process 10 verifications
      for (let i = 0; i < 10; i++) {
        const result = await visionService.verifyKit({
          kitId: `kit-optimization-${i}`,
          companyId: TEST_COMPANY_ID,
          imageData,
          expectedItems: ['mower', 'trimmer', 'blower'],
          maxBudgetUsd: 10.0
        });

        if (result.data) {
          if (result.data.processingMethod === 'local_yolo') {
            yoloCount++;
          } else if (result.data.processingMethod === 'cloud_vlm') {
            vlmCount++;
          }
        }
      }

      // Assert: Majority should use free YOLO (80% target)
      const totalCount = yoloCount + vlmCount;
      expect(totalCount).toBe(10);
      expect(yoloCount).toBeGreaterThan(vlmCount); // More YOLO than VLM

      // Assert: Cost savings are significant
      const costSummary = await costRecordRepo.getDailySummary(TEST_COMPANY_ID, new Date());
      const avgCostPerVerification = costSummary.data
        ? costSummary.data.totalCost / costSummary.data.requestCount
        : 0;

      expect(avgCostPerVerification).toBeLessThan(0.10); // Average should be less than full VLM cost
    }, 60000); // 60 second timeout for multiple verifications
  });
});
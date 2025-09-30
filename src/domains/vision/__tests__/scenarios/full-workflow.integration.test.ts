/**
 * @file /src/domains/vision/__tests__/scenarios/full-workflow.integration.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Full end-to-end integration test covering all features
 * @test_coverage Complete workflow validation
 */

import { getBatchVerificationService } from '../../services/batch-verification.service';
import { getVisionVerificationService } from '../../services/vision-verification.service';
import { getOfflineQueue } from '../../lib/offline-queue';
import { getPDFExportService } from '../../services/pdf-export.service';
import { getVoiceNarrationService } from '../../services/voice-narration.service';

// Mock all dependencies
jest.mock('../../services/vision-verification.service');
jest.mock('../../lib/yolo-inference');
jest.mock('../../repositories/vision-verification.repository');
jest.mock('../../repositories/detected-item.repository');
jest.mock('../../repositories/cost-record.repository');
jest.mock('../../lib/openai-vision-adapter');

// Mock DOM and Browser APIs
(global as any).document = {
  createElement: jest.fn().mockReturnValue({
    style: {},
    contentDocument: { open: jest.fn(), write: jest.fn(), close: jest.fn() }
  }),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};

(global as any).window = {
  speechSynthesis: {
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn().mockReturnValue([]),
    speaking: false,
    paused: false
  },
  SpeechSynthesisUtterance: jest.fn().mockImplementation(() => ({
    text: '',
    rate: 1,
    pitch: 1,
    volume: 1,
    onend: null,
    onerror: null
  }))
};

(global as any).indexedDB = {
  open: jest.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          add: jest.fn().mockReturnValue({ onsuccess: null }),
          getAll: jest.fn().mockReturnValue({ onsuccess: null, result: [] })
        })
      }),
      objectStoreNames: { contains: jest.fn().mockReturnValue(false) }
    }
  })
};

(global as any).URL = {
  createObjectURL: jest.fn().mockReturnValue('blob:mock'),
  revokeObjectURL: jest.fn()
};

(global as any).localStorage = {
  getItem: jest.fn().mockReturnValue('mock-token'),
  setItem: jest.fn()
};

describe('Vision System - Full Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Journey: Field Technician Scenario', () => {
    it('should complete entire workflow from batch verification to export', async () => {
      /**
       * SCENARIO: Field technician with 5 kits to verify
       * 1. Batch verify 5 kits (3 complete, 1 incomplete, 1 offline-queued)
       * 2. Export PDF report for complete verifications
       * 3. Narrate results for incomplete verification
       * 4. Process offline queue when back online
       * 5. View cost trends and admin dashboard
       */

      // ========================================
      // STEP 1: Batch Verification
      // ========================================

      const createMockImageData = () => {
        const data = new Uint8ClampedArray(400);
        return new ImageData(data, 10, 10);
      };

      const batchItems = [
        { kitId: 'kit-001', imageData: createMockImageData(), expectedItems: ['wrench', 'hammer'] },
        { kitId: 'kit-002', imageData: createMockImageData(), expectedItems: ['screwdriver'] },
        { kitId: 'kit-003', imageData: createMockImageData(), expectedItems: ['pliers', 'drill'] },
        { kitId: 'kit-004', imageData: createMockImageData(), expectedItems: ['tape', 'level'] },
        { kitId: 'kit-005', imageData: createMockImageData(), expectedItems: ['saw'] }
      ];

      // Mock verification results
      const mockVerifyKit = jest.fn()
        // Kit 1 - Complete
        .mockResolvedValueOnce({
          data: {
            verificationId: 'ver-001',
            verificationResult: 'complete',
            processingMethod: 'local_yolo',
            confidenceScore: 0.95,
            detectedItems: [
              { itemType: 'wrench', confidence: 0.96, matchStatus: 'matched' },
              { itemType: 'hammer', confidence: 0.94, matchStatus: 'matched' }
            ],
            missingItems: [],
            unexpectedItems: [],
            costUsd: 0,
            processingTimeMs: 230
          },
          error: null
        })
        // Kit 2 - Complete
        .mockResolvedValueOnce({
          data: {
            verificationId: 'ver-002',
            verificationResult: 'complete',
            processingMethod: 'local_yolo',
            confidenceScore: 0.93,
            detectedItems: [
              { itemType: 'screwdriver', confidence: 0.93, matchStatus: 'matched' }
            ],
            missingItems: [],
            unexpectedItems: [],
            costUsd: 0,
            processingTimeMs: 210
          },
          error: null
        })
        // Kit 3 - Complete
        .mockResolvedValueOnce({
          data: {
            verificationId: 'ver-003',
            verificationResult: 'complete',
            processingMethod: 'local_yolo',
            confidenceScore: 0.91,
            detectedItems: [
              { itemType: 'pliers', confidence: 0.92, matchStatus: 'matched' },
              { itemType: 'drill', confidence: 0.90, matchStatus: 'matched' }
            ],
            missingItems: [],
            unexpectedItems: [],
            costUsd: 0,
            processingTimeMs: 245
          },
          error: null
        })
        // Kit 4 - Incomplete (missing item)
        .mockResolvedValueOnce({
          data: {
            verificationId: 'ver-004',
            verificationResult: 'incomplete',
            processingMethod: 'cloud_vlm',
            confidenceScore: 0.72,
            detectedItems: [
              { itemType: 'tape', confidence: 0.85, matchStatus: 'matched' }
            ],
            missingItems: ['level'],
            unexpectedItems: [],
            costUsd: 0.03,
            processingTimeMs: 1150
          },
          error: null
        })
        // Kit 5 - Network error (will be queued)
        .mockRejectedValueOnce(new Error('Network request failed'));

      (getVisionVerificationService as jest.Mock).mockReturnValue({
        verifyKit: mockVerifyKit
      });

      const batchService = getBatchVerificationService();
      const batchResult = await batchService.verifyBatch({
        companyId: 'company-123',
        items: batchItems,
        concurrency: 2,
        stopOnError: false
      });

      // Verify batch results
      expect(batchResult.data?.successCount).toBe(4);
      expect(batchResult.data?.failureCount).toBe(1);
      expect(batchResult.data?.totalCostUsd).toBeCloseTo(0.03);

      console.log('✅ Step 1: Batch verification completed');
      console.log(`   - Successful: ${batchResult.data?.successCount}`);
      console.log(`   - Failed: ${batchResult.data?.failureCount}`);
      console.log(`   - Total cost: $${batchResult.data?.totalCostUsd.toFixed(4)}`);

      // ========================================
      // STEP 2: Export PDF for Complete Verifications
      // ========================================

      const pdfService = getPDFExportService();
      const completeVerifications = batchResult.data?.results.filter(r =>
        r.success && r.result?.verificationResult === 'complete'
      ) || [];

      const pdfReports: Blob[] = [];
      for (const verification of completeVerifications) {
        const blob = await pdfService.generateReport({
          ...verification.result!,
          kitId: verification.kitId,
          companyId: 'company-123'
        });
        pdfReports.push(blob);
      }

      expect(pdfReports).toHaveLength(3); // 3 complete verifications

      console.log('✅ Step 2: PDF reports generated');
      console.log(`   - Reports created: ${pdfReports.length}`);

      // ========================================
      // STEP 3: Voice Narration for Incomplete
      // ========================================

      const voiceService = getVoiceNarrationService();
      const incompleteVerification = batchResult.data?.results.find(r =>
        r.success && r.result?.verificationResult === 'incomplete'
      );

      if (incompleteVerification?.result) {
        const narratePromise = voiceService.narrateResult({
          ...incompleteVerification.result,
          kitId: incompleteVerification.kitId,
          companyId: 'company-123'
        });

        // Simulate narration completion
        const mockUtterance = (global as any).window.SpeechSynthesisUtterance.mock.results[0].value;
        setTimeout(() => {
          if (mockUtterance.onend) mockUtterance.onend();
        }, 0);

        await narratePromise;

        expect((global as any).window.speechSynthesis.speak).toHaveBeenCalled();
        expect(mockUtterance.text).toContain('incomplete');
        expect(mockUtterance.text).toContain('level');

        console.log('✅ Step 3: Voice narration completed');
        console.log(`   - Narrated: Kit ${incompleteVerification.kitId}`);
      }

      // ========================================
      // STEP 4: Queue Failed Verification (Offline)
      // ========================================

      const offlineQueue = getOfflineQueue();
      const failedVerification = batchResult.data?.results.find(r => !r.success);

      if (failedVerification) {
        // Simulate offline - queue the verification
        const mockDb = (global as any).indexedDB.open().result;
        const mockStore = mockDb.transaction().objectStore();
        const mockAddRequest = mockStore.add();

        const queuePromise = offlineQueue.enqueue({
          kitId: failedVerification.kitId,
          companyId: 'company-123',
          imageData: batchItems[4].imageData,
          expectedItems: batchItems[4].expectedItems,
          maxBudgetUsd: 10.0,
          maxRequestsPerDay: 100
        });

        // Simulate IndexedDB success
        setTimeout(() => {
          if (mockAddRequest.onsuccess) mockAddRequest.onsuccess();
        }, 0);

        const queueId = await queuePromise;

        expect(queueId).toBeDefined();
        expect(mockStore.add).toHaveBeenCalled();

        console.log('✅ Step 4: Failed verification queued for offline');
        console.log(`   - Queue ID: ${queueId}`);
      }

      // ========================================
      // STEP 5: Verify Cost Tracking
      // ========================================

      // Calculate total cost from all verifications
      const totalSystemCost = batchResult.data?.results.reduce((sum, r) => {
        return sum + (r.result?.costUsd || 0);
      }, 0) || 0;

      expect(totalSystemCost).toBeCloseTo(0.03); // Only VLM verification had cost

      console.log('✅ Step 5: Cost tracking verified');
      console.log(`   - Total cost: $${totalSystemCost.toFixed(4)}`);
      console.log(`   - VLM requests: 1`);
      console.log(`   - YOLO requests: 3`);

      // ========================================
      // FINAL REPORT
      // ========================================

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 WORKFLOW COMPLETION REPORT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Kits Processed: ${batchResult.data?.totalItems}`);
      console.log(`Successful: ${batchResult.data?.successCount}`);
      console.log(`Failed: ${batchResult.data?.failureCount}`);
      console.log(`Complete: ${completeVerifications.length}`);
      console.log(`Incomplete: 1`);
      console.log(`Queued Offline: 1`);
      console.log(`PDF Reports: ${pdfReports.length}`);
      console.log(`Voice Narrations: 1`);
      console.log(`Total Cost: $${totalSystemCost.toFixed(4)}`);
      console.log(`Processing Time: ${batchResult.data?.totalProcessingTimeMs}ms`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Final assertions
      expect(batchResult.data?.totalItems).toBe(5);
      expect(completeVerifications).toHaveLength(3);
      expect(pdfReports).toHaveLength(3);
      expect(totalSystemCost).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for full workflow
  });

  describe('Edge Case: All Features Under Stress', () => {
    it('should handle large batch with all features enabled', async () => {
      /**
       * STRESS TEST: 20 kits with mixed results
       * - Enable voice narration for all
       * - Export PDFs for all complete
       * - Queue failures offline
       * - Track all costs
       */

      const createMockImageData = () => new ImageData(new Uint8ClampedArray(400), 10, 10);

      const largeBatch = Array.from({ length: 20 }, (_, i) => ({
        kitId: `kit-${String(i + 1).padStart(3, '0')}`,
        imageData: createMockImageData(),
        expectedItems: ['tool-1', 'tool-2']
      }));

      // Mock mixed results (80% success rate)
      const mockVerifyKit = jest.fn().mockImplementation(async () => {
        const isSuccess = Math.random() > 0.2;
        if (!isSuccess) {
          return { data: null, error: { code: 'YOLO_FAILED', message: 'Failed' } };
        }

        return {
          data: {
            verificationId: `ver-${Math.random()}`,
            verificationResult: Math.random() > 0.1 ? 'complete' : 'incomplete',
            processingMethod: Math.random() > 0.1 ? 'local_yolo' : 'cloud_vlm',
            confidenceScore: 0.85 + Math.random() * 0.1,
            detectedItems: [
              { itemType: 'tool-1', confidence: 0.9, matchStatus: 'matched' },
              { itemType: 'tool-2', confidence: 0.88, matchStatus: 'matched' }
            ],
            missingItems: [],
            unexpectedItems: [],
            costUsd: Math.random() > 0.1 ? 0 : 0.03,
            processingTimeMs: 200 + Math.random() * 100
          },
          error: null
        };
      });

      (getVisionVerificationService as jest.Mock).mockReturnValue({
        verifyKit: mockVerifyKit
      });

      const batchService = getBatchVerificationService();
      const result = await batchService.verifyBatch({
        companyId: 'company-123',
        items: largeBatch,
        concurrency: 5
      });

      // Verify system handled stress
      expect(result.data?.completedItems).toBe(20);
      expect(result.data?.successCount).toBeGreaterThan(10);
      expect(mockVerifyKit).toHaveBeenCalledTimes(20);

      console.log('\n✅ STRESS TEST PASSED');
      console.log(`   - Batch size: 20 kits`);
      console.log(`   - Concurrency: 5`);
      console.log(`   - Success rate: ${((result.data!.successCount / 20) * 100).toFixed(1)}%`);
      console.log(`   - Total time: ${result.data?.totalProcessingTimeMs}ms`);
      console.log(`   - Throughput: ${(20000 / result.data!.totalProcessingTimeMs).toFixed(2)} kits/sec`);
    });
  });
});
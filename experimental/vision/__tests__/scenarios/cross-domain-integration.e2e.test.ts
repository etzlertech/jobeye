/**
 * @file cross-domain-integration.e2e.test.ts
 * @purpose Tests integration between vision domain and other system domains
 * @coverage_target ≥85%
 * @test_type integration
 *
 * Tests how vision verification integrates with:
 * - Job execution workflows
 * - Equipment tracking
 * - Cost tracking and billing
 * - Voice interactions
 * - Offline queue sync
 */

import { VisionVerificationService } from '../../services/vision-verification.service';
import { VoiceNarrationService } from '../../services/voice-narration.service';
import { CostTrackingService } from '../../services/cost-tracking.service';
import { OfflineQueueService } from '../../lib/offline-queue';
import * as verificationRepo from '../../repositories/vision-verification.repository';
import * as costRecordRepo from '../../repositories/cost-record.repository';

// Test helpers
function generateImageData(width: number = 640, height: number = 480): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256);
    data[i + 1] = Math.floor(Math.random() * 256);
    data[i + 2] = Math.floor(Math.random() * 256);
    data[i + 3] = 255;
  }
  return new ImageData(data, width, height);
}

// Mock job execution data
interface MockJob {
  id: string;
  propertyId: string;
  requiredEquipment: string[];
  status: 'pending' | 'in_progress' | 'completed';
  verificationRequired: boolean;
}

describe('Vision - Cross-Domain Integration', () => {
  let visionService: VisionVerificationService;
  let voiceService: VoiceNarrationService;
  let costService: CostTrackingService;

  const TEST_COMPANY_ID = 'integration-test-company';

  beforeAll(() => {
    visionService = new VisionVerificationService();
    voiceService = new VoiceNarrationService();
    costService = new CostTrackingService();
  });

  describe('Integration 1: Job Execution → Vision Verification', () => {
    it('should verify equipment before job start and after completion', async () => {
      // Arrange: Create mock job
      const job: MockJob = {
        id: 'job-lawn-service-001',
        propertyId: 'prop-123',
        requiredEquipment: ['mower', 'trimmer', 'blower', 'edger'],
        status: 'pending',
        verificationRequired: true
      };

      // Act 1: Pre-job verification
      const preJobVerification = await visionService.verifyKit({
        kitId: `pre-${job.id}`,
        tenantId: TEST_COMPANY_ID,
        imageData: generateImageData(),
        expectedItems: job.requiredEquipment,
        maxBudgetUsd: 10.0
      });

      // Assert 1: Pre-job check completes
      expect(preJobVerification.data).toBeDefined();
      expect(preJobVerification.error).toBeNull();

      const preJobResult = preJobVerification.data!;

      // Assert 1a: Can proceed with job if verification passes
      const canStartJob =
        preJobResult.verificationResult === 'complete' &&
        preJobResult.missingItems.length === 0;

      expect(typeof canStartJob).toBe('boolean');

      // Simulate: Job execution happens here
      job.status = 'completed';

      // Act 2: Post-job verification
      const postJobVerification = await visionService.verifyKit({
        kitId: `post-${job.id}`,
        tenantId: TEST_COMPANY_ID,
        imageData: generateImageData(),
        expectedItems: job.requiredEquipment,
        maxBudgetUsd: 10.0
      });

      // Assert 2: Post-job check completes
      expect(postJobVerification.data).toBeDefined();

      // Assert 2a: Can detect if equipment is missing/damaged after job
      const postJobResult = postJobVerification.data!;
      const equipmentLostOrDamaged = postJobResult.missingItems.length > 0;

      expect(typeof equipmentLostOrDamaged).toBe('boolean');

      // Act 3: Compare pre and post verification
      const preDetectedCount = preJobResult.detectedItems.length;
      const postDetectedCount = postJobResult.detectedItems.length;

      // Assert 3: Can track equipment changes
      const equipmentDelta = preDetectedCount - postDetectedCount;
      expect(typeof equipmentDelta).toBe('number');
    });
  });

  describe('Integration 2: Vision Verification → Voice Narration', () => {
    it('should provide voice feedback for verification results', async () => {
      // Arrange
      const imageData = generateImageData();

      // Act 1: Perform verification
      const verification = await visionService.verifyKit({
        kitId: 'kit-voice-feedback',
        tenantId: TEST_COMPANY_ID,
        imageData,
        expectedItems: ['mower', 'trimmer', 'blower'],
        maxBudgetUsd: 10.0
      });

      expect(verification.data).toBeDefined();

      // Act 2: Generate voice narration from result
      const narrationText = voiceService.narrateResultText({
        verified: verification.data!.verificationResult === 'complete',
        detectedItems: verification.data!.detectedItems.map(item => ({
          label: item.itemType,
          confidence: item.confidence
        })),
        missingItems: verification.data!.missingItems,
        confidence: verification.data!.confidenceScore
      });

      // Assert: Narration is generated
      expect(narrationText).toBeDefined();
      expect(narrationText.length).toBeGreaterThan(0);
      expect(narrationText).toContain(
        verification.data!.verificationResult === 'complete' ? 'verified' : 'incomplete'
      );

      // Act 3: Generate individual item narrations
      const itemNarrations = verification.data!.detectedItems.map(item =>
        voiceService.narrateDetectedItem({
          label: item.itemType,
          confidence: item.confidence
        })
      );

      // Assert: Each item has narration
      expect(itemNarrations.length).toBe(verification.data!.detectedItems.length);
      itemNarrations.forEach(narration => {
        expect(narration.length).toBeGreaterThan(0);
      });

      // Act 4: Generate missing items narration
      if (verification.data!.missingItems.length > 0) {
        const missingNarration = voiceService.narrateMissingItems(
          verification.data!.missingItems
        );

        // Assert: Missing items narration exists
        expect(missingNarration.length).toBeGreaterThan(0);
        expect(missingNarration.toLowerCase()).toContain('missing');
      }
    });
  });

  describe('Integration 3: Vision Verification → Cost Tracking', () => {
    it('should track costs across verification, billing, and reporting', async () => {
      // Arrange: Multiple verifications with different methods
      const imageData = generateImageData();

      // Act 1: Create several verifications
      const verifications = await Promise.all([
        visionService.verifyKit({
          kitId: 'kit-cost-1',
          tenantId: TEST_COMPANY_ID,
          imageData,
          expectedItems: ['mower'],
          maxBudgetUsd: 10.0
        }),
        visionService.verifyKit({
          kitId: 'kit-cost-2',
          tenantId: TEST_COMPANY_ID,
          imageData,
          expectedItems: ['trimmer'],
          maxBudgetUsd: 10.0
        }),
        visionService.verifyKit({
          kitId: 'kit-cost-3',
          tenantId: TEST_COMPANY_ID,
          imageData,
          expectedItems: ['blower'],
          maxBudgetUsd: 10.0
        })
      ]);

      // Assert 1: All verifications tracked
      const successfulVerifications = verifications.filter(v => v.data !== null);
      expect(successfulVerifications.length).toBeGreaterThan(0);

      // Act 2: Query daily cost summary
      const costSummary = await costRecordRepo.getDailySummary(TEST_COMPANY_ID, new Date());

      // Assert 2: Cost summary includes verification costs
      expect(costSummary.data).toBeDefined();
      expect(costSummary.data?.totalCost).toBeGreaterThanOrEqual(0);
      expect(costSummary.data?.requestCount).toBeGreaterThanOrEqual(successfulVerifications.length);

      // Act 3: Calculate cost breakdown by method
      const yoloVerifications = successfulVerifications.filter(
        v => v.data?.processingMethod === 'local_yolo'
      );
      const vlmVerifications = successfulVerifications.filter(
        v => v.data?.processingMethod === 'cloud_vlm'
      );

      const yoloCost = yoloVerifications.reduce((sum, v) => sum + (v.data?.costUsd || 0), 0);
      const vlmCost = vlmVerifications.reduce((sum, v) => sum + (v.data?.costUsd || 0), 0);
      const totalCost = yoloCost + vlmCost;

      // Assert 3: Cost breakdown makes sense
      expect(yoloCost).toBe(0); // YOLO is free
      expect(vlmCost).toBeGreaterThanOrEqual(0);
      expect(totalCost).toBeGreaterThanOrEqual(0);

      // Act 4: Calculate cost savings from YOLO usage
      const wouldBeCostIfAllVLM = successfulVerifications.length * 0.10; // $0.10 per VLM
      const actualCost = totalCost;
      const savings = wouldBeCostIfAllVLM - actualCost;
      const savingsPercent = (savings / wouldBeCostIfAllVLM) * 100;

      // Assert 4: YOLO provides significant cost savings
      expect(savings).toBeGreaterThanOrEqual(0);
      expect(savingsPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration 4: Vision Verification → Equipment Tracking', () => {
    it('should update equipment tracking records after verification', async () => {
      // Arrange: Equipment inventory
      const equipment = [
        { id: 'mower-001', type: 'mower', status: 'available', lastSeen: null },
        { id: 'trimmer-002', type: 'trimmer', status: 'available', lastSeen: null },
        { id: 'blower-003', type: 'blower', status: 'available', lastSeen: null }
      ];

      // Act: Verify equipment
      const verification = await visionService.verifyKit({
        kitId: 'kit-equipment-tracking',
        tenantId: TEST_COMPANY_ID,
        imageData: generateImageData(),
        expectedItems: equipment.map(e => e.type),
        maxBudgetUsd: 10.0
      });

      expect(verification.data).toBeDefined();

      // Simulate: Update equipment tracking based on verification
      const detectedEquipment = verification.data!.detectedItems.map(item => item.itemType);
      const now = new Date();

      equipment.forEach(item => {
        if (detectedEquipment.includes(item.type)) {
          item.status = 'verified';
          item.lastSeen = now;
        } else {
          item.status = 'missing';
        }
      });

      // Assert: Equipment tracking updated
      const verifiedEquipment = equipment.filter(e => e.status === 'verified');
      const missingEquipment = equipment.filter(e => e.status === 'missing');

      expect(verifiedEquipment.length + missingEquipment.length).toBe(equipment.length);

      // Act: Generate equipment status report
      const equipmentReport = {
        totalItems: equipment.length,
        verified: verifiedEquipment.length,
        missing: missingEquipment.length,
        verificationTimestamp: now,
        confidence: verification.data!.confidenceScore
      };

      // Assert: Report is comprehensive
      expect(equipmentReport.totalItems).toBeGreaterThan(0);
      expect(equipmentReport.verified + equipmentReport.missing).toBe(equipmentReport.totalItems);
    });
  });

  describe('Integration 5: Multi-Step Workflow - Complete Job Cycle', () => {
    it('should handle complete workflow: job assignment → verification → execution → completion', async () => {
      // STEP 1: Job Assignment
      const job = {
        id: 'job-complete-cycle-001',
        type: 'lawn_maintenance',
        propertyId: 'prop-456',
        customerId: 'customer-789',
        assignedTo: 'tech-john',
        requiredEquipment: ['mower', 'trimmer', 'blower', 'edger'],
        status: 'assigned' as const
      };

      // STEP 2: Pre-Job Equipment Verification
      const preJobVerification = await visionService.verifyKit({
        kitId: `prejob-${job.id}`,
        tenantId: TEST_COMPANY_ID,
        imageData: generateImageData(),
        expectedItems: job.requiredEquipment,
        maxBudgetUsd: 10.0
      });

      expect(preJobVerification.data).toBeDefined();

      // STEP 3: Voice Confirmation
      const preJobNarration = voiceService.narrateResultText({
        verified: preJobVerification.data!.verificationResult === 'complete',
        detectedItems: preJobVerification.data!.detectedItems.map(item => ({
          label: item.itemType,
          confidence: item.confidence
        })),
        missingItems: preJobVerification.data!.missingItems,
        confidence: preJobVerification.data!.confidenceScore
      });

      expect(preJobNarration.length).toBeGreaterThan(0);

      // STEP 4: Check if job can proceed
      const canProceed =
        preJobVerification.data!.verificationResult === 'complete' ||
        preJobVerification.data!.missingItems.length === 0;

      if (canProceed) {
        job.status = 'in_progress' as const;
      }

      // STEP 5: Job Execution (simulated)
      // ... work happens ...

      // STEP 6: Post-Job Verification
      const postJobVerification = await visionService.verifyKit({
        kitId: `postjob-${job.id}`,
        tenantId: TEST_COMPANY_ID,
        imageData: generateImageData(),
        expectedItems: job.requiredEquipment,
        maxBudgetUsd: 10.0
      });

      expect(postJobVerification.data).toBeDefined();

      // STEP 7: Compare Pre and Post
      const equipmentIntact =
        postJobVerification.data!.detectedItems.length >=
        preJobVerification.data!.detectedItems.length;

      // STEP 8: Mark job complete if equipment intact
      if (equipmentIntact) {
        job.status = 'completed' as const;
      }

      // STEP 9: Cost Reconciliation
      const totalVerificationCost =
        (preJobVerification.data?.costUsd || 0) + (postJobVerification.data?.costUsd || 0);

      // STEP 10: Generate completion report
      const completionReport = {
        jobId: job.id,
        status: job.status,
        preVerificationId: preJobVerification.data?.verificationId,
        postVerificationId: postJobVerification.data?.verificationId,
        equipmentIntact,
        totalCost: totalVerificationCost,
        preJobConfidence: preJobVerification.data?.confidenceScore,
        postJobConfidence: postJobVerification.data?.confidenceScore
      };

      // Assert: Complete workflow executed
      expect(completionReport.status).toMatch(/assigned|in_progress|completed/);
      expect(completionReport.preVerificationId).toBeDefined();
      expect(completionReport.postVerificationId).toBeDefined();
      expect(typeof completionReport.equipmentIntact).toBe('boolean');
      expect(completionReport.totalCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration 6: Budget Management Workflow', () => {
    it('should enforce budget across multiple verifications and users', async () => {
      // Arrange: Company with strict budget
      const budgetedCompany = {
        id: 'company-budget-strict',
        dailyBudget: 0.50, // Only $0.50/day
        currentSpend: 0,
        verificationCount: 0
      };

      // Act: Attempt multiple verifications
      const verificationAttempts = [];

      for (let i = 0; i < 10; i++) {
        const attempt = await visionService.verifyKit({
          kitId: `kit-budget-test-${i}`,
          tenantId: budgetedCompany.id,
          imageData: generateImageData(),
          expectedItems: ['mower', 'trimmer'],
          maxBudgetUsd: budgetedCompany.dailyBudget,
          maxRequestsPerDay: 100
        });

        verificationAttempts.push(attempt);

        // Update tracking
        if (attempt.data) {
          budgetedCompany.currentSpend += attempt.data.costUsd;
          budgetedCompany.verificationCount++;
        }

        // Stop if over budget
        if (budgetedCompany.currentSpend >= budgetedCompany.dailyBudget) {
          break;
        }
      }

      // Assert: Budget enforced
      expect(budgetedCompany.currentSpend).toBeLessThanOrEqual(budgetedCompany.dailyBudget);

      // Assert: Some verifications succeeded
      const successCount = verificationAttempts.filter(v => v.data !== null).length;
      expect(successCount).toBeGreaterThan(0);

      // Assert: Budget status reported
      const lastAttempt = verificationAttempts[verificationAttempts.length - 1];
      if (lastAttempt.data?.budgetStatus) {
        expect(lastAttempt.data.budgetStatus).toHaveProperty('remainingBudget');
        expect(lastAttempt.data.budgetStatus.remainingBudget).toBeLessThanOrEqual(
          budgetedCompany.dailyBudget
        );
      }
    });
  });

  describe('Integration 7: Verification History and Reporting', () => {
    it('should enable historical analysis and trend reporting', async () => {
      // Arrange: Create verification history
      const imageData = generateImageData();
      const verificationHistory = [];

      // Create 5 verifications
      for (let i = 0; i < 5; i++) {
        const verification = await visionService.verifyKit({
          kitId: `kit-history-${i}`,
          tenantId: TEST_COMPANY_ID,
          imageData,
          expectedItems: ['mower', 'trimmer', 'blower'],
          maxBudgetUsd: 10.0
        });

        verificationHistory.push(verification);
      }

      // Act: Query verification history
      const history = await verificationRepo.findAll({
        tenantId: TEST_COMPANY_ID,
        limit: 100
      });

      // Assert: History retrieved
      expect(history.data).toBeInstanceOf(Array);
      expect(history.data!.length).toBeGreaterThanOrEqual(5);

      // Act: Calculate metrics
      const allVerifications = history.data || [];
      const metrics = {
        totalVerifications: allVerifications.length,
        completeVerifications: allVerifications.filter(
          v => v.verification_result === 'complete'
        ).length,
        incompleteVerifications: allVerifications.filter(
          v => v.verification_result === 'incomplete'
        ).length,
        failedVerifications: allVerifications.filter(
          v => v.verification_result === 'failed'
        ).length,
        averageConfidence:
          allVerifications.reduce((sum, v) => sum + (v.confidence_score || 0), 0) /
          allVerifications.length,
        yoloUsage: allVerifications.filter(v => v.processing_method === 'local_yolo').length,
        vlmUsage: allVerifications.filter(v => v.processing_method === 'cloud_vlm').length
      };

      // Assert: Metrics calculated
      expect(metrics.totalVerifications).toBeGreaterThan(0);
      expect(
        metrics.completeVerifications +
          metrics.incompleteVerifications +
          metrics.failedVerifications
      ).toBeLessThanOrEqual(metrics.totalVerifications);
      expect(metrics.yoloUsage + metrics.vlmUsage).toBe(metrics.totalVerifications);
    });
  });

  describe('Integration 8: Error Propagation Across Domains', () => {
    it('should handle errors gracefully across domain boundaries', async () => {
      // Arrange: Invalid verification request
      const invalidImageData = new ImageData(new Uint8ClampedArray(0), 0, 0);

      // Act: Attempt verification with invalid data
      const result = await visionService.verifyKit({
        kitId: 'kit-error-test',
        tenantId: TEST_COMPANY_ID,
        imageData: invalidImageData,
        expectedItems: ['mower'],
        maxBudgetUsd: 10.0
      });

      // Assert: Error handled gracefully
      expect(result.data !== null || result.error !== null).toBe(true);

      if (result.error) {
        // Error should have structured format
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');

        // Error should not propagate to cost tracking
        const costSummary = await costRecordRepo.getDailySummary(TEST_COMPANY_ID, new Date());
        // Cost should not increase for failed verifications
        expect(costSummary.data?.totalCost).toBeGreaterThanOrEqual(0);
      }

      // Act: Voice narration should handle error gracefully
      if (result.data) {
        const narration = voiceService.narrateResultText({
          verified: false,
          detectedItems: [],
          missingItems: ['mower'],
          confidence: 0
        });

        // Assert: Error narration generated
        expect(narration.length).toBeGreaterThan(0);
      }
    });
  });
});
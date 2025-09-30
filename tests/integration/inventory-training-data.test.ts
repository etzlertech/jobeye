/**
 * Integration Test: Training Data Collection
 *
 * Feature: 004-voice-vision-inventory
 * Purpose: Test end-to-end training data collection workflow
 *
 * Test T019: Training data collection integration
 * - User selections and corrections stored
 * - YOLO detections and VLM analysis captured
 * - Context metadata preserved
 * - Export format for YOLO fine-tuning
 *
 * MUST FAIL: TrainingDataService does not exist yet (TDD)
 */

import { TrainingDataService } from '@/domains/vision/services/training-data.service';
import { YoloInferenceService } from '@/domains/vision/services/yolo-inference.service';
import { VlmFallbackService } from '@/domains/vision/services/vlm-fallback.service';

describe('Training Data Collection Integration Test (T019)', () => {
  let trainingDataService: TrainingDataService;
  let yoloService: YoloInferenceService;
  let vlmService: VlmFallbackService;

  const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
  const USER_ID = 'user-test-1';

  beforeEach(() => {
    trainingDataService = new TrainingDataService();
    yoloService = new YoloInferenceService();
    vlmService = new VlmFallbackService();
  });

  describe('End-to-end training data workflow', () => {
    it('should capture complete detection session', async () => {
      // 1. User takes photo
      const photo = new File(['fake-image'], 'equipment.jpg', { type: 'image/jpeg' });
      const photoUrl = 'https://storage.example.com/photos/photo-1.jpg';

      // 2. YOLO detection runs
      const yoloDetections = await yoloService.detect(photo);

      // 3. User selects items 1, 2, 5 (out of 7 detected)
      const userSelections = [1, 2, 5];

      // 4. User corrects detection #2
      const userCorrections = [
        {
          detectionNumber: 2,
          originalLabel: 'backpack',
          correctedLabel: 'sprayer',
          correctionReason: 'YOLO misidentified sprayer as backpack',
        },
      ];

      // 5. User excludes background items
      const userExclusions = [
        { detectionNumber: 3, label: 'cooler', reason: 'background_item' },
        { detectionNumber: 6, label: 'person', reason: 'background_item' },
      ];

      // 6. Capture context
      const context = {
        gpsLat: 37.7749,
        gpsLng: -122.4194,
        locationType: 'customer_site',
        transactionIntent: 'check_out',
        timestamp: new Date().toISOString(),
      };

      // 7. Store training record
      const trainingRecord = await trainingDataService.createRecord({
        companyId: COMPANY_ID,
        userId: USER_ID,
        originalPhotoUrl: photoUrl,
        yoloDetections: yoloDetections,
        vlmAnalysis: null, // YOLO was sufficient
        userSelections,
        userCorrections,
        userExclusions,
        context,
        voiceTranscript: 'Add items one, two, and five',
        createdRecordIds: ['item-a', 'item-b', 'item-c'],
      });

      expect(trainingRecord).toHaveProperty('id');
      expect(trainingRecord.userSelections).toEqual([1, 2, 5]);
      expect(trainingRecord.userCorrections).toHaveLength(1);
      expect(trainingRecord.userExclusions).toHaveLength(2);
    });

    it('should capture VLM fallback analysis', async () => {
      const photo = new File(['fake-image'], 'equipment.jpg', { type: 'image/jpeg' });

      // 1. YOLO detection returns low confidence
      const yoloDetections = await yoloService.detect(photo);
      const lowConfidence = yoloDetections.detections.every((d: any) => d.confidence < 0.7);

      // 2. VLM fallback triggered
      let vlmAnalysis = null;
      if (lowConfidence) {
        vlmAnalysis = await vlmService.analyze(photo, {
          prompt: 'Identify lawn care equipment',
        });
      }

      // 3. Store both YOLO and VLM results
      const trainingRecord = await trainingDataService.createRecord({
        companyId: COMPANY_ID,
        userId: USER_ID,
        originalPhotoUrl: 'photo.jpg',
        yoloDetections,
        vlmAnalysis,
        userSelections: [1],
        userCorrections: [],
        userExclusions: [],
        context: {},
        createdRecordIds: ['item-1'],
      });

      expect(trainingRecord.vlmAnalysis).toBeDefined();
      expect(trainingRecord.vlmAnalysis.provider).toBe('openai');
      expect(trainingRecord.vlmAnalysis.cost).toBeGreaterThan(0);
    });

    it('should store annotations for YOLO export', async () => {
      const trainingRecordId = 'training-record-1';

      // User corrected 3 detections
      const annotations = [
        {
          itemDetectionNumber: 1,
          correctedLabel: 'mower',
          correctedBbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          correctionReason: 'Accurate detection',
        },
        {
          itemDetectionNumber: 2,
          correctedLabel: 'trimmer',
          correctedBbox: { x: 0.5, y: 0.6, width: 0.2, height: 0.3 },
          correctionReason: 'Bbox too large, adjusted',
        },
        {
          itemDetectionNumber: 5,
          correctedLabel: 'sprayer',
          correctedBbox: { x: 0.7, y: 0.1, width: 0.25, height: 0.35 },
          correctionReason: 'Label correction from backpack to sprayer',
        },
      ];

      for (const annotation of annotations) {
        await trainingDataService.addAnnotation(trainingRecordId, annotation);
      }

      const storedAnnotations = await trainingDataService.getAnnotations(trainingRecordId);
      expect(storedAnnotations).toHaveLength(3);
    });

    it('should export training data in YOLO format', async () => {
      // Collect 100 training records
      const recordIds = Array.from({ length: 100 }, (_, i) => `record-${i}`);

      // Export for fine-tuning
      const yoloExport = await trainingDataService.exportForYolo({
        companyId: COMPANY_ID,
        minRecords: 100,
        classes: ['mower', 'trimmer', 'blower', 'edger', 'sprayer'],
      });

      expect(yoloExport.images).toHaveLength(100);
      expect(yoloExport.annotations).toHaveLength(100);

      // Check YOLO annotation format
      const firstAnnotation = yoloExport.annotations[0];
      expect(firstAnnotation).toMatch(/^\d+ \d+\.\d+ \d+\.\d+ \d+\.\d+ \d+\.\d+$/); // class_id x y w h
    });

    it('should track quality metrics', async () => {
      const trainingRecord = await trainingDataService.createRecord({
        companyId: COMPANY_ID,
        userId: USER_ID,
        originalPhotoUrl: 'photo.jpg',
        yoloDetections: { detections: [], inferenceTimeMs: 1200 },
        userSelections: [1, 2],
        userCorrections: [{ detectionNumber: 1, correctedLabel: 'mower' }],
        userExclusions: [],
        context: {},
        qualityMetrics: {
          retakeCount: 2, // User retook photo twice for better quality
          correctionCount: 1,
          userSatisfactionRating: 4, // 1-5 scale
        },
        createdRecordIds: ['item-1', 'item-2'],
      });

      expect(trainingRecord.qualityMetrics.retakeCount).toBe(2);
      expect(trainingRecord.qualityMetrics.correctionCount).toBe(1);
      expect(trainingRecord.qualityMetrics.userSatisfactionRating).toBe(4);
    });

    it('should filter training data by context for targeted fine-tuning', async () => {
      // Query training data for specific contexts
      const checkOutRecords = await trainingDataService.queryByContext({
        companyId: COMPANY_ID,
        locationType: 'customer_site',
        transactionIntent: 'check_out',
        minRecords: 50,
      });

      expect(checkOutRecords.length).toBeGreaterThanOrEqual(50);
      expect(checkOutRecords.every((r: any) => r.context.transactionIntent === 'check_out')).toBe(true);
    });

    it('should track VLM usage rate for model improvement', async () => {
      const stats = await trainingDataService.getVlmUsageStats({
        companyId: COMPANY_ID,
        startDate: new Date('2025-09-01'),
        endDate: new Date('2025-09-30'),
      });

      expect(stats.totalDetections).toBeGreaterThan(0);
      expect(stats.vlmUsageCount).toBeDefined();
      expect(stats.vlmUsageRate).toBeLessThan(0.5); // Target <10%, should be well below
      expect(stats.averageCost).toBeDefined();
    });

    it('should preserve voice transcript with training data', async () => {
      const trainingRecord = await trainingDataService.createRecord({
        companyId: COMPANY_ID,
        userId: USER_ID,
        originalPhotoUrl: 'photo.jpg',
        yoloDetections: { detections: [] },
        userSelections: [1, 2, 3],
        userCorrections: [],
        userExclusions: [],
        context: {},
        voiceTranscript: 'Check out the red mower, trimmer, and blower from the main truck',
        createdRecordIds: ['item-1', 'item-2', 'item-3'],
      });

      expect(trainingRecord.voiceTranscript).toBe(
        'Check out the red mower, trimmer, and blower from the main truck'
      );
    });

    it('should link training records to created inventory items', async () => {
      const createdItemIds = ['item-a', 'item-b', 'item-c'];

      const trainingRecord = await trainingDataService.createRecord({
        companyId: COMPANY_ID,
        userId: USER_ID,
        originalPhotoUrl: 'photo.jpg',
        yoloDetections: { detections: [] },
        userSelections: [1, 2, 3],
        userCorrections: [],
        userExclusions: [],
        context: {},
        createdRecordIds: createdItemIds,
      });

      expect(trainingRecord.createdRecordIds).toEqual(createdItemIds);

      // Should be able to query training data by item ID
      const itemTrainingHistory = await trainingDataService.getByItemId('item-a');
      expect(itemTrainingHistory).toHaveLength(1);
      expect(itemTrainingHistory[0].id).toBe(trainingRecord.id);
    });

    it('should handle retakes and track improvement', async () => {
      const sessionId = 'detection-session-1';

      // First attempt - poor lighting
      const attempt1 = await trainingDataService.createRecord({
        companyId: COMPANY_ID,
        userId: USER_ID,
        originalPhotoUrl: 'photo-attempt1.jpg',
        yoloDetections: { detections: [], inferenceTimeMs: 1500 },
        userSelections: [],
        userCorrections: [],
        userExclusions: [],
        context: { sessionId, attemptNumber: 1 },
        qualityMetrics: { retakeCount: 0 },
        createdRecordIds: [], // No items created, user retook
      });

      // Second attempt - better photo
      const attempt2 = await trainingDataService.createRecord({
        companyId: COMPANY_ID,
        userId: USER_ID,
        originalPhotoUrl: 'photo-attempt2.jpg',
        yoloDetections: { detections: [{ label: 'mower', confidence: 0.85 }] },
        userSelections: [1],
        userCorrections: [],
        userExclusions: [],
        context: { sessionId, attemptNumber: 2 },
        qualityMetrics: { retakeCount: 1 },
        createdRecordIds: ['item-1'],
      });

      const sessionRecords = await trainingDataService.getBySession(sessionId);
      expect(sessionRecords).toHaveLength(2);
      expect(sessionRecords[1].qualityMetrics.retakeCount).toBe(1);
    });
  });
});
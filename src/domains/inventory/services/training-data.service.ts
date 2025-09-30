/**
 * @file /src/domains/inventory/services/training-data.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Collect and manage training data for improving detection accuracy
 * @complexity_budget 200
 * @feature 004-voice-vision-inventory
 *
 * Training data collection flow:
 * 1. Capture user corrections to detection results
 * 2. Store image crops with ground truth labels
 * 3. Track confidence scores and improvements
 * 4. Export for model fine-tuning
 */

import * as trainingDataRepo from '../repositories/training-data.repository';
import type { TrainingDataRecord } from '../types/inventory-types';

export interface TrainingDataRequest {
  companyId: string;
  userId: string;
  detectionSessionId: string;
  imageUrl: string;
  cropUrl?: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  detectedLabel: string;
  detectedConfidence: number;
  correctedLabel: string;
  correctedItemId?: string;
  detectionMethod: 'yolo' | 'vlm';
}

export interface TrainingDataResult {
  success: boolean;
  record: TrainingDataRecord | null;
  error?: Error;
}

/**
 * Create training data record from user correction
 */
export async function recordCorrection(
  request: TrainingDataRequest
): Promise<TrainingDataResult> {
  try {
    const recordData = {
      company_id: request.companyId,
      detection_session_id: request.detectionSessionId,
      image_url: request.imageUrl,
      crop_url: request.cropUrl,
      bbox: request.bbox,
      detected_label: request.detectedLabel,
      detected_confidence: request.detectedConfidence,
      corrected_label: request.correctedLabel,
      corrected_item_id: request.correctedItemId,
      detection_method: request.detectionMethod,
      created_by: request.userId,
      metadata: {
        wasCorrection: request.detectedLabel !== request.correctedLabel,
        confidenceGap: Math.abs(request.detectedConfidence - 1.0),
      },
    };

    const result = await trainingDataRepo.create(recordData);

    if (result.error || !result.data) {
      return {
        success: false,
        record: null,
        error: result.error || new Error('Failed to create training data record'),
      };
    }

    return {
      success: true,
      record: result.data,
    };
  } catch (err: any) {
    return {
      success: false,
      record: null,
      error: new Error(`Training data recording failed: ${err.message}`),
    };
  }
}

/**
 * Batch record corrections from detection session
 */
export async function recordSessionCorrections(
  companyId: string,
  userId: string,
  detectionSessionId: string,
  corrections: Array<{
    imageUrl: string;
    cropUrl?: string;
    bbox?: { x: number; y: number; width: number; height: number };
    detectedLabel: string;
    detectedConfidence: number;
    correctedLabel: string;
    correctedItemId?: string;
    detectionMethod: 'yolo' | 'vlm';
  }>
): Promise<{ success: boolean; records: TrainingDataRecord[]; errors: Error[] }> {
  const records: TrainingDataRecord[] = [];
  const errors: Error[] = [];

  for (const correction of corrections) {
    const result = await recordCorrection({
      companyId,
      userId,
      detectionSessionId,
      ...correction,
    });

    if (result.success && result.record) {
      records.push(result.record);
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    success: errors.length === 0,
    records,
    errors,
  };
}

/**
 * Get training data for company
 */
export async function getTrainingData(
  companyId: string,
  limit?: number
): Promise<{ data: TrainingDataRecord[]; error: Error | null }> {
  return await trainingDataRepo.findByCompany(companyId, limit);
}

/**
 * Get training data by detection session
 */
export async function getTrainingDataBySession(
  sessionId: string
): Promise<{ data: TrainingDataRecord | null; error: Error | null }> {
  return await trainingDataRepo.findById(sessionId);
}

/**
 * Calculate detection accuracy metrics
 */
export async function calculateAccuracyMetrics(
  companyId: string
): Promise<{
  data: {
    totalDetections: number;
    correctDetections: number;
    correctedDetections: number;
    accuracy: number;
    yoloAccuracy: number;
    vlmAccuracy: number;
    avgConfidence: number;
  } | null;
  error: Error | null;
}> {
  try {
    const result = await trainingDataRepo.findByCompany(companyId, 1000);

    if (result.error) {
      return { data: null, error: result.error };
    }

    const records = result.data;
    const totalDetections = records.length;

    if (totalDetections === 0) {
      return {
        data: {
          totalDetections: 0,
          correctDetections: 0,
          correctedDetections: 0,
          accuracy: 0,
          yoloAccuracy: 0,
          vlmAccuracy: 0,
          avgConfidence: 0,
        },
        error: null,
      };
    }

    const correctDetections = records.filter(
      (r) => r.detected_label === r.corrected_label
    ).length;

    const correctedDetections = totalDetections - correctDetections;

    const yoloRecords = records.filter((r) => r.detection_method === 'yolo');
    const vlmRecords = records.filter((r) => r.detection_method === 'vlm');

    const yoloCorrect = yoloRecords.filter(
      (r) => r.detected_label === r.corrected_label
    ).length;
    const vlmCorrect = vlmRecords.filter(
      (r) => r.detected_label === r.corrected_label
    ).length;

    const avgConfidence =
      records.reduce((sum, r) => sum + r.detected_confidence, 0) / totalDetections;

    return {
      data: {
        totalDetections,
        correctDetections,
        correctedDetections,
        accuracy: correctDetections / totalDetections,
        yoloAccuracy: yoloRecords.length > 0 ? yoloCorrect / yoloRecords.length : 0,
        vlmAccuracy: vlmRecords.length > 0 ? vlmCorrect / vlmRecords.length : 0,
        avgConfidence,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`Accuracy calculation failed: ${err.message}`),
    };
  }
}
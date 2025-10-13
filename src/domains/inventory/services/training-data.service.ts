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

import { TrainingDataRepository } from '../repositories/training-data.repository.class';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { TrainingDataRecord } from '../types/inventory-types';

export interface TrainingDataRequest {
  tenantId: string;
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

// Initialize repository
const supabase = createSupabaseClient();
const trainingDataRepo = new TrainingDataRepository(supabase);

/**
 * Create training data record from user correction
 */
export async function recordCorrection(
  request: TrainingDataRequest
): Promise<TrainingDataResult> {
  try {
    const recordData = {
      tenantId: request.tenantId,
      detectionSessionId: request.detectionSessionId,
      imageUrl: request.imageUrl,
      cropUrl: request.cropUrl,
      bbox: request.bbox,
      detectedLabel: request.detectedLabel,
      detectedConfidence: request.detectedConfidence,
      correctedLabel: request.correctedLabel,
      correctedItemId: request.correctedItemId,
      detectionMethod: request.detectionMethod,
      createdBy: request.userId,
      metadata: {
        wasCorrection: request.detectedLabel !== request.correctedLabel,
        confidenceGap: Math.abs(request.detectedConfidence - 1.0),
      },
    };

    const record = await trainingDataRepo.create(recordData);

    return {
      success: true,
      record,
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
  tenantId: string,
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
      tenantId,
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
  tenantId: string,
  limit?: number
): Promise<{ data: TrainingDataRecord[]; error: Error | null }> {
  try {
    const data = await trainingDataRepo.findAll({ tenantId }, limit);
    return { data, error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

/**
 * Get training data by detection session
 */
export async function getTrainingDataBySession(
  sessionId: string
): Promise<{ data: TrainingDataRecord | null; error: Error | null }> {
  try {
    const data = await trainingDataRepo.findById(sessionId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Calculate detection accuracy metrics
 */
export async function calculateAccuracyMetrics(
  tenantId: string
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
    const records = await trainingDataRepo.findAll({ tenantId }, 1000);
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
      (r: any) => r.detected_label === r.corrected_label
    ).length;

    const correctedDetections = totalDetections - correctDetections;

    const yoloRecords = records.filter((r: any) => r.detection_method === 'yolo');
    const vlmRecords = records.filter((r: any) => r.detection_method === 'vlm');

    const yoloCorrect = yoloRecords.filter(
      (r: any) => r.detected_label === r.corrected_label
    ).length;
    const vlmCorrect = vlmRecords.filter(
      (r: any) => r.detected_label === r.corrected_label
    ).length;

    const avgConfidence =
      records.reduce((sum: any, r: any) => sum + r.detected_confidence, 0) / totalDetections;

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
/**
 * @file useVLMFallback.ts
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose VLM cloud fallback for low-confidence detections
 * @complexity_budget 200
 */

import { useState, useCallback } from 'react';
import { VLMFallbackService } from '@/domains/vision/services/vlm-fallback.service';
import type { DetectedItem } from '@/domains/vision/types';

export interface VLMFallbackResult {
  detectedItems: DetectedItem[];
  confidenceScore: number;
  cost: number;
  timestamp: number;
}

export interface VLMFallbackHookResult {
  /** Whether VLM fallback is currently active (loading) */
  isFallbackActive: boolean;
  /** Latest VLM detection result */
  vlmResult: VLMFallbackResult | null;
  /** Error message if VLM request fails */
  error: string | null;
  /** Trigger VLM fallback detection */
  triggerVLMFallback: (imageData: ImageData, expectedItems: string[]) => Promise<VLMFallbackResult | null>;
  /** Reset VLM state */
  reset: () => void;
}

/**
 * Hook for VLM fallback when YOLO confidence too low
 * Calls cloud-based GPT-4 Vision for more accurate detection
 */
export function useVLMFallback(): VLMFallbackHookResult {
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  const [vlmResult, setVlmResult] = useState<VLMFallbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vlmService = new VLMFallbackService();

  /**
   * Trigger VLM fallback detection
   */
  const triggerVLMFallback = useCallback(
    async (imageData: ImageData, expectedItems: string[]): Promise<VLMFallbackResult | null> => {
      try {
        setIsFallbackActive(true);
        setError(null);

        console.log('[useVLMFallback] Triggering VLM fallback', {
          expectedItems,
          imageSize: `${imageData.width}x${imageData.height}`,
        });

        // Convert ImageData to base64
        const base64Photo = imageDataToBase64(imageData);

        // Call VLM service
        const result = await vlmService.verify({
          photo: base64Photo,
          expectedItems,
        });

        const fallbackResult: VLMFallbackResult = {
          detectedItems: result.detectedItems,
          confidenceScore: result.confidenceScore,
          cost: result.cost || 0,
          timestamp: Date.now(),
        };

        setVlmResult(fallbackResult);
        setIsFallbackActive(false);

        console.log('[useVLMFallback] VLM fallback complete', {
          detectedCount: result.detectedItems.length,
          confidence: result.confidenceScore,
          cost: result.cost,
        });

        return fallbackResult;

      } catch (err: any) {
        console.error('[useVLMFallback] VLM fallback failed:', err);

        setError(err.message || 'VLM detection failed');
        setIsFallbackActive(false);
        setVlmResult(null);

        return null;
      }
    },
    []
  );

  /**
   * Reset VLM state
   */
  const reset = useCallback(() => {
    setIsFallbackActive(false);
    setVlmResult(null);
    setError(null);
  }, []);

  return {
    isFallbackActive,
    vlmResult,
    error,
    triggerVLMFallback,
    reset,
  };
}

/**
 * Convert ImageData to base64 data URL
 */
function imageDataToBase64(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * @file useVLMDetection.ts
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose VLM-first detection at 1fps with rate limiting and cost protection
 * @complexity_budget 400
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { detectWithGemini } from '@/domains/vision/services/gemini-vlm.service';
import { getVLMRateLimiter, type RateLimiterStats } from '../lib/vlm-rate-limiter';
import type { DetectedItem } from '@/domains/vision/types';

export interface VLMDetectionOptions {
  expectedItems?: string[];
  enabled?: boolean;
  targetFps?: number; // 1.0 default, can increase to 2.0 for complex scenes
}

export interface VLMDetectionResult {
  /** Latest detection results */
  detectionResults: DetectedItem[];
  /** Whether currently processing VLM request */
  isProcessing: boolean;
  /** Error message if VLM fails */
  error: string | null;
  /** Actual FPS achieved */
  actualFps: number;
  /** Rate limiter statistics */
  rateLimitStats: RateLimiterStats | null;
  /** Start detection on video element */
  startDetection: (videoElement: HTMLVideoElement) => void;
  /** Stop detection and cleanup */
  stopDetection: () => void;
  /** Clear error */
  clearError: () => void;
}

const DEFAULT_TARGET_FPS = 1.0;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * Hook for VLM-based detection (primary detection method)
 * Uses OpenAI GPT-4 Vision with rate limiting and cost protection
 */
export function useVLMDetection(options: VLMDetectionOptions = {}): VLMDetectionResult {
  const {
    expectedItems = [],
    enabled = true,
    targetFps = DEFAULT_TARGET_FPS,
  } = options;

  // State
  const [detectionResults, setDetectionResults] = useState<DetectedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualFps, setActualFps] = useState(0);
  const [rateLimitStats, setRateLimitStats] = useState<RateLimiterStats | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Services
  const rateLimiter = getVLMRateLimiter();

  // FPS measurement (every 10 seconds to account for VLM latency)
  useEffect(() => {
    if (!enabled) return;

    fpsIntervalRef.current = setInterval(() => {
      const fps = frameCountRef.current / 10.0;
      setActualFps(fps);
      frameCountRef.current = 0;

      // Update rate limit stats
      setRateLimitStats(rateLimiter.getStats());
    }, 10000);

    return () => {
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
    };
  }, [enabled]);

  /**
   * Capture frame from video element to ImageData
   */
  const captureFrameToImageData = useCallback((video: HTMLVideoElement): ImageData | null => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[useVLMDetection] Failed to get canvas context');
        return null;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('[useVLMDetection] Failed to capture frame:', error);
      return null;
    }
  }, []);

  /**
   * Convert ImageData to base64 data URL
   */
  const imageDataToBase64 = useCallback((imageData: ImageData): string => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  /**
   * Detect with VLM with retry logic
   */
  const detectWithRetry = useCallback(
    async (imageData: ImageData, attempt = 0): Promise<DetectedItem[]> => {
      try {
        const base64Photo = imageDataToBase64(imageData);

        // Execute with rate limiting
        const result = await rateLimiter.executeWithLimit(async () => {
          return await detectWithGemini({
            imageData: base64Photo,
            expectedItems,
          }, {
            model: 'gemini-2.0-flash',
            includeBboxes: true,
          });
        });

        if (result.data && result.data.detections) {
          // Map VlmDetection to DetectedItem format
          return result.data.detections.map(d => ({
            label: d.label,
            confidence: d.confidence,
            bbox: d.bbox
          } as DetectedItem));
        }

        return [];
      } catch (err: any) {
        // Check if rate limit exceeded
        if (err.message?.includes('Daily VLM budget exceeded')) {
          throw err; // Don't retry rate limit errors
        }

        // Retry with exponential backoff
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt];
          console.warn(`[useVLMDetection] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms:`, err.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          return detectWithRetry(imageData, attempt + 1);
        }

        throw err;
      }
    },
    [expectedItems, rateLimiter, imageDataToBase64]
  );

  /**
   * Process frame with VLM detection
   */
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !enabled || isProcessing) {
      // Continue RAF loop
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    const frameInterval = 1000 / targetFps;
    const delta = now - lastFrameTimeRef.current;

    // Throttle to target FPS
    if (delta >= frameInterval) {
      // Check rate limit before attempting detection
      if (rateLimiter.wouldExceedLimit()) {
        setError(`Daily VLM budget reached. Resets at midnight UTC.`);
        setIsProcessing(false);
        // Still continue RAF loop in case limit resets
        rafIdRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const imageData = captureFrameToImageData(videoRef.current);

      if (imageData) {
        setIsProcessing(true);
        setError(null);

        try {
          const detectedItems = await detectWithRetry(imageData);
          setDetectionResults(detectedItems);
          frameCountRef.current++;
          lastFrameTimeRef.current = now;
        } catch (err: any) {
          console.error('[useVLMDetection] Detection failed:', err);
          setError(err.message || 'VLM detection failed');
        } finally {
          setIsProcessing(false);
        }
      }
    }

    // Continue RAF loop
    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [enabled, targetFps, isProcessing, captureFrameToImageData, detectWithRetry, rateLimiter]);

  /**
   * Start detection
   */
  const startDetection = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (!videoElement) {
        console.error('[useVLMDetection] Cannot start - video element not provided');
        return;
      }

      videoRef.current = videoElement;
      lastFrameTimeRef.current = performance.now();
      frameCountRef.current = 0;

      // Start RAF loop
      rafIdRef.current = requestAnimationFrame(processFrame);

      console.log(`[useVLMDetection] Detection started at ${targetFps}fps with VLM (cost protection enabled)`);
    },
    [processFrame, targetFps]
  );

  /**
   * Stop detection
   */
  const stopDetection = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    videoRef.current = null;
    setIsProcessing(false);

    console.log('[useVLMDetection] Detection stopped');
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    detectionResults,
    isProcessing,
    error,
    actualFps,
    rateLimitStats,
    startDetection,
    stopDetection,
    clearError,
  };
}

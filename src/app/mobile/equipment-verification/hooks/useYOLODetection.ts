/**
 * @file useYOLODetection.ts
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose 1fps throttled YOLO detection via Web Worker
 * @complexity_budget 400
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { DetectedItem } from '@/domains/vision/types';

export interface DetectionResult {
  detectedItems: DetectedItem[];
  confidenceScore: number;
  shouldFallback: boolean;
  retryCount: number;
  timestamp: number;
}

export interface YOLODetectionOptions {
  expectedItems?: string[];
  confidenceThreshold?: number;
  enabled?: boolean;
}

export interface YOLODetectionResult {
  /** Latest detection results */
  detectionResults: DetectedItem[];
  /** Overall confidence score (0-1) */
  confidenceScore: number;
  /** Whether currently processing frame */
  isProcessing: boolean;
  /** Number of detection retries */
  retryCount: number;
  /** Whether VLM fallback should be triggered */
  shouldFallback: boolean;
  /** FPS measurement (actual frames processed per second) */
  actualFps: number;
  /** Start detection on video element */
  startDetection: (videoElement: HTMLVideoElement) => void;
  /** Stop detection and cleanup */
  stopDetection: () => void;
  /** Reset retry count */
  resetRetries: () => void;
}

const TARGET_FPS = 1.0;
const FRAME_INTERVAL_MS = 1000; // 1fps = 1000ms
const CONFIDENCE_THRESHOLD = 0.7;
const MAX_RETRIES = 3;

/**
 * Hook for YOLO detection with 1fps throttling via Web Worker
 * Uses requestAnimationFrame for precise timing synchronized with display refresh
 */
export function useYOLODetection(options: YOLODetectionOptions = {}): YOLODetectionResult {
  const {
    expectedItems = [],
    confidenceThreshold = CONFIDENCE_THRESHOLD,
    enabled = true,
  } = options;

  // State
  const [detectionResults, setDetectionResults] = useState<DetectedItem[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [shouldFallback, setShouldFallback] = useState(false);
  const [actualFps, setActualFps] = useState(0);

  // Refs
  const workerRef = useRef<Worker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      return;
    }

    try {
      // Create worker from worker file
      const workerPath = new URL(
        '../workers/yolo-detection.worker.ts',
        import.meta.url
      );
      workerRef.current = new Worker(workerPath, { type: 'module' });

      // Handle worker messages
      workerRef.current.onmessage = (event: MessageEvent) => {
        const { type, detectedItems, confidenceScore, shouldFallback, retryCount } = event.data;

        if (type === 'RESULT') {
          setDetectionResults(detectedItems);
          setConfidenceScore(confidenceScore);
          setShouldFallback(shouldFallback);
          setRetryCount(retryCount);
          setIsProcessing(false);

          // Increment frame count for FPS calculation
          frameCountRef.current++;
        } else if (type === 'ERROR') {
          console.error('[useYOLODetection] Worker error:', event.data.error);
          setIsProcessing(false);
          setRetryCount(prev => prev + 1);
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('[useYOLODetection] Worker error:', error);
        setIsProcessing(false);
      };

    } catch (error) {
      console.error('[useYOLODetection] Failed to initialize worker:', error);
    }

    // Cleanup on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [enabled]);

  // FPS measurement interval (measure every 5 seconds)
  useEffect(() => {
    if (!enabled) {
      return;
    }

    fpsIntervalRef.current = setInterval(() => {
      const fps = frameCountRef.current / 5.0; // Frames in last 5 seconds / 5
      setActualFps(fps);
      frameCountRef.current = 0; // Reset counter
    }, 5000);

    return () => {
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
        fpsIntervalRef.current = null;
      }
    };
  }, [enabled]);

  // Capture frame from video element to ImageData
  const captureFrameToImageData = useCallback((video: HTMLVideoElement): ImageData | null => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[useYOLODetection] Failed to get canvas context');
        return null;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);

    } catch (error) {
      console.error('[useYOLODetection] Failed to capture frame:', error);
      return null;
    }
  }, []);

  // Process frame with 1fps throttling
  const processFrame = useCallback(() => {
    if (!videoRef.current || !workerRef.current || !enabled) {
      return;
    }

    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;

    // Throttle to 1fps (1000ms interval)
    if (delta >= FRAME_INTERVAL_MS) {
      const imageData = captureFrameToImageData(videoRef.current);

      if (imageData) {
        setIsProcessing(true);
        workerRef.current.postMessage({
          type: 'DETECT',
          imageData,
          expectedItems,
        });

        lastFrameTimeRef.current = now;
      }
    }

    // Continue RAF loop
    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [enabled, expectedItems, captureFrameToImageData]);

  // Start detection
  const startDetection = useCallback((videoElement: HTMLVideoElement) => {
    if (!videoElement || !workerRef.current) {
      console.error('[useYOLODetection] Cannot start - video or worker not ready');
      return;
    }

    videoRef.current = videoElement;
    lastFrameTimeRef.current = performance.now();
    frameCountRef.current = 0;

    // Start RAF loop
    rafIdRef.current = requestAnimationFrame(processFrame);

    console.log('[useYOLODetection] Detection started at 1fps');
  }, [processFrame]);

  // Stop detection
  const stopDetection = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    videoRef.current = null;
    setIsProcessing(false);

    console.log('[useYOLODetection] Detection stopped');
  }, []);

  // Reset retry count
  const resetRetries = useCallback(() => {
    setRetryCount(0);
    setShouldFallback(false);
  }, []);

  // Auto-trigger fallback after max retries
  useEffect(() => {
    if (retryCount >= MAX_RETRIES) {
      setShouldFallback(true);
      console.warn('[useYOLODetection] Max retries reached - VLM fallback recommended');
    }
  }, [retryCount]);

  // Auto-trigger fallback on low confidence
  useEffect(() => {
    if (confidenceScore > 0 && confidenceScore < confidenceThreshold) {
      setShouldFallback(true);
      console.warn('[useYOLODetection] Low confidence - VLM fallback recommended', confidenceScore);
    }
  }, [confidenceScore, confidenceThreshold]);

  return {
    detectionResults,
    confidenceScore,
    isProcessing,
    retryCount,
    shouldFallback,
    actualFps,
    startDetection,
    stopDetection,
    resetRetries,
  };
}

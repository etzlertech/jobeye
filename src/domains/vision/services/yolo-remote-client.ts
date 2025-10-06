/**
 * @file src/domains/vision/services/yolo-remote-client.ts
 * @phase 3
 * @domain vision
 * @purpose Remote YOLO inference client with configurable endpoint fallback.
 * @complexity_budget 250 LoC
 * @dependencies
 *   external: fetch (Node 18+ / Next.js runtime)
 * @exports
 *   - RemoteYoloConfig
 *   - detectWithRemoteYolo
 *   - isRemoteYoloConfigured
 * @voice_considerations
 *   - Enables voice workflows to rely on consistent YOLO confidence when remote runtime is configured.
 * END AGENT DIRECTIVE BLOCK
 */

import { Buffer } from 'node:buffer';
import { voiceLogger } from '@/core/logger/voice-logger';

export interface RemoteYoloDetection {
  label: string;
  confidence: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RemoteYoloResponse {
  detections: RemoteYoloDetection[];
  processingTimeMs?: number;
  modelVersion?: string;
}

export interface RemoteYoloConfig {
  endpoint: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxDetections?: number;
}

export interface RemoteYoloDetectOptions {
  confidenceThreshold?: number;
  maxDetections?: number;
}

interface RemoteYoloApiDetection {
  label?: string;
  class?: string;
  confidence?: number;
  score?: number;
  bbox?: RemoteYoloDetection['bbox'];
  boundingBox?: RemoteYoloDetection['bbox'];
  box?: RemoteYoloDetection['bbox'];
}

interface RemoteYoloApiResponse {
  detections?: RemoteYoloApiDetection[];
  latencyMs?: number;
  processingTimeMs?: number;
  modelVersion?: string;
}

export function isRemoteYoloConfigured(config?: Partial<RemoteYoloConfig>): config is RemoteYoloConfig {
  return Boolean(config?.endpoint);
}

export async function detectWithRemoteYolo(
  image: Blob,
  config: RemoteYoloConfig,
  options: RemoteYoloDetectOptions = {}
): Promise<RemoteYoloResponse> {
  if (!isRemoteYoloConfigured(config)) {
    throw new Error('Remote YOLO endpoint not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15000);

  try {
    const payload = await buildRequestPayload(image, config, options);

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await safeReadText(response);
      throw new Error(`Remote YOLO request failed: ${response.status} ${response.statusText} ${text}`.trim());
    }

    const raw = (await response.json()) as RemoteYoloApiResponse;
    return normaliseResponse(raw, config);
  } catch (error: any) {
    const message = error?.message ?? String(error);
    voiceLogger.error('Remote YOLO inference failed', { message });
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}

async function buildRequestPayload(
  image: Blob,
  config: RemoteYoloConfig,
  options: RemoteYoloDetectOptions
) {
  const arrayBuffer = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return {
    image_base64: base64,
    model: config.model,
    maxDetections: options.maxDetections ?? config.maxDetections,
    confidenceThreshold: options.confidenceThreshold,
  };
}

function buildHeaders(config: RemoteYoloConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return headers;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function normaliseResponse(
  raw: RemoteYoloApiResponse,
  config: RemoteYoloConfig
): RemoteYoloResponse {
  const detections = Array.isArray(raw.detections)
    ? raw.detections
        .map((item) => normaliseDetection(item))
        .filter((item): item is RemoteYoloDetection => Boolean(item))
    : [];

  return {
    detections,
    processingTimeMs: raw.processingTimeMs ?? raw.latencyMs,
    modelVersion: raw.modelVersion ?? config.model ?? 'remote-yolo',
  };
}

function normaliseDetection(item: RemoteYoloApiDetection | null | undefined): RemoteYoloDetection | null {
  if (!item) return null;

  const label = (item.label ?? item.class ?? '').toString().trim();
  const confidenceSource = typeof item.confidence === 'number' ? item.confidence : item.score;
  const confidence = typeof confidenceSource === 'number' ? confidenceSource : undefined;

  if (!label || typeof confidence !== 'number') {
    return null;
  }

  const bbox = item.bbox ?? item.boundingBox ?? item.box;

  return {
    label,
    confidence,
    bbox: bbox
      ? {
          x: bbox.x ?? bbox.left ?? 0,
          y: bbox.y ?? bbox.top ?? 0,
          width: bbox.width ?? bbox.w ?? 0,
          height: bbox.height ?? bbox.h ?? 0,
        }
      : undefined,
  };
}

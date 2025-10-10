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

import { Buffer } from 'buffer';
import { voiceLogger } from '@/core/logger/voice-logger';
import { VisionBoundingBox, YoloDetection, YoloDetectionBatch } from '@/domains/vision/lib/vision-types';

export type RemoteYoloDetection = YoloDetection;

export type RemoteYoloResponse = YoloDetectionBatch;

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
  bbox?: Partial<VisionBoundingBox> & Record<string, number | undefined>;
  boundingBox?: Partial<VisionBoundingBox> & Record<string, number | undefined>;
  box?: Partial<VisionBoundingBox> & Record<string, number | undefined>;
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
  const modelVersion = raw.modelVersion ?? config.model ?? 'remote-yolo';
  const provider = config.model ?? 'remote_yolo';
  const detections = Array.isArray(raw.detections)
    ? raw.detections
        .map((item) => normaliseDetection(item, modelVersion, provider))
        .filter((item): item is RemoteYoloDetection => Boolean(item))
    : [];

  return {
    source: 'remote_yolo',
    provider,
    modelVersion,
    detections,
    processingTimeMs: raw.processingTimeMs ?? raw.latencyMs,
    metadata: {
      rawDetections: Array.isArray(raw.detections) ? raw.detections.length : 0,
    },
  };
}

function normaliseDetection(
  item: RemoteYoloApiDetection | null | undefined,
  modelVersion: string,
  provider: string
): RemoteYoloDetection | null {
  if (!item) return null;

  const label = (item.label ?? item.class ?? '').toString().trim();
  const confidenceSource = typeof item.confidence === 'number' ? item.confidence : item.score;
  const confidence = typeof confidenceSource === 'number' ? confidenceSource : undefined;

  if (!label || typeof confidence !== 'number') {
    return null;
  }

  const bbox = item.bbox ?? item.boundingBox ?? item.box;
  if (!bbox) {
    return null;
  }

  const x = toFiniteNumber(bbox.x ?? bbox.left);
  const y = toFiniteNumber(bbox.y ?? bbox.top);
  const width = toFiniteNumber(bbox.width ?? bbox.w);
  const height = toFiniteNumber(bbox.height ?? bbox.h);

  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return null;
  }

  const detection: RemoteYoloDetection = {
    source: 'remote_yolo',
    itemType: label,
    confidence,
    boundingBox: { x, y, width, height },
    provider,
    modelVersion,
  };

  const classId = toFiniteNumber((item as any).classId ?? (item as any).class_id);
  if (typeof classId === 'number') {
    detection.classId = Math.round(classId);
  }

  return detection;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

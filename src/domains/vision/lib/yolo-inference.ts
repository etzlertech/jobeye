/**
 * @file /src/domains/vision/lib/yolo-inference.ts
 * @phase 3.4
 * @domain Vision
 * @purpose YOLO inference engine with 3s timeout and result parsing
 * @complexity_budget 300
 * @test_coverage ≥80%
 * @dependencies onnxruntime-web, ./yolo-loader
 */

import * as ort from 'onnxruntime-web';
import { loadYoloModel } from './yolo-loader';

// YOLOv11n configuration
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.4; // Pre-filter low confidence detections
const IOU_THRESHOLD = 0.45; // Non-maximum suppression
const INFERENCE_TIMEOUT_MS = 3000;

// COCO class names (YOLOv11 uses COCO dataset)
const CLASS_NAMES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface YoloDetection {
  itemType: string;
  confidence: number;
  boundingBox: BoundingBox;
  classId: number;
}

export interface YoloInferenceResult {
  detections: YoloDetection[];
  processingTimeMs: number;
  inputWidth: number;
  inputHeight: number;
  modelInputSize: number;
}

let cachedSession: ort.InferenceSession | null = null;

/**
 * Preprocess image to YOLO input format (640x640 RGB normalized)
 */
function preprocessImage(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData;
  const input = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

  // Calculate scaling
  const scale = INPUT_SIZE / Math.max(width, height);
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);

  // Offsets for centering
  const offsetX = Math.floor((INPUT_SIZE - scaledWidth) / 2);
  const offsetY = Math.floor((INPUT_SIZE - scaledHeight) / 2);

  // Normalize and convert RGBA to RGB (CHW format)
  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const srcIdx = (srcY * width + srcX) * 4;

      const dstX = x + offsetX;
      const dstY = y + offsetY;
      const dstIdx = dstY * INPUT_SIZE + dstX;

      // Normalize to [0, 1] and arrange in CHW format
      input[dstIdx] = data[srcIdx] / 255.0; // R
      input[INPUT_SIZE * INPUT_SIZE + dstIdx] = data[srcIdx + 1] / 255.0; // G
      input[2 * INPUT_SIZE * INPUT_SIZE + dstIdx] = data[srcIdx + 2] / 255.0; // B
    }
  }

  return input;
}

/**
 * Parse YOLO output tensor and apply NMS
 */
function parseYoloOutput(output: ort.Tensor, originalWidth: number, originalHeight: number): YoloDetection[] {
  const outputData = output.data as Float32Array;
  const detections: YoloDetection[] = [];

  // YOLOv11 output format: [batch, 84, 8400]
  // 84 = 4 (box coords) + 80 (class scores)
  const numDetections = 8400;
  const numClasses = 80;

  for (let i = 0; i < numDetections; i++) {
    // Extract box coordinates (center x, center y, width, height)
    const cx = outputData[i];
    const cy = outputData[numDetections + i];
    const w = outputData[2 * numDetections + i];
    const h = outputData[3 * numDetections + i];

    // Find class with highest score
    let maxScore = 0;
    let maxClassId = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = outputData[(4 + c) * numDetections + i];
      if (score > maxScore) {
        maxScore = score;
        maxClassId = c;
      }
    }

    // Filter by confidence threshold
    if (maxScore < CONFIDENCE_THRESHOLD) continue;

    // Convert to corner coordinates and scale to original image
    const scaleX = originalWidth / INPUT_SIZE;
    const scaleY = originalHeight / INPUT_SIZE;

    const x = (cx - w / 2) * scaleX;
    const y = (cy - h / 2) * scaleY;
    const width = w * scaleX;
    const height = h * scaleY;

    detections.push({
      itemType: CLASS_NAMES[maxClassId] || `class_${maxClassId}`,
      confidence: maxScore,
      boundingBox: { x, y, width, height },
      classId: maxClassId
    });
  }

  // Apply Non-Maximum Suppression
  return applyNMS(detections, IOU_THRESHOLD);
}

/**
 * Non-Maximum Suppression to remove duplicate detections
 */
function applyNMS(detections: YoloDetection[], iouThreshold: number): YoloDetection[] {
  // Sort by confidence descending
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const keep: YoloDetection[] = [];

  while (sorted.length > 0) {
    const current = sorted.shift()!;
    keep.push(current);

    // Remove overlapping boxes
    for (let i = sorted.length - 1; i >= 0; i--) {
      const iou = calculateIoU(current.boundingBox, sorted[i].boundingBox);
      if (iou > iouThreshold && current.classId === sorted[i].classId) {
        sorted.splice(i, 1);
      }
    }
  }

  return keep;
}

/**
 * Calculate Intersection over Union for two bounding boxes
 */
function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - intersectionArea;

  return intersectionArea / unionArea;
}

/**
 * Run YOLO inference with timeout
 */
export async function runYoloInference(imageData: ImageData): Promise<YoloInferenceResult> {
  const startTime = Date.now();

  try {
    // Load model (uses cache if available)
    if (!cachedSession) {
      console.log('[YOLO Inference] Loading model...');
      cachedSession = await loadYoloModel();
    }

    // Preprocess image
    const inputTensor = preprocessImage(imageData);
    const tensor = new ort.Tensor('float32', inputTensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);

    // Run inference with timeout
    const inferencePromise = cachedSession.run({ images: tensor });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('YOLO inference timeout')), INFERENCE_TIMEOUT_MS)
    );

    const output = await Promise.race([inferencePromise, timeoutPromise]);

    // Parse results
    const outputTensor = output.output0;
    const detections = parseYoloOutput(outputTensor, imageData.width, imageData.height);

    const processingTime = Date.now() - startTime;
    console.log(`[YOLO Inference] Detected ${detections.length} objects in ${processingTime}ms`);

    return {
      detections,
      processingTimeMs: processingTime,
      inputWidth: imageData.width,
      inputHeight: imageData.height,
      modelInputSize: INPUT_SIZE
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[YOLO Inference] Failed:', error);

    // Return empty result on error
    return {
      detections: [],
      processingTimeMs: processingTime,
      inputWidth: imageData.width,
      inputHeight: imageData.height,
      modelInputSize: INPUT_SIZE
    };
  }
}

/**
 * Clear cached session (for testing)
 */
export function clearSession(): void {
  cachedSession = null;
  console.log('[YOLO Inference] Session cache cleared');
}

/**
 * Get model status
 */
export function getSessionStatus(): { loaded: boolean } {
  return { loaded: cachedSession !== null };
}
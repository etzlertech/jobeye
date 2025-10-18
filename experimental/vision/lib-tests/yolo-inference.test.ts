/**
 * @file /src/domains/vision/lib/__tests__/yolo-inference.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for YOLO inference engine with timeout and NMS
 */

import * as ort from 'onnxruntime-web';
import { runYoloInference, clearSession, getSessionStatus } from '../yolo-inference';
import { loadYoloModel } from '../yolo-loader';

// Mock dependencies
jest.mock('onnxruntime-web');
jest.mock('../yolo-loader');

const mockLoadYoloModel = loadYoloModel as jest.MockedFunction<typeof loadYoloModel>;

describe('YOLO Inference Engine', () => {
  let mockSession: any;
  let mockImageData: ImageData;

  beforeEach(() => {
    jest.clearAllMocks();
    clearSession();

    // Create mock inference session
    mockSession = {
      run: jest.fn(),
      inputNames: ['images'],
      outputNames: ['output0']
    };

    mockLoadYoloModel.mockResolvedValue(mockSession as any);

    // Create mock ImageData (640x480 RGB)
    const width = 640;
    const height = 480;
    const data = new Uint8ClampedArray(width * height * 4);

    // Fill with test pattern (red square in center)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (x >= 270 && x <= 370 && y >= 190 && y <= 290) {
          data[idx] = 255; // R
          data[idx + 1] = 0; // G
          data[idx + 2] = 0; // B
        } else {
          data[idx] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
        }
        data[idx + 3] = 255; // A
      }
    }

    mockImageData = { width, height, data, colorSpace: 'srgb' } as ImageData;
  });

  describe('runYoloInference', () => {
    it('should run inference and return detections', async () => {
      // Mock YOLO output (simplified format)
      const numDetections = 8400;
      const outputData = new Float32Array(84 * numDetections);

      // Add one detection: person at center with high confidence
      const detIdx = 0;
      outputData[detIdx] = 320; // center x
      outputData[numDetections + detIdx] = 240; // center y
      outputData[2 * numDetections + detIdx] = 100; // width
      outputData[3 * numDetections + detIdx] = 150; // height
      outputData[4 * numDetections + detIdx] = 0.85; // person class score (class 0)

      const mockOutput = {
        output0: {
          data: outputData,
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      const result = await runYoloInference(mockImageData);

      expect(result.detections.length).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.inputWidth).toBe(640);
      expect(result.inputHeight).toBe(480);
      expect(result.modelInputSize).toBe(640);

      // Check detection structure
      const detection = result.detections[0];
      expect(detection).toHaveProperty('itemType');
      expect(detection).toHaveProperty('confidence');
      expect(detection).toHaveProperty('boundingBox');
      expect(detection.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('should timeout after 3 seconds', async () => {
      mockSession.run.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );

      const result = await runYoloInference(mockImageData);

      // Should return empty result on timeout
      expect(result.detections).toEqual([]);
      expect(result.processingTimeMs).toBeLessThan(4000);
    });

    it('should handle inference errors gracefully', async () => {
      mockSession.run.mockRejectedValue(new Error('ONNX Runtime error'));

      const result = await runYoloInference(mockImageData);

      expect(result.detections).toEqual([]);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should cache session between calls', async () => {
      const mockOutput = {
        output0: {
          data: new Float32Array(84 * 8400),
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      // First call loads model
      await runYoloInference(mockImageData);
      expect(mockLoadYoloModel).toHaveBeenCalledTimes(1);

      // Second call uses cached session
      await runYoloInference(mockImageData);
      expect(mockLoadYoloModel).toHaveBeenCalledTimes(1);
    });

    it('should filter low confidence detections', async () => {
      const numDetections = 8400;
      const outputData = new Float32Array(84 * numDetections);

      // Add detection with low confidence (should be filtered)
      const detIdx = 0;
      outputData[detIdx] = 320;
      outputData[numDetections + detIdx] = 240;
      outputData[2 * numDetections + detIdx] = 100;
      outputData[3 * numDetections + detIdx] = 150;
      outputData[4 * numDetections + detIdx] = 0.2; // Low confidence

      const mockOutput = {
        output0: {
          data: outputData,
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      const result = await runYoloInference(mockImageData);

      // Should filter out low confidence detection
      expect(result.detections).toEqual([]);
    });

    it('should apply Non-Maximum Suppression to remove duplicates', async () => {
      const numDetections = 8400;
      const outputData = new Float32Array(84 * numDetections);

      // Add two overlapping detections of same class
      // Detection 1: High confidence
      outputData[0] = 320;
      outputData[numDetections] = 240;
      outputData[2 * numDetections] = 100;
      outputData[3 * numDetections] = 150;
      outputData[4 * numDetections] = 0.9;

      // Detection 2: Lower confidence, overlapping
      outputData[1] = 325;
      outputData[numDetections + 1] = 245;
      outputData[2 * numDetections + 1] = 100;
      outputData[3 * numDetections + 1] = 150;
      outputData[4 * numDetections + 1] = 0.7;

      const mockOutput = {
        output0: {
          data: outputData,
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      const result = await runYoloInference(mockImageData);

      // Should keep only highest confidence detection
      expect(result.detections.length).toBe(1);
      expect(result.detections[0].confidence).toBeCloseTo(0.9, 1);
    });
  });

  describe('Session Management', () => {
    it('should report session loaded status', async () => {
      expect(getSessionStatus().loaded).toBe(false);

      const mockOutput = {
        output0: {
          data: new Float32Array(84 * 8400),
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      await runYoloInference(mockImageData);

      expect(getSessionStatus().loaded).toBe(true);
    });

    it('should clear session cache', async () => {
      const mockOutput = {
        output0: {
          data: new Float32Array(84 * 8400),
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      await runYoloInference(mockImageData);
      expect(getSessionStatus().loaded).toBe(true);

      clearSession();
      expect(getSessionStatus().loaded).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should complete inference within 3 seconds', async () => {
      const mockOutput = {
        output0: {
          data: new Float32Array(84 * 8400),
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      const result = await runYoloInference(mockImageData);

      expect(result.processingTimeMs).toBeLessThan(3000);
    });

    it('should log processing time and detection count', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const numDetections = 8400;
      const outputData = new Float32Array(84 * numDetections);
      outputData[0] = 320;
      outputData[numDetections] = 240;
      outputData[2 * numDetections] = 100;
      outputData[3 * numDetections] = 150;
      outputData[4 * numDetections] = 0.9;

      const mockOutput = {
        output0: {
          data: outputData,
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      await runYoloInference(mockImageData);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[YOLO Inference] Detected')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty image', async () => {
      const emptyImageData = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray(4),
        colorSpace: 'srgb'
      } as ImageData;

      const mockOutput = {
        output0: {
          data: new Float32Array(84 * 8400),
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      const result = await runYoloInference(emptyImageData);

      expect(result).toBeDefined();
      expect(result.inputWidth).toBe(1);
      expect(result.inputHeight).toBe(1);
    });

    it('should handle very large images', async () => {
      const largeImageData = {
        width: 4096,
        height: 3072,
        data: new Uint8ClampedArray(4096 * 3072 * 4),
        colorSpace: 'srgb'
      } as ImageData;

      const mockOutput = {
        output0: {
          data: new Float32Array(84 * 8400),
          dims: [1, 84, 8400],
          type: 'float32'
        } as ort.Tensor
      };

      mockSession.run.mockResolvedValue(mockOutput);

      const result = await runYoloInference(largeImageData);

      expect(result).toBeDefined();
      expect(result.inputWidth).toBe(4096);
      expect(result.inputHeight).toBe(3072);
    });
  });
});
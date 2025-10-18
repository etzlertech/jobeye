/**
 * @file /src/domains/vision/lib/__tests__/yolo-loader.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for YOLO model loader with IndexedDB caching
 */

import * as ort from 'onnxruntime-web';
import { loadYoloModel, isModelCached, clearModelCache } from '../yolo-loader';

// Mock onnxruntime-web
jest.mock('onnxruntime-web', () => ({
  InferenceSession: {
    create: jest.fn()
  },
  Tensor: jest.fn()
}));

// Mock IndexedDB
let mockStore: Record<string, any> = {};

const createMockRequest = (result?: any) => {
  const request = {
    result,
    error: null,
    onsuccess: null as any,
    onerror: null as any
  };

  // Trigger success asynchronously
  setTimeout(() => {
    if (request.onsuccess) {
      request.onsuccess({ target: request } as any);
    }
  }, 0);

  return request;
};

const mockIndexedDB = {
  open: jest.fn((dbName: string, version: number) => {
    const db = {
      transaction: jest.fn((storeName: string, mode: string) => ({
        objectStore: jest.fn(() => ({
          get: jest.fn((key: string) => createMockRequest(mockStore[key])),
          put: jest.fn((value: any, key: string) => {
            mockStore[key] = value;
            return createMockRequest();
          }),
          delete: jest.fn((key: string) => {
            delete mockStore[key];
            return createMockRequest();
          })
        }))
      })),
      objectStoreNames: {
        contains: jest.fn(() => true)
      }
    };

    const request = {
      result: db,
      error: null,
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any
    };

    // Trigger success asynchronously
    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess({ target: request } as any);
      }
    }, 0);

    return request;
  })
};

// Mock fetch
global.fetch = jest.fn();

// Mock global IndexedDB
(global as any).indexedDB = mockIndexedDB;

describe('YOLO Model Loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};
    (global.fetch as jest.Mock).mockReset();
  });

  describe('loadYoloModel', () => {
    it('should download and cache model on first load', async () => {
      const mockModelData = new ArrayBuffer(1024);
      const mockSession = { inputNames: ['images'], outputNames: ['output0'] };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockModelData)
      });

      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);

      const session = await loadYoloModel();

      expect(session).toBe(mockSession);
      expect(global.fetch).toHaveBeenCalledWith('/models/yolov11n.onnx');
      expect(ort.InferenceSession.create).toHaveBeenCalledWith(
        mockModelData,
        expect.objectContaining({
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all'
        })
      );
    });

    it('should use cached model on subsequent loads', async () => {
      const mockModelData = new ArrayBuffer(1024);
      const cachedModel = {
        version: 1,
        data: mockModelData,
        timestamp: Date.now()
      };

      // Pre-populate cache
      mockStore['yolov11n-model'] = cachedModel;

      const mockSession = { inputNames: ['images'], outputNames: ['output0'] };
      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);

      const session = await loadYoloModel();

      expect(session).toBe(mockSession);
      expect(global.fetch).not.toHaveBeenCalled(); // Should use cache
      expect(ort.InferenceSession.create).toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(loadYoloModel()).rejects.toThrow('YOLO model loading failed');
    });

    it('should handle ONNX session creation errors', async () => {
      const mockModelData = new ArrayBuffer(1024);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockModelData)
      });

      (ort.InferenceSession.create as jest.Mock).mockRejectedValue(
        new Error('Invalid ONNX model')
      );

      await expect(loadYoloModel()).rejects.toThrow('YOLO model loading failed');
    });
  });

  describe('isModelCached', () => {
    it('should return false when model is not cached', async () => {
      const cached = await isModelCached();
      expect(cached).toBe(false);
    });

    it('should return true when model is cached', async () => {
      const mockModelData = new ArrayBuffer(1024);
      const cachedModel = {
        version: 1,
        data: mockModelData,
        timestamp: Date.now()
      };

      // Populate cache
      mockStore['yolov11n-model'] = cachedModel;

      const cached = await isModelCached();
      expect(cached).toBe(true);
    });
  });

  describe('clearModelCache', () => {
    it('should clear the cached model', async () => {
      const mockModelData = new ArrayBuffer(1024);
      const cachedModel = {
        version: 1,
        data: mockModelData,
        timestamp: Date.now()
      };

      // Populate cache
      mockStore['yolov11n-model'] = cachedModel;

      expect(await isModelCached()).toBe(true);

      await clearModelCache();

      expect(await isModelCached()).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should load model within reasonable time', async () => {
      const mockModelData = new ArrayBuffer(5 * 1024 * 1024); // 5MB
      const mockSession = { inputNames: ['images'], outputNames: ['output0'] };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockModelData)
      });

      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);

      const startTime = Date.now();
      await loadYoloModel();
      const loadTime = Date.now() - startTime;

      // Should complete within 10 seconds (generous for CI environments)
      expect(loadTime).toBeLessThan(10000);
    }, 15000); // Increase timeout to 15s

    it('should log model size and load time', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockModelData = new ArrayBuffer(5 * 1024 * 1024);
      const mockSession = { inputNames: ['images'], outputNames: ['output0'] };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockModelData)
      });

      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);

      await loadYoloModel();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[YOLO Loader] Downloaded')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[YOLO Loader] Model loaded in')
      );

      consoleSpy.mockRestore();
    }, 15000); // Increase timeout to 15s
  });
});
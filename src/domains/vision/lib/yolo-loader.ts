/**
 * @file /src/domains/vision/lib/yolo-loader.ts
 * @phase 3.4
 * @domain Vision
 * @purpose YOLO model loader with IndexedDB caching for offline capability
 * @complexity_budget 300
 * @test_coverage ≥80%
 * @dependencies onnxruntime-web
 */

import * as ort from 'onnxruntime-web';

const MODEL_URL = '/models/yolov11n.onnx';
const MODEL_CACHE_KEY = 'yolov11n-model';
const CACHE_VERSION = 1;
const DB_NAME = 'vision-models';
const STORE_NAME = 'models';

interface CachedModel {
  version: number;
  data: ArrayBuffer;
  timestamp: number;
}

/**
 * Open IndexedDB for model caching
 */
async function openModelCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, CACHE_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Get cached model from IndexedDB
 */
async function getCachedModel(): Promise<ArrayBuffer | null> {
  try {
    const db = await openModelCache();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(MODEL_CACHE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cached = request.result as CachedModel | undefined;
        if (cached && cached.version === CACHE_VERSION) {
          console.log(`[YOLO Loader] Using cached model (${(cached.data.byteLength / 1024 / 1024).toFixed(2)}MB)`);
          resolve(cached.data);
        } else {
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.warn('[YOLO Loader] Failed to read from cache:', error);
    return null;
  }
}

/**
 * Cache model in IndexedDB
 */
async function cacheModel(data: ArrayBuffer): Promise<void> {
  try {
    const db = await openModelCache();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const cached: CachedModel = {
        version: CACHE_VERSION,
        data,
        timestamp: Date.now()
      };

      const request = store.put(cached, MODEL_CACHE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log(`[YOLO Loader] Cached model (${(data.byteLength / 1024 / 1024).toFixed(2)}MB)`);
        resolve();
      };
    });
  } catch (error) {
    console.warn('[YOLO Loader] Failed to cache model:', error);
  }
}

/**
 * Download model from server
 */
async function downloadModel(): Promise<ArrayBuffer> {
  console.log(`[YOLO Loader] Downloading model from ${MODEL_URL}...`);

  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
  }

  const data = await response.arrayBuffer();
  console.log(`[YOLO Loader] Downloaded ${(data.byteLength / 1024 / 1024).toFixed(2)}MB`);

  // Cache for future use
  await cacheModel(data);

  return data;
}

/**
 * Load YOLO model with caching
 * @returns ONNX Runtime inference session
 */
export async function loadYoloModel(): Promise<ort.InferenceSession> {
  const startTime = Date.now();

  try {
    // Try to load from cache first
    let modelData = await getCachedModel();

    // Download if not cached
    if (!modelData) {
      modelData = await downloadModel();
    }

    // Create inference session
    console.log('[YOLO Loader] Creating inference session...');
    const session = await ort.InferenceSession.create(modelData, {
      executionProviders: ['wasm'], // WebAssembly for browser
      graphOptimizationLevel: 'all'
    });

    const loadTime = Date.now() - startTime;
    console.log(`[YOLO Loader] Model loaded in ${loadTime}ms`);

    return session;
  } catch (error) {
    console.error('[YOLO Loader] Failed to load model:', error);
    throw new Error(`YOLO model loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if model is cached
 */
export async function isModelCached(): Promise<boolean> {
  const cached = await getCachedModel();
  return cached !== null;
}

/**
 * Clear cached model (for testing/debugging)
 */
export async function clearModelCache(): Promise<void> {
  try {
    const db = await openModelCache();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(MODEL_CACHE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[YOLO Loader] Cache cleared');
        resolve();
      };
    });
  } catch (error) {
    console.warn('[YOLO Loader] Failed to clear cache:', error);
  }
}

/**
 * Get model info
 */
export async function getModelInfo(session: ort.InferenceSession) {
  const inputNames = session.inputNames;
  const outputNames = session.outputNames;

  return {
    inputNames,
    outputNames,
    inputShape: session.inputNames.length > 0
      ? (session as any).handler?.session?.inputNames?.[0]
      : null
  };
}
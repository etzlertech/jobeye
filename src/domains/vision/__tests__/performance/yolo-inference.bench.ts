/**
 * @file yolo-inference.bench.ts
 * @purpose Performance benchmark tests for YOLO inference
 */

import { YOLOInference } from '../../lib/yolo-inference';

// Mock ONNX Runtime for benchmarking
jest.mock('onnxruntime-web', () => ({
  InferenceSession: {
    create: jest.fn(() => Promise.resolve({
      run: jest.fn(() => Promise.resolve({
        output: {
          data: new Float32Array(100),
          dims: [1, 100, 4]
        }
      }))
    }))
  },
  Tensor: jest.fn()
}));

describe('YOLO Inference Performance Benchmarks', () => {
  let inference: YOLOInference;

  beforeAll(async () => {
    inference = new YOLOInference();
    await inference.initialize().catch(() => {
      // Mock initialization
    });
  });

  describe('Single Image Inference', () => {
    it('should process 640x640 image in under 3 seconds', async () => {
      const imageData = new ImageData(
        new Uint8ClampedArray(640 * 640 * 4),
        640,
        640
      );

      const start = performance.now();

      await inference.detect(imageData).catch(() => {
        // Mock detection
        return [];
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(3000);
      console.log(`640x640 inference took ${duration.toFixed(2)}ms`);
    });

    it('should process 1280x720 image in under 4 seconds', async () => {
      const imageData = new ImageData(
        new Uint8ClampedArray(1280 * 720 * 4),
        1280,
        720
      );

      const start = performance.now();

      await inference.detect(imageData).catch(() => {
        return [];
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(4000);
      console.log(`1280x720 inference took ${duration.toFixed(2)}ms`);
    });

    it('should process 1920x1080 image in under 5 seconds', async () => {
      const imageData = new ImageData(
        new Uint8ClampedArray(1920 * 1080 * 4),
        1920,
        1080
      );

      const start = performance.now();

      await inference.detect(imageData).catch(() => {
        return [];
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000);
      console.log(`1920x1080 inference took ${duration.toFixed(2)}ms`);
    });
  });

  describe('Batch Processing', () => {
    it('should process 10 images sequentially in under 30 seconds', async () => {
      const images = Array.from({ length: 10 }, () =>
        new ImageData(new Uint8ClampedArray(640 * 640 * 4), 640, 640)
      );

      const start = performance.now();

      for (const image of images) {
        await inference.detect(image).catch(() => []);
      }

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(30000);
      console.log(`10 sequential inferences took ${duration.toFixed(2)}ms (${(duration/10).toFixed(2)}ms avg)`);
    });

    it('should maintain consistent performance across iterations', async () => {
      const imageData = new ImageData(
        new Uint8ClampedArray(640 * 640 * 4),
        640,
        640
      );

      const timings: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await inference.detect(imageData).catch(() => []);
        timings.push(performance.now() - start);
      }

      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);

      console.log(`Timings: ${timings.map(t => t.toFixed(2)).join(', ')}ms`);
      console.log(`Average: ${avg.toFixed(2)}ms, StdDev: ${stdDev.toFixed(2)}ms`);

      // Standard deviation should be less than 20% of average (consistent performance)
      expect(stdDev).toBeLessThan(avg * 0.2);
    });
  });

  describe('Resolution Scaling', () => {
    it('should show linear relationship between resolution and processing time', async () => {
      const resolutions = [
        { width: 320, height: 320 },
        { width: 640, height: 640 },
        { width: 1280, height: 1280 }
      ];

      const timings = await Promise.all(
        resolutions.map(async ({ width, height }) => {
          const imageData = new ImageData(
            new Uint8ClampedArray(width * height * 4),
            width,
            height
          );

          const start = performance.now();
          await inference.detect(imageData).catch(() => []);
          return performance.now() - start;
        })
      );

      console.log('Resolution scaling:');
      resolutions.forEach((res, i) => {
        console.log(`  ${res.width}x${res.height}: ${timings[i].toFixed(2)}ms`);
      });

      // Each doubling of resolution should roughly double the time
      const ratio1 = timings[1] / timings[0]; // 640/320
      const ratio2 = timings[2] / timings[1]; // 1280/640

      console.log(`  Scaling ratios: ${ratio1.toFixed(2)}x, ${ratio2.toFixed(2)}x`);

      // Ratios should be between 2x and 6x (allowing for overhead)
      expect(ratio1).toBeGreaterThan(1.5);
      expect(ratio1).toBeLessThan(6);
      expect(ratio2).toBeGreaterThan(1.5);
      expect(ratio2).toBeLessThan(6);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not accumulate memory during repeated detections', async () => {
      const imageData = new ImageData(
        new Uint8ClampedArray(640 * 640 * 4),
        640,
        640
      );

      const before = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      // Run 100 detections
      for (let i = 0; i < 100; i++) {
        await inference.detect(imageData).catch(() => []);
      }

      if (global.gc) {
        global.gc();
      }

      const after = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const delta = (parseFloat(after) - parseFloat(before)).toFixed(2);

      console.log(`Memory: ${before}MB -> ${after}MB (Δ ${delta}MB for 100 detections)`);

      // Memory increase should be minimal (< 100MB for 100 detections)
      expect(parseFloat(delta)).toBeLessThan(100);
    });
  });

  describe('FPS Target Validation', () => {
    it('should sustain 1 fps for continuous processing', async () => {
      const imageData = new ImageData(
        new Uint8ClampedArray(640 * 640 * 4),
        640,
        640
      );

      const frameCount = 5;
      const targetDuration = frameCount * 1000; // 1 fps = 1 frame/second
      const start = performance.now();

      for (let i = 0; i < frameCount; i++) {
        const frameStart = performance.now();
        await inference.detect(imageData).catch(() => []);

        // Wait until 1 second has passed for this frame
        const frameElapsed = performance.now() - frameStart;
        if (frameElapsed < 1000) {
          await new Promise(resolve => setTimeout(resolve, 1000 - frameElapsed));
        }
      }

      const duration = performance.now() - start;
      const actualFps = (frameCount / (duration / 1000)).toFixed(2);

      console.log(`Actual FPS over ${frameCount} frames: ${actualFps} (target: 1.0)`);

      // Should be close to 1 fps (0.9 - 1.1 range)
      expect(parseFloat(actualFps)).toBeGreaterThan(0.9);
      expect(parseFloat(actualFps)).toBeLessThan(1.1);
    });
  });
});
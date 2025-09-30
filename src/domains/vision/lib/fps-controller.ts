/**
 * @file /src/domains/vision/lib/fps-controller.ts
 * @phase 3.4
 * @domain Vision
 * @purpose FPS throttle controller for 1 fps continuous camera capture
 * @complexity_budget 200
 * @test_coverage ≥80%
 * @dependencies none
 */

const TARGET_FPS = 1;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // 1000ms for 1 fps

export interface FrameCallback {
  (imageData: ImageData, timestamp: number): void | Promise<void>;
}

export interface FpsControllerOptions {
  fps?: number;
  onFrame: FrameCallback;
  onError?: (error: Error) => void;
}

export interface FpsStats {
  actualFps: number;
  frameCount: number;
  droppedFrames: number;
  averageProcessingTime: number;
}

/**
 * FPS throttle controller for continuous camera capture
 * Ensures exactly 1 fps capture rate regardless of camera/processing speed
 */
export class FpsController {
  private readonly targetFps: number;
  private readonly frameIntervalMs: number;
  private readonly onFrame: FrameCallback;
  private readonly onError?: (error: Error) => void;

  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private isRunning = false;
  private animationFrameId: number | null = null;
  private lastCaptureTime = 0;
  private frameCount = 0;
  private droppedFrames = 0;
  private totalProcessingTime = 0;
  private startTime = 0;

  constructor(options: FpsControllerOptions) {
    this.targetFps = options.fps ?? TARGET_FPS;
    this.frameIntervalMs = 1000 / this.targetFps;
    this.onFrame = options.onFrame;
    this.onError = options.onError;
  }

  /**
   * Start capturing frames from video element
   */
  async start(videoElement: HTMLVideoElement): Promise<void> {
    if (this.isRunning) {
      console.warn('[FPS Controller] Already running');
      return;
    }

    this.videoElement = videoElement;

    // Create canvas for frame extraction
    this.canvas = document.createElement('canvas');
    this.canvas.width = videoElement.videoWidth || 640;
    this.canvas.height = videoElement.videoHeight || 480;
    this.ctx = this.canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false
    });

    if (!this.ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    this.isRunning = true;
    this.lastCaptureTime = 0;
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.totalProcessingTime = 0;
    this.startTime = performance.now();

    console.log(`[FPS Controller] Started at ${this.targetFps} fps`);

    this.captureLoop();
  }

  /**
   * Stop capturing frames
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const stats = this.getStats();
    console.log(`[FPS Controller] Stopped - ${stats.frameCount} frames captured, ${stats.droppedFrames} dropped, ${stats.actualFps.toFixed(2)} fps average`);

    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Main capture loop using requestAnimationFrame
   */
  private captureLoop = (): void => {
    if (!this.isRunning) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => {
      const now = performance.now();
      const timeSinceLastCapture = now - this.lastCaptureTime;

      // Only capture if enough time has passed
      if (timeSinceLastCapture >= this.frameIntervalMs) {
        this.captureFrame(now);
        this.lastCaptureTime = now;
      } else {
        // Too soon, skip this frame
        this.droppedFrames++;
      }

      // Continue loop
      this.captureLoop();
    });
  };

  /**
   * Capture and process a single frame
   */
  private async captureFrame(timestamp: number): Promise<void> {
    if (!this.videoElement || !this.canvas || !this.ctx) {
      return;
    }

    try {
      const processStart = performance.now();

      // Draw current video frame to canvas
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

      // Extract ImageData
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // Call user callback
      await this.onFrame(imageData, timestamp);

      const processingTime = performance.now() - processStart;
      this.totalProcessingTime += processingTime;
      this.frameCount++;

      // Warn if processing is too slow
      if (processingTime > this.frameIntervalMs * 0.8) {
        console.warn(`[FPS Controller] Frame processing (${processingTime.toFixed(0)}ms) approaching interval limit (${this.frameIntervalMs}ms)`);
      }
    } catch (error) {
      console.error('[FPS Controller] Frame capture failed:', error);
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Get current FPS statistics
   */
  getStats(): FpsStats {
    const elapsedTime = (performance.now() - this.startTime) / 1000; // seconds
    const actualFps = elapsedTime > 0 ? this.frameCount / elapsedTime : 0;
    const avgProcessingTime = this.frameCount > 0 ? this.totalProcessingTime / this.frameCount : 0;

    return {
      actualFps,
      frameCount: this.frameCount,
      droppedFrames: this.droppedFrames,
      averageProcessingTime: avgProcessingTime
    };
  }

  /**
   * Check if controller is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Update canvas size (call if video dimensions change)
   */
  updateCanvasSize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
      console.log(`[FPS Controller] Canvas resized to ${width}x${height}`);
    }
  }
}

/**
 * Create and start FPS controller
 */
export async function createFpsController(
  videoElement: HTMLVideoElement,
  options: FpsControllerOptions
): Promise<FpsController> {
  const controller = new FpsController(options);
  await controller.start(videoElement);
  return controller;
}
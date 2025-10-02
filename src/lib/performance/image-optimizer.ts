/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/performance/image-optimizer.ts
 * phase: 3
 * domain: performance
 * purpose: Image optimization and compression for mobile performance
 * spec_ref: 007-mvp-intent-driven/contracts/image-optimizer.md
 * complexity_budget: 250
 * migrations_touched: []
 * state_machine: {
 *   states: ['idle', 'processing', 'optimized', 'error'],
 *   transitions: [
 *     'idle->processing: startOptimization()',
 *     'processing->optimized: optimizationComplete()',
 *     'processing->error: optimizationFailed()',
 *     'optimized->idle: reset()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "imageOptimizer": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/performance/cache-manager',
 *     '@/core/logger/voice-logger'
 *   ],
 *   external: [],
 *   supabase: []
 * }
 * exports: ['ImageOptimizer', 'OptimizationConfig', 'OptimizationResult']
 * voice_considerations: Optimize images for voice-guided workflows
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/lib/performance/image-optimizer.test.ts'
 * }
 * tasks: [
 *   'Implement client-side image compression',
 *   'Create thumbnail generation',
 *   'Add progressive loading support',
 *   'Optimize for mobile performance'
 * ]
 */

import { cacheManager } from './cache-manager';
import { voiceLogger } from '@/core/logger/voice-logger';

export interface OptimizationConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'webp' | 'png';
  thumbnailSize: number;
  progressive: boolean;
  preserveExif: boolean;
}

export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  optimizedBlob: Blob;
  thumbnailBlob?: Blob;
  dimensions: {
    width: number;
    height: number;
  };
  processingTime: number;
}

export class ImageOptimizer {
  private static instance: ImageOptimizer;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private readonly DEFAULT_CONFIG: OptimizationConfig = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    format: 'jpeg',
    thumbnailSize: 512,
    progressive: true,
    preserveExif: false
  };

  private readonly THUMBNAIL_CONFIG: OptimizationConfig = {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.7,
    format: 'jpeg',
    thumbnailSize: 128,
    progressive: false,
    preserveExif: false
  };

  private constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }
    this.ctx = ctx;
  }

  static getInstance(): ImageOptimizer {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer();
    }
    return ImageOptimizer.instance;
  }

  async optimizeImage(
    file: File | Blob,
    config: Partial<OptimizationConfig> = {}
  ): Promise<OptimizationResult> {
    const startTime = performance.now();
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };

    try {
      voiceLogger.debug('Starting image optimization', {
        originalSize: file.size,
        config: fullConfig
      });

      // Check cache first
      const cacheKey = await this.generateCacheKey(file, fullConfig);
      const cached = await cacheManager.get<OptimizationResult>(cacheKey, 'image');
      
      if (cached) {
        voiceLogger.debug('Image optimization cache hit', { cacheKey });
        return cached;
      }

      // Load image
      const img = await this.loadImage(file);
      
      // Calculate target dimensions
      const { width, height } = this.calculateDimensions(
        img.width,
        img.height,
        fullConfig.maxWidth,
        fullConfig.maxHeight
      );

      // Optimize main image
      const optimizedBlob = await this.resizeAndCompress(
        img,
        width,
        height,
        fullConfig
      );

      // Generate thumbnail if requested
      let thumbnailBlob: Blob | undefined;
      if (fullConfig.thumbnailSize > 0) {
        const thumbConfig = {
          ...this.THUMBNAIL_CONFIG,
          maxWidth: fullConfig.thumbnailSize,
          maxHeight: fullConfig.thumbnailSize
        };
        
        const { width: thumbWidth, height: thumbHeight } = this.calculateDimensions(
          img.width,
          img.height,
          thumbConfig.maxWidth,
          thumbConfig.maxHeight
        );

        thumbnailBlob = await this.resizeAndCompress(
          img,
          thumbWidth,
          thumbHeight,
          thumbConfig
        );
      }

      const processingTime = performance.now() - startTime;
      const result: OptimizationResult = {
        originalSize: file.size,
        optimizedSize: optimizedBlob.size,
        compressionRatio: (file.size - optimizedBlob.size) / file.size,
        optimizedBlob,
        thumbnailBlob,
        dimensions: { width, height },
        processingTime
      };

      // Cache the result
      await cacheManager.set(cacheKey, result, 'image', {
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        priority: 'medium',
        persistent: true
      });

      voiceLogger.debug('Image optimization completed', {
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        compressionRatio: result.compressionRatio,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      voiceLogger.error('Image optimization failed', { error });
      throw new Error(`Image optimization failed: ${error}`);
    }
  }

  async generateProgressiveImage(
    file: File | Blob,
    sizes: number[] = [256, 512, 1024]
  ): Promise<Map<number, Blob>> {
    const results = new Map<number, Blob>();

    try {
      const img = await this.loadImage(file);

      for (const size of sizes.sort((a, b) => a - b)) {
        const { width, height } = this.calculateDimensions(
          img.width,
          img.height,
          size,
          size
        );

        const config: OptimizationConfig = {
          ...this.DEFAULT_CONFIG,
          maxWidth: width,
          maxHeight: height,
          quality: size <= 256 ? 0.6 : size <= 512 ? 0.7 : 0.8
        };

        const blob = await this.resizeAndCompress(img, width, height, config);
        results.set(size, blob);
      }

      voiceLogger.debug('Progressive images generated', {
        sizes: Array.from(results.keys())
      });

      return results;

    } catch (error) {
      voiceLogger.error('Progressive image generation failed', { error });
      throw error;
    }
  }

  async createThumbnail(
    file: File | Blob,
    size: number = 512
  ): Promise<Blob> {
    try {
      const img = await this.loadImage(file);
      const { width, height } = this.calculateDimensions(img.width, img.height, size, size);

      const thumbnailBlob = await this.resizeAndCompress(
        img,
        width,
        height,
        this.THUMBNAIL_CONFIG
      );

      voiceLogger.debug('Thumbnail created', {
        originalSize: file.size,
        thumbnailSize: thumbnailBlob.size,
        dimensions: { width, height }
      });

      return thumbnailBlob;

    } catch (error) {
      voiceLogger.error('Thumbnail creation failed', { error });
      throw error;
    }
  }

  async batchOptimize(
    files: (File | Blob)[],
    config: Partial<OptimizationConfig> = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.optimizeImage(files[i], config);
        results.push(result);
        
        if (onProgress) {
          onProgress(i + 1, files.length);
        }
      } catch (error) {
        voiceLogger.error(`Batch optimization failed for file ${i}`, { error });
        // Continue with other files
      }
    }

    voiceLogger.info('Batch optimization completed', {
      total: files.length,
      successful: results.length,
      failed: files.length - results.length
    });

    return results;
  }

  private async loadImage(file: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    // Scale down if necessary
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  private async resizeAndCompress(
    img: HTMLImageElement,
    width: number,
    height: number,
    config: OptimizationConfig
  ): Promise<Blob> {
    // Set canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // Enable smoothing for better quality
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Draw resized image
    this.ctx.drawImage(img, 0, 0, width, height);

    // Convert to blob with compression
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        this.getMimeType(config.format),
        config.quality
      );
    });
  }

  private getMimeType(format: OptimizationConfig['format']): string {
    switch (format) {
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      case 'png':
        return 'image/png';
      default:
        return 'image/jpeg';
    }
  }

  private async generateCacheKey(
    file: File | Blob,
    config: OptimizationConfig
  ): Promise<string> {
    const configHash = btoa(JSON.stringify(config)).replace(/[^a-zA-Z0-9]/g, '');
    const fileSize = file.size;
    const lastModified = file instanceof File ? file.lastModified : Date.now();
    
    return `image:${fileSize}:${lastModified}:${configHash}`;
  }

  // Utility methods for progressive loading
  async generatePlaceholder(
    file: File | Blob,
    size: number = 64
  ): Promise<string> {
    try {
      const img = await this.loadImage(file);
      const { width, height } = this.calculateDimensions(img.width, img.height, size, size);

      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.clearRect(0, 0, width, height);
      this.ctx.drawImage(img, 0, 0, width, height);

      // Apply blur effect for placeholder
      this.ctx.filter = 'blur(2px)';
      this.ctx.drawImage(this.canvas, 0, 0);
      this.ctx.filter = 'none';

      return this.canvas.toDataURL('image/jpeg', 0.4);

    } catch (error) {
      voiceLogger.error('Placeholder generation failed', { error });
      throw error;
    }
  }

  getOptimizationRecommendations(
    file: File | Blob,
    targetSize?: number
  ): Partial<OptimizationConfig> {
    const size = file.size;
    const recommendations: Partial<OptimizationConfig> = {};

    // Size-based recommendations
    if (size > 5 * 1024 * 1024) { // > 5MB
      recommendations.maxWidth = 1280;
      recommendations.maxHeight = 720;
      recommendations.quality = 0.7;
    } else if (size > 2 * 1024 * 1024) { // > 2MB
      recommendations.maxWidth = 1600;
      recommendations.maxHeight = 900;
      recommendations.quality = 0.75;
    } else {
      recommendations.quality = 0.8;
    }

    // Target size recommendations
    if (targetSize) {
      const compressionNeeded = size / targetSize;
      if (compressionNeeded > 4) {
        recommendations.quality = 0.6;
        recommendations.maxWidth = 1024;
        recommendations.maxHeight = 768;
      } else if (compressionNeeded > 2) {
        recommendations.quality = 0.7;
      }
    }

    // Format recommendations
    if (file.type === 'image/png' && size > 1024 * 1024) {
      recommendations.format = 'jpeg'; // PNG to JPEG for large files
    }

    return recommendations;
  }

  // Memory management
  dispose(): void {
    // Clean up canvas resources
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.ctx.clearRect(0, 0, 1, 1);
  }
}

// Export singleton instance
export const imageOptimizer = ImageOptimizer.getInstance();
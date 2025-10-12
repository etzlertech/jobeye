/**
 * Enhanced image processor for creating multiple sized versions
 * with compression targeting specific file sizes
 */

export interface ProcessedImages {
  thumbnail: string;  // 32x32 ~5KB
  medium: string;     // 256x256 ~50KB
  full: string;       // 1024x1024 ~500KB max
}

export interface ImageProcessorOptions {
  maxFullSize?: number;      // Max dimension for full image (default 1024)
  targetFullSizeKB?: number; // Target KB for full image (default 500)
  thumbnailSize?: number;    // Thumbnail dimension (default 32)
  mediumSize?: number;       // Medium dimension (default 256)
}

export class ItemImageProcessor {
  private options: Required<ImageProcessorOptions>;

  constructor(options: ImageProcessorOptions = {}) {
    this.options = {
      maxFullSize: options.maxFullSize || 1024,
      targetFullSizeKB: options.targetFullSizeKB || 500,
      thumbnailSize: options.thumbnailSize || 32,
      mediumSize: options.mediumSize || 256,
    };
  }

  /**
   * Process image from data URL or blob to create three sizes
   */
  async processImage(
    source: string | Blob | File
  ): Promise<ProcessedImages> {
    // Convert source to Image element
    const img = await this.loadImage(source);
    
    // Create three versions
    const [thumbnail, medium, full] = await Promise.all([
      this.createThumbnail(img),
      this.createMedium(img),
      this.createFull(img),
    ]);

    return { thumbnail, medium, full };
  }

  /**
   * Load image from various sources
   */
  private async loadImage(source: string | Blob | File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));

      if (typeof source === 'string') {
        img.src = source;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(source);
      }
    });
  }

  /**
   * Create thumbnail version (32x32)
   */
  private async createThumbnail(img: HTMLImageElement): Promise<string> {
    const size = this.options.thumbnailSize;
    const canvas = this.createSquareCanvas(img, size);
    
    // For tiny thumbnails, use lower quality
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  /**
   * Create medium version (256x256)
   */
  private async createMedium(img: HTMLImageElement): Promise<string> {
    const size = this.options.mediumSize;
    const canvas = this.createSquareCanvas(img, size);
    
    // Medium quality for preview images
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  /**
   * Create full version with target file size
   */
  private async createFull(img: HTMLImageElement): Promise<string> {
    const maxSize = this.options.maxFullSize;
    const targetKB = this.options.targetFullSizeKB;
    
    // Create initial canvas at max resolution
    const canvas = this.createSquareCanvas(img, maxSize);
    
    // Try different quality levels to achieve target size
    let quality = 0.9;
    let dataUrl = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      const sizeKB = this.getDataUrlSizeKB(dataUrl);
      
      if (sizeKB <= targetKB) {
        break;
      }
      
      // Reduce quality or size
      if (quality > 0.3) {
        quality -= 0.1;
      } else {
        // If quality is too low, reduce canvas size
        const newSize = Math.floor(canvas.width * 0.8);
        if (newSize < 512) break; // Don't go below 512px
        
        const newCanvas = this.createSquareCanvas(img, newSize);
        canvas.width = newCanvas.width;
        canvas.height = newCanvas.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(newCanvas, 0, 0);
        }
        quality = 0.8; // Reset quality for new size
      }
      
      attempts++;
    }
    
    return dataUrl;
  }

  /**
   * Create a square canvas with centered crop
   */
  private createSquareCanvas(
    img: HTMLImageElement, 
    targetSize: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Calculate crop dimensions
    const sourceSize = Math.min(img.width, img.height);
    const sourceX = (img.width - sourceSize) / 2;
    const sourceY = (img.height - sourceSize) / 2;

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw cropped and scaled image
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,  // Source rectangle
      0, 0, targetSize, targetSize                // Destination rectangle
    );

    return canvas;
  }

  /**
   * Calculate data URL size in KB
   */
  private getDataUrlSizeKB(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1];
    const padding = (base64.match(/=/g) || []).length;
    const base64Length = base64.length;
    const fileSize = base64Length * 0.75 - padding;
    return fileSize / 1024;
  }

  /**
   * Convert data URL to Blob
   */
  static dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  }
}

// Export singleton instance
export const imageProcessor = new ItemImageProcessor();
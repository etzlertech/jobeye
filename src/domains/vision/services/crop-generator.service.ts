/**
 * @file /src/domains/vision/services/crop-generator.service.ts
 * @phase 3.5
 * @domain Vision
 * @purpose Canvas-based image cropping for detected items
 * @complexity_budget 200
 * @feature 004-voice-vision-inventory
 *
 * Client-side crop generation using Canvas API
 * Performance: <100ms per crop
 * No server costs (fully client-side)
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropOptions {
  padding?: number; // Extra pixels around bbox (default: 10)
  maxWidth?: number; // Max width (default: 800)
  maxHeight?: number; // Max height (default: 800)
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number; // JPEG quality 0-1 (default: 0.9)
}

export interface CropResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalBbox: BoundingBox;
  croppedBbox: BoundingBox;
}

/**
 * Generate crop from image using bounding box
 */
export async function generateCrop(
  imageSource: HTMLImageElement | HTMLCanvasElement | File | Blob | string,
  bbox: BoundingBox,
  options: CropOptions = {}
): Promise<{ data: CropResult | null; error: Error | null }> {
  try {
    const {
      padding = 10,
      maxWidth = 800,
      maxHeight = 800,
      format = 'image/jpeg',
      quality = 0.9,
    } = options;

    // Step 1: Load image into HTMLImageElement
    const img = await loadImage(imageSource);

    // Step 2: Calculate crop bounds with padding
    const croppedBbox = calculateCropBounds(bbox, img.width, img.height, padding);

    // Step 3: Scale if necessary
    let targetWidth = croppedBbox.width;
    let targetHeight = croppedBbox.height;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const scale = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    // Step 4: Create canvas and draw cropped region
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        data: null,
        error: new Error('Failed to get canvas context'),
      };
    }

    ctx.drawImage(
      img,
      croppedBbox.x,
      croppedBbox.y,
      croppedBbox.width,
      croppedBbox.height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // Step 5: Convert to blob and data URL
    const blob = await canvasToBlob(canvas, format, quality);
    const dataUrl = canvas.toDataURL(format, quality);

    return {
      data: {
        blob,
        dataUrl,
        width: targetWidth,
        height: targetHeight,
        originalBbox: bbox,
        croppedBbox,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`Crop generation failed: ${err.message}`),
    };
  }
}

/**
 * Generate multiple crops in parallel
 */
export async function generateCrops(
  imageSource: HTMLImageElement | HTMLCanvasElement | File | Blob | string,
  bboxes: BoundingBox[],
  options: CropOptions = {}
): Promise<{ data: CropResult[]; errors: (Error | null)[] }> {
  const results = await Promise.all(
    bboxes.map((bbox) => generateCrop(imageSource, bbox, options))
  );

  return {
    data: results.map((r) => r.data).filter(Boolean) as CropResult[],
    errors: results.map((r) => r.error),
  };
}

/**
 * Load image from various sources
 */
async function loadImage(
  source: HTMLImageElement | HTMLCanvasElement | File | Blob | string
): Promise<HTMLImageElement> {
  if (source instanceof HTMLImageElement) {
    return source;
  }

  if (source instanceof HTMLCanvasElement) {
    const img = new Image();
    img.src = source.toDataURL();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    return img;
  }

  // File, Blob, or string URL
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const img = new Image();
  img.src = url;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // Clean up object URL if created
  if (typeof source !== 'string') {
    URL.revokeObjectURL(url);
  }

  return img;
}

/**
 * Calculate crop bounds with padding, ensuring within image bounds
 */
function calculateCropBounds(
  bbox: BoundingBox,
  imgWidth: number,
  imgHeight: number,
  padding: number
): BoundingBox {
  const x = Math.max(0, bbox.x - padding);
  const y = Math.max(0, bbox.y - padding);
  const maxX = Math.min(imgWidth, bbox.x + bbox.width + padding);
  const maxY = Math.min(imgHeight, bbox.y + bbox.height + padding);

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

/**
 * Convert canvas to blob (promisified)
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      format,
      quality
    );
  });
}
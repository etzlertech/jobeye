/**
 * @file src/domains/vision/utils/image-data.ts
 * @description Helper utilities for working with ImageData objects.
 * END AGENT DIRECTIVE BLOCK
 */

export async function imageDataToBlob(imageData: ImageData): Promise<Blob | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

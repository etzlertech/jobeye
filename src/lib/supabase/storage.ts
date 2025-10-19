// --- AGENT DIRECTIVE BLOCK ---
// file: /src/lib/supabase/storage.ts
// phase: 3.4
// domain: storage
// purpose: Shared Supabase Storage helpers for template/task images
// spec_ref: specs/013-lets-plan-to/spec.md
// version: 2025-10-20
// complexity_budget: 300 LoC
// offline_capability: NOT_REQUIRED
//
// dependencies:
//   internal:
//     - /src/utils/image-processor
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - uploadImagesToStorage: function - Upload processed images and return public URLs
//   - deleteImagesFromStorage: function - Remove stored image variants by path
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/lib/supabase/storage.test.ts
//
// tasks:
//   1. Provide shared helpers for multi-size uploads
//   2. Ensure tenant-scoped storage paths
//   3. Surface rich error messages for callers
// --- END DIRECTIVE BLOCK ---

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessedImages } from '@/utils/image-processor';

export interface UploadedImageUrls {
  thumbnail_url: string;
  medium_url: string;
  primary_image_url: string;
}

export interface UploadedImagePaths {
  thumbnail: string;
  medium: string;
  full: string;
}

export interface UploadImagesResult {
  urls: UploadedImageUrls;
  paths: UploadedImagePaths;
}

interface UploadTarget {
  key: keyof UploadedImageUrls;
  source: keyof ProcessedImages;
  suffix: 'thumbnail' | 'medium' | 'full';
}

const UPLOAD_TARGETS: UploadTarget[] = [
  { key: 'thumbnail_url', source: 'thumbnail', suffix: 'thumbnail' },
  { key: 'medium_url', source: 'medium', suffix: 'medium' },
  { key: 'primary_image_url', source: 'full', suffix: 'full' },
];

/**
 * Upload processed images to Supabase Storage using tenant-scoped paths.
 * Returns both the public URLs and stored object paths.
 */
export async function uploadImagesToStorage(
  supabaseClient: SupabaseClient,
  bucketName: string,
  entityId: string,
  tenantId: string,
  processedImages: ProcessedImages
): Promise<UploadImagesResult> {
  const timestamp = Date.now();
  const basePath = `${tenantId}/${entityId}`;

  const urls: UploadedImageUrls = {
    thumbnail_url: '',
    medium_url: '',
    primary_image_url: '',
  };

  const paths: UploadedImagePaths = {
    thumbnail: '',
    medium: '',
    full: '',
  };

  for (const target of UPLOAD_TARGETS) {
    const dataUrl = processedImages[target.source];
    const buffer = dataUrlToBuffer(dataUrl);
    const path = `${basePath}/${target.suffix}-${timestamp}.jpg`;

    const { error: uploadError } = await supabaseClient.storage
      .from(bucketName)
      .upload(path, buffer, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${target.suffix} image: ${uploadError.message}`);
    }

    const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error(`Failed to resolve public URL for ${target.suffix} image`);
    }

    urls[target.key] = data.publicUrl;
    paths[target.suffix] = path;
  }

  return { urls, paths };
}

/**
 * Delete images from Supabase Storage by their object paths.
 */
export async function deleteImagesFromStorage(
  supabaseClient: SupabaseClient,
  bucketName: string,
  paths: string[]
): Promise<void> {
  if (!paths.length) {
    return;
  }

  const { error } = await supabaseClient.storage
    .from(bucketName)
    .remove(paths);

  if (error) {
    throw new Error(`Failed to delete storage objects: ${error.message}`);
  }
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const matches = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!matches || matches.length < 3) {
    throw new Error('Invalid data URL provided for image upload');
  }

  return Buffer.from(matches[2], 'base64');
}

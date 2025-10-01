/**
 * @file media-asset.service.ts
 * @phase 3.3
 * @domain Vision
 * @purpose Service for uploading and managing media assets in Supabase Storage
 * @complexity_budget 200
 */

import { supabase } from '@/lib/supabase/client';

export interface UploadImageOptions {
  companyId: string;
  jobId?: string;
  userId: string;
  category?: 'verification' | 'inspection' | 'documentation';
  metadata?: Record<string, any>;
}

export interface UploadImageResult {
  mediaAssetId: string;
  storagePath: string;
  publicUrl: string;
  fileSize: number;
}

/**
 * Service for uploading verification photos to Supabase Storage
 */
export class MediaAssetService {
  private supabase = supabase;
  private readonly STORAGE_BUCKET = 'verification-photos';

  /**
   * Convert ImageData to Blob
   */
  private async imageDataToBlob(imageData: ImageData): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        'image/jpeg',
        0.85 // Quality: 85%
      );
    });
  }

  /**
   * Upload verification photo to Supabase Storage and create media_asset record
   */
  async uploadVerificationPhoto(
    imageData: ImageData,
    options: UploadImageOptions
  ): Promise<{ data: UploadImageResult | null; error: Error | null }> {
    try {
      const { companyId, jobId, userId, category = 'verification', metadata = {} } = options;

      // Convert ImageData to Blob
      const imageBlob = await this.imageDataToBlob(imageData);
      const timestamp = Date.now();
      const fileName = `verification-${timestamp}.jpg`;

      // Generate storage path: company/job/timestamp.jpg
      const storagePath = jobId
        ? `${companyId}/${jobId}/${fileName}`
        : `${companyId}/misc/${fileName}`;

      console.log('[MediaAssetService] Uploading photo to Storage:', {
        bucket: this.STORAGE_BUCKET,
        path: storagePath,
        size: imageBlob.size,
      });

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(storagePath, imageBlob, {
          contentType: 'image/jpeg',
          upsert: false,
          cacheControl: '3600', // Cache for 1 hour
        });

      if (uploadError) {
        console.error('[MediaAssetService] Storage upload failed:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      console.log('[MediaAssetService] Storage upload successful:', uploadData.path);

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(uploadData.path);

      const publicUrl = urlData.publicUrl;

      // Create media_asset record in database
      const { data: mediaAsset, error: dbError } = await this.supabase
        .from('media_assets')
        .insert({
          tenant_id: companyId,
          uploaded_by: userId,
          media_type: 'photo',
          file_name: fileName,
          file_size: imageBlob.size,
          mime_type: 'image/jpeg',
          storage_path: uploadData.path,
          public_url: publicUrl,
          job_id: jobId || null,
          tags: [category, 'equipment-verification'],
          metadata: {
            ...metadata,
            upload_source: 'mobile_pwa',
            image_dimensions: {
              width: imageData.width,
              height: imageData.height,
            },
          },
        })
        .select('id')
        .single();

      if (dbError) {
        console.error('[MediaAssetService] Database insert failed:', dbError);
        // Try to clean up uploaded file
        await this.supabase.storage.from(this.STORAGE_BUCKET).remove([uploadData.path]);
        throw new Error(`Failed to create media asset record: ${dbError.message}`);
      }

      console.log('[MediaAssetService] Media asset created:', mediaAsset.id);

      return {
        data: {
          mediaAssetId: mediaAsset.id,
          storagePath: uploadData.path,
          publicUrl,
          fileSize: imageBlob.size,
        },
        error: null,
      };
    } catch (err: any) {
      console.error('[MediaAssetService] Upload failed:', err);
      return {
        data: null,
        error: err instanceof Error ? err : new Error(err.message || 'Unknown error'),
      };
    }
  }

  /**
   * Delete media asset and its storage file
   */
  async deleteMediaAsset(
    mediaAssetId: string
  ): Promise<{ error: Error | null }> {
    try {
      // Get storage path from database
      const { data: mediaAsset, error: fetchError } = await this.supabase
        .from('media_assets')
        .select('storage_path')
        .eq('id', mediaAssetId)
        .single();

      if (fetchError || !mediaAsset) {
        throw new Error('Media asset not found');
      }

      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from(this.STORAGE_BUCKET)
        .remove([mediaAsset.storage_path]);

      if (storageError) {
        console.warn('[MediaAssetService] Storage delete warning:', storageError);
        // Continue even if storage delete fails
      }

      // Delete from database (will cascade to related records)
      const { error: dbError } = await this.supabase
        .from('media_assets')
        .delete()
        .eq('id', mediaAssetId);

      if (dbError) {
        throw new Error(`Failed to delete media asset: ${dbError.message}`);
      }

      console.log('[MediaAssetService] Media asset deleted:', mediaAssetId);

      return { error: null };
    } catch (err: any) {
      console.error('[MediaAssetService] Delete failed:', err);
      return {
        error: err instanceof Error ? err : new Error(err.message || 'Unknown error'),
      };
    }
  }

  /**
   * Get media asset URL by ID
   */
  async getMediaAssetUrl(
    mediaAssetId: string
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      const { data: mediaAsset, error: fetchError } = await this.supabase
        .from('media_assets')
        .select('public_url')
        .eq('id', mediaAssetId)
        .single();

      if (fetchError || !mediaAsset) {
        throw new Error('Media asset not found');
      }

      return {
        data: mediaAsset.public_url,
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(err.message || 'Unknown error'),
      };
    }
  }
}

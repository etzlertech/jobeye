import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/core/logger/logger';
import {
  InventoryImage,
  InventoryImageCreate,
  InventoryImageUpdate,
  InventoryKind,
} from '@/domains/inventory/types/inventory-types';

const repositoryLogger = new Logger('inventory-image-repository');

type AnySupabaseClient = SupabaseClient<any, any, any>;

function mapRow(row: any): InventoryImage {
  return {
    id: row.id,
    itemType: row.item_type,
    itemId: row.item_id,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    aspectRatio: row.aspect_ratio ?? 1,
    originalWidth: row.original_width,
    originalHeight: row.original_height,
    cropBox: row.crop_box ?? undefined,
    isPrimary: row.is_primary ?? false,
    metadata: row.metadata ?? undefined,
    capturedBy: row.captured_by ?? undefined,
    capturedAt: row.captured_at ?? undefined,
    createdAt: row.created_at,
  };
}

export class InventoryImageRepository {
  constructor(private readonly supabase: AnySupabaseClient) {}

  async listByItem(itemType: InventoryKind, itemId: string): Promise<InventoryImage[]> {
    const { data, error } = await this.supabase
      .from('inventory_images')
      .select('*')
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      repositoryLogger.error('Failed to load inventory images', { error, itemType, itemId });
      throw error;
    }

    return (data || []).map(mapRow);
  }

  async insert(payload: InventoryImageCreate): Promise<InventoryImage> {
    const insertPayload = {
      item_type: payload.itemType,
      item_id: payload.itemId,
      image_url: payload.imageUrl,
      thumbnail_url: payload.thumbnailUrl,
      is_primary: payload.isPrimary,
      aspect_ratio: payload.aspectRatio,
      original_width: payload.originalWidth,
      original_height: payload.originalHeight,
      crop_box: payload.cropBox ?? null,
      metadata: payload.metadata,
      captured_by: payload.capturedBy,
      captured_at: payload.capturedAt,
    };

    const { data, error } = await this.supabase
      .from('inventory_images')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      repositoryLogger.error('Failed to insert inventory image', { error, payload });
      throw error;
    }

    return mapRow(data);
  }

  async update(payload: InventoryImageUpdate): Promise<InventoryImage> {
    const updatePayload = {
      image_url: payload.imageUrl,
      thumbnail_url: payload.thumbnailUrl,
      is_primary: payload.isPrimary,
      aspect_ratio: payload.aspectRatio,
      original_width: payload.originalWidth,
      original_height: payload.originalHeight,
      crop_box: payload.cropBox ?? null,
      metadata: payload.metadata,
      captured_by: payload.capturedBy,
      captured_at: payload.capturedAt,
    };

    const { data, error } = await this.supabase
      .from('inventory_images')
      .update(updatePayload)
      .eq('id', payload.id)
      .select('*')
      .single();

    if (error) {
      repositoryLogger.error('Failed to update inventory image', { error, payload });
      throw error;
    }

    return mapRow(data);
  }

  async markPrimary(itemType: InventoryKind, itemId: string, imageId: string): Promise<void> {
    const { error: clearError } = await this.supabase
      .from('inventory_images')
      .update({ is_primary: false })
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    if (clearError) {
      repositoryLogger.error('Failed to clear primary flag before update', {
        error: clearError,
        itemType,
        itemId,
      });
      throw clearError;
    }

    const { error: setError } = await this.supabase
      .from('inventory_images')
      .update({ is_primary: true })
      .eq('id', imageId);

    if (setError) {
      repositoryLogger.error('Failed to set primary inventory image', {
        error: setError,
        imageId,
      });
      throw setError;
    }
  }

  async remove(imageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('inventory_images')
      .delete()
      .eq('id', imageId);

    if (error) {
      repositoryLogger.error('Failed to delete inventory image', { error, imageId });
      throw error;
    }
  }
}

export function createInventoryImageRepository(supabase: AnySupabaseClient) {
  return new InventoryImageRepository(supabase);
}

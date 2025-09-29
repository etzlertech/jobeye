import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/core/logger/logger';
import {
  InventoryImage,
  InventoryImageCreate,
  InventoryImageFinalizePayload,
  InventoryImageUpdate,
  InventoryImageUploadRequest,
  InventoryImageUploadSession,
  InventoryItemDetail,
  InventoryItemSummary,
  InventoryKind,
} from '@/domains/inventory/types/inventory-types';
import { InventoryImageRepository } from '@/domains/inventory/repositories/inventory-image-repository';
import { config } from '@/core/config/environment';
import { randomUUID } from 'crypto';

interface InventoryIntakeServiceOptions {
  tenantId: string;
}

interface InventoryImageParams {
  tenantId: string;
  itemType: InventoryKind;
  itemId: string;
}

const serviceLogger = new Logger('inventory-intake-service');

type AnySupabaseClient = SupabaseClient<any, any, any>;

export class InventoryIntakeService {
  constructor(
    private readonly supabase: AnySupabaseClient,
    private readonly imageRepository: InventoryImageRepository,
    private readonly bucketName: string = config.storage.inventoryBucket,
  ) {}

  private resolveTable(itemType: InventoryKind) {
    switch (itemType) {
      case 'equipment':
        return 'equipment';
      case 'material':
        return 'materials';
      default:
        throw new Error(`Unsupported inventory type: ${itemType}`);
    }
  }

  async getItemDetail(
    itemType: InventoryKind,
    itemId: string,
    options: InventoryIntakeServiceOptions,
  ): Promise<InventoryItemDetail | null> {
    const table = this.resolveTable(itemType);

    const { data: itemRow, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', itemId)
      .eq('tenant_id', options.tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      serviceLogger.error('Failed to load inventory item', { error, itemType, itemId });
      throw error;
    }

    const images = await this.imageRepository.listByItem(itemType, itemId);

    const summary = this.mapItemSummary(itemType, itemRow, images);

    return {
      ...summary,
      description: itemRow.description ?? itemRow.notes ?? null,
      notes: itemRow.notes ?? null,
      metadata: itemRow.metadata ?? null,
      images,
    };
  }

  async listItemSummaries(
    itemType: InventoryKind,
    options: InventoryIntakeServiceOptions,
  ): Promise<InventoryItemSummary[]> {
    const table = this.resolveTable(itemType);

    const { data, error } = await this.supabase
      .from(table)
      .select('id, name, tenant_id, sku, equipment_number, metadata')
      .eq('tenant_id', options.tenantId)
      .order('name', { ascending: true });

    if (error) {
      serviceLogger.error('Failed to list inventory items', { error, itemType });
      throw error;
    }

    const items = data || [];

    return Promise.all(
      items.map(async itemRow => {
        const images = await this.imageRepository.listByItem(itemType, itemRow.id);
        return this.mapItemSummary(itemType, itemRow, images);
      }),
    );
  }

  async addImage(
    params: InventoryImageParams,
    payload: InventoryImageCreate,
  ): Promise<InventoryImage> {
    await this.assertItemOwnership(params);

    if (payload.itemType !== params.itemType || payload.itemId !== params.itemId) {
      throw new Error('Payload item mismatch when adding inventory image');
    }

    return this.imageRepository.insert(payload);
  }

  async createUploadSession(
    params: InventoryImageParams,
    request: InventoryImageUploadRequest,
  ): Promise<InventoryImageUploadSession> {
    await this.assertItemOwnership(params);

    const extension = this.getFileExtension(request.fileName, request.mimeType);
    const objectName = `${params.tenantId}/${params.itemType}/${params.itemId}/${randomUUID()}${extension}`;

    const expiresIn = 60 * 5; // 5 minutes

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUploadUrl(objectName, { expiresIn, upsert: true });

    if (error || !data?.signedUrl) {
      serviceLogger.error('Failed to create signed upload URL for inventory image', {
        error,
        params,
        request,
      });
      throw error || new Error('Unable to create signed upload URL');
    }

    return {
      uploadUrl: data.signedUrl,
      storagePath: objectName,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async finalizeUploadedImage(
    params: InventoryImageParams,
    payload: InventoryImageFinalizePayload,
  ): Promise<InventoryImage> {
    await this.assertItemOwnership(params);

    const imageUrl = await this.resolvePublicUrl(payload.storagePath, payload.imageUrl);
    const thumbnailUrl = payload.thumbnailUrl || imageUrl;

    const record: InventoryImageCreate = {
      itemType: params.itemType,
      itemId: params.itemId,
      imageUrl,
      thumbnailUrl,
      isPrimary: payload.isPrimary ?? false,
      aspectRatio: payload.aspectRatio ?? 1,
      originalWidth: payload.originalWidth,
      originalHeight: payload.originalHeight,
      cropBox: payload.cropBox,
      metadata: payload.metadata,
      capturedBy: payload.capturedBy,
      capturedAt: payload.capturedAt ?? new Date().toISOString(),
    };

    const inserted = await this.imageRepository.insert(record);

    if (payload.isPrimary) {
      await this.imageRepository.markPrimary(params.itemType, params.itemId, inserted.id);
    }

    return inserted;
  }

  async updateImage(
    params: InventoryImageParams,
    payload: InventoryImageUpdate,
  ): Promise<InventoryImage> {
    await this.assertItemOwnership(params);
    if (payload.itemId && payload.itemId !== params.itemId) {
      throw new Error('Payload item mismatch when updating inventory image');
    }
    return this.imageRepository.update(payload);
  }

  async deleteImage(params: InventoryImageParams, imageId: string): Promise<void> {
    await this.assertItemOwnership(params);
    await this.imageRepository.remove(imageId);
  }

  async setPrimaryImage(params: InventoryImageParams, imageId: string): Promise<void> {
    await this.assertItemOwnership(params);
    await this.imageRepository.markPrimary(params.itemType, params.itemId, imageId);
  }

  private async assertItemOwnership(params: InventoryImageParams) {
    const table = this.resolveTable(params.itemType);

    const { error, data } = await this.supabase
      .from(table)
      .select('id')
      .eq('id', params.itemId)
      .eq('tenant_id', params.tenantId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      serviceLogger.error('Ownership check failed for inventory item', { error, params });
      throw error || new Error('Inventory item not found for tenant');
    }
  }

  private mapItemSummary(
    itemType: InventoryKind,
    itemRow: any,
    images: InventoryImage[],
  ): InventoryItemSummary {
    const primaryImage = images.find(image => image.isPrimary) ?? images[0];
    const sku = itemRow.sku || itemRow.equipment_number || itemRow.inventory_code;

    return {
      id: itemRow.id,
      name: itemRow.name,
      itemType,
      skuOrIdentifier: sku ?? null,
      defaultContainerId: itemRow.default_container_id ?? null,
      primaryImageUrl: primaryImage?.imageUrl ?? null,
    };
  }

  private getFileExtension(fileName: string, mimeType: string) {
    const extFromName = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
    if (extFromName) return extFromName.toLowerCase();

    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/heic': '.heic',
    };

    return mimeMap[mimeType] || '.jpg';
  }

  private async resolvePublicUrl(storagePath: string, providedUrl?: string) {
    if (providedUrl) return providedUrl;

    const { data } = await this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }
}

export function createInventoryIntakeService(
  supabase: AnySupabaseClient,
  imageRepository: InventoryImageRepository,
) {
  return new InventoryIntakeService(supabase, imageRepository);
}

export function createInventoryIntakeServiceFromSupabase(supabase: AnySupabaseClient) {
  const repository = new InventoryImageRepository(supabase);
  return new InventoryIntakeService(supabase, repository);
}

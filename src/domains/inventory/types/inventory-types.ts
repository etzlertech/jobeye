import { z } from 'zod';

export type InventoryKind = 'equipment' | 'material';

export const InventoryKindSchema = z.enum(['equipment', 'material']);

export interface InventoryImage {
  id: string;
  itemType: InventoryKind;
  itemId: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  aspectRatio: number;
  originalWidth?: number | null;
  originalHeight?: number | null;
  cropBox?: CropBox | null;
  isPrimary: boolean;
  metadata?: Record<string, any>;
  capturedBy?: string | null;
  capturedAt?: string | null;
  createdAt: string;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CropBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
});

export const InventoryImageCreateSchema = z.object({
  itemType: InventoryKindSchema,
  itemId: z.string().uuid(),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  isPrimary: z.boolean().default(false),
  aspectRatio: z.number().positive().default(1),
  originalWidth: z.number().int().positive().optional(),
  originalHeight: z.number().int().positive().optional(),
  cropBox: CropBoxSchema.optional(),
  metadata: z.record(z.any()).optional(),
  capturedBy: z.string().uuid().optional(),
  capturedAt: z.string().datetime().optional(),
});

export type InventoryImageCreate = z.infer<typeof InventoryImageCreateSchema>;

export const InventoryImageUpdateSchema = InventoryImageCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export type InventoryImageUpdate = z.infer<typeof InventoryImageUpdateSchema>;

export interface InventoryItemSummary {
  id: string;
  name: string;
  itemType: InventoryKind;
  skuOrIdentifier?: string | null;
  defaultContainerId?: string | null;
  primaryImageUrl?: string | null;
}

export interface InventoryItemDetail extends InventoryItemSummary {
  description?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  images: InventoryImage[];
}

export interface InventoryImageUploadRequest {
  fileName: string;
  mimeType: string;
  fileSize?: number;
  capturedBy?: string;
  capturedAt?: string;
}

export interface InventoryImageUploadSession {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
  publicUrl?: string;
  thumbnailUrl?: string;
}

export interface InventoryImageFinalizePayload {
  storagePath: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  aspectRatio?: number;
  originalWidth?: number;
  originalHeight?: number;
  cropBox?: CropBox;
  isPrimary?: boolean;
  metadata?: Record<string, any>;
  capturedBy?: string;
  capturedAt?: string;
}

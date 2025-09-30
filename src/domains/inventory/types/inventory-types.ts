/**
 * Inventory Domain Types - Feature 004
 *
 * Extended for voice-vision inventory management:
 * - inventory_items (equipment & materials with tracking modes)
 * - containers (trucks, trailers, storage)
 * - container_assignments (check-in/out tracking)
 * - inventory_transactions (audit log)
 * - purchase_receipts (OCR integration)
 * - training_data (YOLO fine-tuning)
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export type InventoryKind = 'equipment' | 'material';
export const InventoryKindSchema = z.enum(['equipment', 'material']);

export type ItemType = 'equipment' | 'material';
export const ItemTypeSchema = z.enum(['equipment', 'material']);

export type ItemStatus = 'active' | 'maintenance' | 'repair' | 'retired' | 'lost';
export const ItemStatusSchema = z.enum(['active', 'maintenance', 'repair', 'retired', 'lost']);

export type TrackingMode = 'individual' | 'quantity';
export const TrackingModeSchema = z.enum(['individual', 'quantity']);

export type ContainerType = 'truck' | 'trailer' | 'storage_bin' | 'warehouse' | 'building' | 'toolbox';
export const ContainerTypeSchema = z.enum(['truck', 'trailer', 'storage_bin', 'warehouse', 'building', 'toolbox']);

export type AssignmentStatus = 'active' | 'completed' | 'cancelled';
export const AssignmentStatusSchema = z.enum(['active', 'completed', 'cancelled']);

export type TransactionType = 'check_out' | 'check_in' | 'transfer' | 'register' | 'purchase' | 'usage' | 'decommission' | 'audit' | 'maintenance';
export const TransactionTypeSchema = z.enum(['check_out', 'check_in', 'transfer', 'register', 'purchase', 'usage', 'decommission', 'audit', 'maintenance']);

export type VerificationMethod = 'manual' | 'qr_scan' | 'photo_vision' | 'voice';
export const VerificationMethodSchema = z.enum(['manual', 'qr_scan', 'photo_vision', 'voice']);

export type OcrMethod = 'tesseract' | 'gpt4_vision';
export const OcrMethodSchema = z.enum(['tesseract', 'gpt4_vision']);

export type FilterAction = 'always_exclude' | 'always_include' | 'ask';
export const FilterActionSchema = z.enum(['always_exclude', 'always_include', 'ask']);

export type RelationshipType = 'accessory' | 'part' | 'alternative' | 'replacement' | 'upgrade';
export const RelationshipTypeSchema = z.enum(['accessory', 'part', 'alternative', 'replacement', 'upgrade']);

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

// =============================================================================
// INVENTORY ITEMS
// =============================================================================

export interface InventoryItem {
  id: string;
  company_id: string;
  type: ItemType;
  name: string;
  category: string | null;
  status: ItemStatus;
  current_location_id: string | null;
  specifications: Record<string, any> | null;
  attributes: Record<string, any> | null;
  images: InventoryImageData[];
  tracking_mode: TrackingMode;
  current_quantity: number | null;
  reorder_level: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface InventoryImageData {
  url: string;
  aspect_ratio: number;
  crop_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  is_primary: boolean;
  captured_at?: string;
  captured_by?: string;
}

export interface InventoryItemCreate {
  company_id: string;
  type: ItemType;
  name: string;
  category?: string;
  status?: ItemStatus;
  current_location_id?: string;
  specifications?: Record<string, any>;
  attributes?: Record<string, any>;
  images: InventoryImageData[];
  tracking_mode: TrackingMode;
  current_quantity?: number;
  reorder_level?: number;
  created_by?: string;
}

export interface InventoryItemUpdate {
  name?: string;
  category?: string;
  status?: ItemStatus;
  current_location_id?: string;
  specifications?: Record<string, any>;
  attributes?: Record<string, any>;
  images?: InventoryImageData[];
  current_quantity?: number;
  reorder_level?: number;
}

// =============================================================================
// CONTAINERS
// =============================================================================

export interface Container {
  id: string;
  company_id: string;
  type: ContainerType;
  name: string;
  identifier: string | null;
  capacity: number | null;
  parent_container_id: string | null;
  default_location_gps: string | null; // PostGIS POINT
  photo_url: string | null;
  voice_name: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContainerCreate {
  company_id: string;
  type: ContainerType;
  name: string;
  identifier?: string;
  capacity?: number;
  parent_container_id?: string;
  default_location_gps?: string;
  photo_url?: string;
  voice_name?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface ContainerUpdate {
  name?: string;
  identifier?: string;
  capacity?: number;
  parent_container_id?: string;
  default_location_gps?: string;
  photo_url?: string;
  voice_name?: string;
  is_active?: boolean;
  is_default?: boolean;
}

// =============================================================================
// CONTAINER ASSIGNMENTS
// =============================================================================

export interface ContainerAssignment {
  id: string;
  container_id: string;
  item_id: string;
  quantity: number;
  checked_in_at: string;
  checked_out_at: string | null;
  job_id: string | null;
  status: AssignmentStatus;
}

export interface ContainerAssignmentCreate {
  container_id: string;
  item_id: string;
  quantity?: number;
  checked_in_at?: string;
  job_id?: string;
  status?: AssignmentStatus;
}

// =============================================================================
// INVENTORY TRANSACTIONS
// =============================================================================

export interface InventoryTransaction {
  id: string;
  company_id: string;
  type: TransactionType;
  item_ids: string[];
  quantity: number | null;
  source_container_id: string | null;
  destination_container_id: string | null;
  job_id: string | null;
  performer_id: string;
  verification_method: VerificationMethod;
  photo_evidence_url: string | null;
  voice_session_id: string | null;
  voice_transcript: string | null;
  notes: string | null;
  cost_data: CostData | null;
  created_at: string;
}

export interface CostData {
  estimated_vlm_cost?: number;
  estimated_llm_cost?: number;
  actual_cost?: number;
}

export interface InventoryTransactionCreate {
  company_id: string;
  type: TransactionType;
  item_ids: string[];
  quantity?: number;
  source_container_id?: string;
  destination_container_id?: string;
  job_id?: string;
  performer_id: string;
  verification_method: VerificationMethod;
  photo_evidence_url?: string;
  voice_session_id?: string;
  voice_transcript?: string;
  notes?: string;
  cost_data?: CostData;
}

// =============================================================================
// PURCHASE RECEIPTS
// =============================================================================

export interface PurchaseReceipt {
  id: string;
  company_id: string;
  vendor_name: string;
  vendor_location: string | null;
  purchase_date: string;
  total_amount: number;
  line_items: ReceiptLineItem[];
  receipt_photo_url: string;
  ocr_extracted_data: Record<string, any>;
  ocr_confidence_scores: Record<string, number> | null;
  ocr_method: OcrMethod;
  po_reference: string | null;
  assigned_job_id: string | null;
  created_at: string;
  created_by: string;
}

export interface ReceiptLineItem {
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  matched_item_id?: string;
}

export interface PurchaseReceiptCreate {
  company_id: string;
  vendor_name: string;
  vendor_location?: string;
  purchase_date: string;
  total_amount: number;
  line_items: ReceiptLineItem[];
  receipt_photo_url: string;
  ocr_extracted_data: Record<string, any>;
  ocr_confidence_scores?: Record<string, number>;
  ocr_method: OcrMethod;
  po_reference?: string;
  assigned_job_id?: string;
  created_by: string;
}

// =============================================================================
// TRAINING DATA
// =============================================================================

export interface TrainingDataRecord {
  id: string;
  company_id: string;
  user_id: string;
  original_photo_url: string;
  yolo_detections: YoloDetections;
  vlm_analysis: VlmAnalysis | null;
  user_selections: number[];
  user_corrections: UserCorrection[];
  user_exclusions: UserExclusion[];
  context: TrainingContext;
  voice_transcript: string | null;
  quality_metrics: QualityMetrics | null;
  created_record_ids: string[];
  created_at: string;
}

export interface YoloDetections {
  detections: Array<{
    bbox: [number, number, number, number];
    label: string;
    confidence: number;
  }>;
  inference_time_ms: number;
}

export interface VlmAnalysis {
  provider: string;
  model: string;
  detections: any[];
  cost: number;
  tokens: number;
}

export interface UserCorrection {
  detection_num: number;
  original_label: string;
  corrected_label: string;
  bbox_adjustment?: any;
}

export interface UserExclusion {
  detection_num: number;
  label: string;
  reason: string;
}

export interface TrainingContext {
  gps_lat?: number;
  gps_lng?: number;
  location_type?: string;
  transaction_intent?: string;
  timestamp: string;
}

export interface QualityMetrics {
  retake_count?: number;
  correction_count?: number;
  user_satisfaction_rating?: number;
}

export interface TrainingDataRecordCreate {
  company_id: string;
  user_id: string;
  original_photo_url: string;
  yolo_detections: YoloDetections;
  vlm_analysis?: VlmAnalysis;
  user_selections: number[];
  user_corrections?: UserCorrection[];
  user_exclusions?: UserExclusion[];
  context: TrainingContext;
  voice_transcript?: string;
  quality_metrics?: QualityMetrics;
  created_record_ids: string[];
}

// =============================================================================
// VISION TRAINING ANNOTATIONS
// =============================================================================

export interface VisionTrainingAnnotation {
  id: string;
  training_record_id: string;
  item_detection_number: number;
  corrected_label: string;
  corrected_bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  correction_reason: string | null;
  created_at: string;
}

export interface VisionTrainingAnnotationCreate {
  training_record_id: string;
  item_detection_number: number;
  corrected_label: string;
  corrected_bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  correction_reason?: string;
}

// =============================================================================
// DETECTION CONFIDENCE THRESHOLDS
// =============================================================================

export interface DetectionConfidenceThreshold {
  id: string;
  company_id: string;
  local_confidence_threshold: number;
  max_daily_vlm_requests: number;
  daily_cost_budget_cap: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// BACKGROUND FILTER PREFERENCES
// =============================================================================

export interface BackgroundFilterPreference {
  id: string;
  company_id: string;
  user_id: string | null;
  object_label: string;
  action: FilterAction;
  context_filters: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// ITEM RELATIONSHIPS
// =============================================================================

export interface ItemRelationship {
  id: string;
  parent_item_id: string;
  related_item_id: string;
  relationship_type: RelationshipType;
  notes: string | null;
  created_at: string;
}

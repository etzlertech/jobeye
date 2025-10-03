/**
 * Unified item types for the consolidated inventory system
 */
import { z } from 'zod';

// Enums
export const ItemType = z.enum(['equipment', 'material', 'consumable', 'tool']);
export type ItemType = z.infer<typeof ItemType>;

export const TrackingMode = z.enum(['individual', 'quantity', 'batch']);
export type TrackingMode = z.infer<typeof TrackingMode>;

export const ItemStatus = z.enum(['active', 'maintenance', 'retired', 'lost', 'damaged']);
export type ItemStatus = z.infer<typeof ItemStatus>;

export const ItemCondition = z.enum(['new', 'excellent', 'good', 'fair', 'poor']);
export type ItemCondition = z.infer<typeof ItemCondition>;

export const TransactionType = z.enum([
  'check_in', 
  'check_out', 
  'transfer', 
  'adjustment',
  'purchase', 
  'sale', 
  'maintenance', 
  'disposal'
]);
export type TransactionType = z.infer<typeof TransactionType>;

// Item Schema
export const ItemSchema = z.object({
  // Core Identity
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  // Classification
  itemType: ItemType,
  category: z.string(),
  trackingMode: TrackingMode,
  
  // Basic Information
  name: z.string(),
  description: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  
  // Quantity Management
  currentQuantity: z.number().default(0),
  unitOfMeasure: z.string().default('each'),
  minQuantity: z.number().optional(),
  maxQuantity: z.number().optional(),
  reorderPoint: z.number().optional(),
  
  // Location & Assignment
  currentLocationId: z.string().uuid().optional(),
  homeLocationId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional(),
  assignedToJobId: z.string().uuid().optional(),
  
  // Status & Condition
  status: ItemStatus.default('active'),
  condition: ItemCondition.optional(),
  lastMaintenanceDate: z.string().optional(),
  nextMaintenanceDate: z.string().optional(),
  
  // Financial
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().optional(),
  currentValue: z.number().optional(),
  depreciationMethod: z.string().optional(),
  
  // Metadata & Extensibility
  attributes: z.record(z.any()).default({}),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.any()).default({}),
  
  // Media
  primaryImageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).default([]),
  
  // Audit
  createdAt: z.string(),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string(),
  updatedBy: z.string().uuid().optional(),
});

export type Item = z.infer<typeof ItemSchema>;

// Create/Update schemas
export const ItemCreateSchema = ItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ItemCreate = z.infer<typeof ItemCreateSchema>;

export const ItemUpdateSchema = ItemCreateSchema.partial();
export type ItemUpdate = z.infer<typeof ItemUpdateSchema>;

// Transaction Schema
export const ItemTransactionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  // Transaction Details
  transactionType: TransactionType,
  itemId: z.string().uuid(),
  quantity: z.number().default(1),
  
  // Movement Tracking
  fromLocationId: z.string().uuid().optional(),
  toLocationId: z.string().uuid().optional(),
  fromUserId: z.string().uuid().optional(),
  toUserId: z.string().uuid().optional(),
  
  // Context
  jobId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  
  // Details
  cost: z.number().optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
  
  // Voice/Vision Integration
  voiceSessionId: z.string().uuid().optional(),
  detectionSessionId: z.string().uuid().optional(),
  confidenceScore: z.number().optional(),
  
  // Metadata
  metadata: z.record(z.any()).default({}),
  
  // Audit
  createdAt: z.string(),
  createdBy: z.string().uuid().optional(),
});

export type ItemTransaction = z.infer<typeof ItemTransactionSchema>;

// Filter types
export interface ItemFilters {
  itemType?: ItemType;
  category?: string;
  status?: ItemStatus;
  trackingMode?: TrackingMode;
  assignedToJobId?: string;
  assignedToUserId?: string;
  currentLocationId?: string;
  searchTerm?: string;
  tags?: string[];
}

export interface TransactionFilters {
  transactionType?: TransactionType;
  itemId?: string;
  jobId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  dateFrom?: string;
  dateTo?: string;
}
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/material/types/material-types.ts
// phase: 2
// domain: material-catalog
// purpose: Material catalog domain types and validation schemas
// spec_ref: phase2/material-catalog#types
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   external:
//     - zod: ^3.23.8
//
// exports:
//   - Material: interface - Material entity
//   - MaterialCreate: interface - Material creation payload
//   - MaterialUpdate: interface - Material update payload
//   - MaterialType: enum - Material types
//   - MaterialCategory: enum - Material categories
//   - InventoryRecord: interface - Inventory tracking
//   - ValidationSchemas: object - Zod validation schemas
//
// voice_considerations: |
//   Support voice-friendly material identification.
//   Enable natural language quantity and unit queries.
//   Track voice-recorded usage notes.
//   Support audible inventory level alerts.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/material/types/material-types.test.ts
//
// tasks:
//   1. Define material entity structure
//   2. Create material type and category enums
//   3. Define inventory tracking types
//   4. Add validation schemas
//   5. Define voice command types
//   6. Add serialization helpers
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';

/**
 * Material types supported by the system
 */
export enum MaterialType {
  SEED = 'seed',
  FERTILIZER = 'fertilizer',
  PESTICIDE = 'pesticide',
  HERBICIDE = 'herbicide',
  MULCH = 'mulch',
  SOIL = 'soil',
  PLANT = 'plant',
  TREE = 'tree',
  SHRUB = 'shrub',
  IRRIGATION_PART = 'irrigation_part',
  TOOL_PART = 'tool_part',
  FUEL = 'fuel',
  OIL = 'oil',
  CHEMICAL = 'chemical',
  HARDWARE = 'hardware',
  OTHER = 'other',
}

/**
 * Material categories for organization
 */
export enum MaterialCategory {
  LAWN_CARE = 'lawn_care',
  LANDSCAPING = 'landscaping',
  IRRIGATION = 'irrigation',
  MAINTENANCE = 'maintenance',
  CHEMICALS = 'chemicals',
  EQUIPMENT_PARTS = 'equipment_parts',
  CONSUMABLES = 'consumables',
}

/**
 * Material measurement units
 */
export enum MaterialUnit {
  POUND = 'lb',
  GALLON = 'gal',
  QUART = 'qt',
  OUNCE = 'oz',
  BAG = 'bag',
  CASE = 'case',
  PIECE = 'pc',
  FOOT = 'ft',
  YARD = 'yd',
  CUBIC_YARD = 'cu_yd',
  SQUARE_FOOT = 'sq_ft',
  EACH = 'each',
  LITER = 'l',
  KILOGRAM = 'kg',
  GRAM = 'g',
}

/**
 * Material supplier information
 */
export interface MaterialSupplier {
  id: string;
  name: string;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  accountNumber?: string;
  deliveryAvailable: boolean;
  preferredSupplier: boolean;
}

/**
 * Material pricing information
 */
export interface MaterialPricing {
  unitCost: number;
  unit: MaterialUnit;
  lastUpdated: Date;
  supplier: string;
  bulkPricing?: Array<{
    minQuantity: number;
    unitCost: number;
    unit: MaterialUnit;
  }>;
}

/**
 * Material inventory tracking
 */
export interface InventoryRecord {
  locationId: string;
  locationName: string;
  currentStock: number;
  unit: MaterialUnit;
  reservedStock: number;
  reorderLevel: number;
  maxStock: number;
  lastUpdated: Date;
  lastCountDate?: Date;
  averageUsagePerWeek?: number;
  expirationDate?: Date;
  batchNumber?: string;
}

/**
 * Material usage tracking
 */
export interface MaterialUsage {
  totalUsed: number;
  unit: MaterialUnit;
  averagePerJob: number;
  peakUsageMonth?: string;
  costPerJob?: number;
  lastUsedDate?: Date;
}

/**
 * Material safety information
 */
export interface MaterialSafety {
  requiresPPE: boolean;
  ppeRequired?: string[];
  hazardous: boolean;
  storageRequirements?: string;
  mixingInstructions?: string;
  applicationRate?: string;
  msdsUrl?: string;
  expirationWarningDays?: number;
}

/**
 * Core material entity
 */
export interface Material {
  id: string;
  tenant_id: string;
  material_number: string;
  name: string;
  description?: string;
  type: MaterialType;
  category: MaterialCategory;
  brand?: string;
  manufacturer?: string;
  sku?: string;
  barcode?: string;
  unit: MaterialUnit;
  packaging?: string; // e.g., "50 lb bag", "1 gallon jug"
  pricing: MaterialPricing[];
  inventory: InventoryRecord[];
  usage: MaterialUsage;
  safety?: MaterialSafety;
  suppliers: MaterialSupplier[];
  photos?: string[]; // URLs to material photos
  documents?: string[]; // URLs to MSDS, spec sheets, etc.
  applicationNotes?: string;
  seasonalAvailability?: string;
  alternativeMaterials?: string[]; // IDs of alternative materials
  tags: string[];
  customFields?: Record<string, any>;
  is_active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

/**
 * Material creation payload
 */
export interface MaterialCreate {
  name: string;
  description?: string;
  type: MaterialType;
  category: MaterialCategory;
  brand?: string;
  manufacturer?: string;
  sku?: string;
  barcode?: string;
  unit: MaterialUnit;
  packaging?: string;
  pricing?: Omit<MaterialPricing, 'lastUpdated'>[];
  initialInventory?: Array<{
    locationId: string;
    locationName: string;
    currentStock: number;
    reorderLevel: number;
    maxStock: number;
  }>;
  safety?: MaterialSafety;
  suppliers?: MaterialSupplier[];
  applicationNotes?: string;
  seasonalAvailability?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  voiceMetadata?: {
    sessionId?: string;
    confidence?: number;
    recognizedText?: string;
  };
}

/**
 * Material update payload
 */
export interface MaterialUpdate {
  name?: string;
  description?: string;
  type?: MaterialType;
  category?: MaterialCategory;
  brand?: string;
  manufacturer?: string;
  sku?: string;
  barcode?: string;
  unit?: MaterialUnit;
  packaging?: string;
  safety?: Partial<MaterialSafety>;
  applicationNotes?: string;
  seasonalAvailability?: string;
  alternativeMaterials?: string[];
  tags?: string[];
  customFields?: Record<string, any>;
  is_active?: boolean;
}

/**
 * Material voice command types
 */
export interface MaterialVoiceCommand {
  type: 'find' | 'check_stock' | 'use' | 'reorder' | 'report';
  material?: {
    name?: string;
    type?: MaterialType;
    category?: MaterialCategory;
    brand?: string;
    sku?: string;
  };
  action?: {
    location?: string;
    quantity?: number;
    unit?: MaterialUnit;
    notes?: string;
  };
  sessionId: string;
  confidence: number;
}

/**
 * Material search result
 */
export interface MaterialSearchResult {
  material: Material;
  relevanceScore: number;
  matchReason: string;
  voiceMatch?: boolean;
  stockLevel?: 'high' | 'medium' | 'low' | 'out';
}

/**
 * Inventory transaction record
 */
export interface InventoryTransaction {
  id: string;
  materialId: string;
  locationId: string;
  type: 'purchase' | 'usage' | 'adjustment' | 'transfer' | 'return';
  quantity: number;
  unit: MaterialUnit;
  unitCost?: number;
  totalCost?: number;
  jobId?: string;
  propertyId?: string;
  supplierId?: string;
  batchNumber?: string;
  expirationDate?: Date;
  notes?: string;
  voiceNotes?: string[];
  performedBy: string;
  createdAt: Date;
}

// Validation schemas
export const materialCreateSchema = z.object({
  name: z.string().min(1, 'Material name is required'),
  description: z.string().optional(),
  type: z.nativeEnum(MaterialType),
  category: z.nativeEnum(MaterialCategory),
  brand: z.string().optional(),
  manufacturer: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unit: z.nativeEnum(MaterialUnit),
  packaging: z.string().optional(),
  pricing: z.array(z.object({
    unitCost: z.number().positive(),
    unit: z.nativeEnum(MaterialUnit),
    supplier: z.string().min(1),
    bulkPricing: z.array(z.object({
      minQuantity: z.number().positive(),
      unitCost: z.number().positive(),
      unit: z.nativeEnum(MaterialUnit),
    })).optional(),
  })).optional(),
  initialInventory: z.array(z.object({
    locationId: z.string().min(1),
    locationName: z.string().min(1),
    currentStock: z.number().nonnegative(),
    reorderLevel: z.number().nonnegative(),
    maxStock: z.number().positive(),
  })).optional(),
  safety: z.object({
    requiresPPE: z.boolean(),
    ppeRequired: z.array(z.string()).optional(),
    hazardous: z.boolean(),
    storageRequirements: z.string().optional(),
    mixingInstructions: z.string().optional(),
    applicationRate: z.string().optional(),
    msdsUrl: z.string().url().optional(),
    expirationWarningDays: z.number().positive().optional(),
  }).optional(),
  suppliers: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
    website: z.string().url().optional(),
    accountNumber: z.string().optional(),
    deliveryAvailable: z.boolean(),
    preferredSupplier: z.boolean(),
  })).optional(),
  applicationNotes: z.string().optional(),
  seasonalAvailability: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.any()).optional(),
});

export const materialUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.nativeEnum(MaterialType).optional(),
  category: z.nativeEnum(MaterialCategory).optional(),
  brand: z.string().optional(),
  manufacturer: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unit: z.nativeEnum(MaterialUnit).optional(),
  packaging: z.string().optional(),
  safety: z.object({
    requiresPPE: z.boolean().optional(),
    ppeRequired: z.array(z.string()).optional(),
    hazardous: z.boolean().optional(),
    storageRequirements: z.string().optional(),
    mixingInstructions: z.string().optional(),
    applicationRate: z.string().optional(),
    msdsUrl: z.string().url().optional(),
    expirationWarningDays: z.number().positive().optional(),
  }).partial().optional(),
  applicationNotes: z.string().optional(),
  seasonalAvailability: z.string().optional(),
  alternativeMaterials: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

export const inventoryTransactionSchema = z.object({
  materialId: z.string().min(1),
  locationId: z.string().min(1),
  type: z.enum(['purchase', 'usage', 'adjustment', 'transfer', 'return']),
  quantity: z.number(),
  unit: z.nativeEnum(MaterialUnit),
  unitCost: z.number().positive().optional(),
  totalCost: z.number().positive().optional(),
  jobId: z.string().optional(),
  propertyId: z.string().optional(),
  supplierId: z.string().optional(),
  batchNumber: z.string().optional(),
  expirationDate: z.date().optional(),
  notes: z.string().optional(),
  voiceNotes: z.array(z.string()).default([]),
  performedBy: z.string().min(1),
});

/**
 * Type guards and helpers
 */
export function isMaterialType(value: string): value is MaterialType {
  return Object.values(MaterialType).includes(value as MaterialType);
}

export function isMaterialCategory(value: string): value is MaterialCategory {
  return Object.values(MaterialCategory).includes(value as MaterialCategory);
}

export function isMaterialUnit(value: string): value is MaterialUnit {
  return Object.values(MaterialUnit).includes(value as MaterialUnit);
}

/**
 * Material serialization helpers
 */
export function serializeMaterial(material: Material): Record<string, any> {
  return {
    ...material,
    pricing: material.pricing.map(p => ({
      ...p,
      lastUpdated: p.lastUpdated.toISOString(),
    })),
    inventory: material.inventory.map(i => ({
      ...i,
      lastUpdated: i.lastUpdated.toISOString(),
      lastCountDate: i.lastCountDate?.toISOString(),
    })),
    usage: {
      ...material.usage,
      lastUsedDate: material.usage.lastUsedDate?.toISOString(),
    },
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

export function deserializeMaterial(data: Record<string, any>): Material {
  return {
    ...data,
    pricing: data.pricing.map((p: any) => ({
      ...p,
      lastUpdated: new Date(p.lastUpdated),
    })),
    inventory: data.inventory.map((i: any) => ({
      ...i,
      lastUpdated: new Date(i.lastUpdated),
      lastCountDate: i.lastCountDate ? new Date(i.lastCountDate) : undefined,
    })),
    usage: {
      ...data.usage,
      lastUsedDate: data.usage.lastUsedDate ? new Date(data.usage.lastUsedDate) : undefined,
    },
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  } as Material;
}
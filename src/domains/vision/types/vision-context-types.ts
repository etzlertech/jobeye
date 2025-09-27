// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/vision/types/vision-context-types.ts
// phase: 3
// domain: vision-pipeline
// purpose: Visual context analysis for item-location associations
// spec_ref: phase3/vision-pipeline#context-analysis
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: OPTIONAL
//
// dependencies:
//   internal:
//     - /src/domains/vision/types/vision-types
//     - /src/core/types/base-types
//   external:
//     - zod: ^3.22.0
//
// exports:
//   - VisionContext: interface - Complete scene analysis
//   - StorageLocation: interface - Vehicle/storage identification
//   - LoadingContext: interface - Loading operation context
//   - ItemPlacement: interface - Item-location relationship
//   - VisionContextSchema: zod schema
//
// voice_considerations: |
//   Natural language descriptions of loading operations.
//   Voice confirmation of item placements.
//   Voice alerts for incorrect loading.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/vision/types/vision-context-types.test.ts
//
// tasks:
//   1. Define storage location types
//   2. Create loading context types
//   3. Add item-location association types
//   4. Define scene analysis types
//   5. Create validation schemas
//   6. Add job requirement matching
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
import { DetectedObject, ObjectClass } from './vision-types';
import { Timestamped, TenantAware } from '@/core/types/base-types';

// Storage/transport location types
export enum LocationType {
  TRUCK_BED = 'truck_bed',
  VAN_CARGO = 'van_cargo',
  TRAILER_DUMP = 'trailer_dump',
  TRAILER_LOWBOY = 'trailer_lowboy',
  TRAILER_ENCLOSED = 'trailer_enclosed',
  STORAGE_BARN = 'storage_barn',
  STORAGE_SHOP = 'storage_shop',
  STORAGE_BIN = 'storage_bin',
  GROUND = 'ground',
  UNKNOWN = 'unknown',
}

// Vehicle/storage colors for identification
export enum LocationColor {
  RED = 'red',
  BLACK = 'black',
  WHITE = 'white',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow',
  GRAY = 'gray',
  ORANGE = 'orange',
  UNKNOWN = 'unknown',
}

// Storage location identification
export interface StorageLocation {
  id: string;
  type: LocationType;
  color?: LocationColor;
  vehicleId?: string; // VH-TKR, VH-VN1, etc.
  trailerId?: string; // TR-DU12R, TR-LB16A, etc.
  locationName?: string; // "Red dump trailer", "Shop bin A", etc.
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  attributes?: {
    licensePlate?: string;
    assetTag?: string;
    capacity?: string;
    currentLoad?: number; // percentage full
  };
}

// Item placement within a location
export interface ItemPlacement {
  item: DetectedObject;
  location: StorageLocation;
  position: {
    relativeX: number; // 0-1 within location bounds
    relativeY: number; // 0-1 within location bounds
    layer?: number; // stacking order
  };
  placementQuality: {
    isSecure: boolean;
    isAccessible: boolean;
    isProperlyOriented: boolean;
    issues?: string[];
  };
  confidence: number;
}

// Loading operation context
export interface LoadingContext {
  operationType: 'loading' | 'unloading' | 'organizing' | 'inventory';
  primaryLocation: StorageLocation;
  secondaryLocations?: StorageLocation[];
  detectedPeople?: Array<{
    boundingBox: any;
    role?: 'operator' | 'helper' | 'observer';
  }>;
  environmentalFactors?: {
    lighting: 'good' | 'fair' | 'poor';
    weather?: 'clear' | 'rain' | 'snow' | 'fog';
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  };
}

// Job load requirements
export interface LoadRequirement {
  itemType: 'equipment' | 'material';
  itemId: string;
  itemName: string;
  quantity: number;
  isRequired: boolean;
  specificUnit?: string; // "Unit #23", "Stihl MS271", etc.
  allowSubstitutes?: string[]; // Alternative items that could fulfill requirement
}

// Complete vision context analysis
export interface VisionContext extends Timestamped {
  id: string;
  tenantId: string;
  jobId?: string;
  imageUrl?: string;
  
  // Scene analysis
  locations: StorageLocation[];
  items: DetectedObject[];
  placements: ItemPlacement[];
  context: LoadingContext;
  
  // Job validation
  loadRequirements?: LoadRequirement[];
  requirementMatches?: Array<{
    requirement: LoadRequirement;
    fulfilledBy: Array<{
      item: DetectedObject;
      placement: ItemPlacement;
      matchConfidence: number;
    }>;
    status: 'fulfilled' | 'partial' | 'missing';
  }>;
  
  // Analysis results
  alerts?: Array<{
    type: 'missing_item' | 'wrong_location' | 'unsafe_placement' | 'extra_item';
    severity: 'info' | 'warning' | 'error';
    message: string;
    affectedItems?: string[];
  }>;
  
  // Metadata
  analysisTimeMs: number;
  modelVersion: string;
  confidence: {
    overall: number;
    locationDetection: number;
    itemDetection: number;
    placementAnalysis: number;
  };
}

// Loading validation result
export interface LoadingValidation {
  jobId: string;
  isComplete: boolean;
  isCorrect: boolean;
  completionPercentage: number;
  issues: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    suggestedAction?: string;
  }>;
  recommendations?: string[];
}

// Validation schemas

export const StorageLocationSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(LocationType),
  color: z.nativeEnum(LocationColor).optional(),
  vehicleId: z.string().optional(),
  trailerId: z.string().optional(),
  locationName: z.string().optional(),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  confidence: z.number().min(0).max(1),
  attributes: z.object({
    licensePlate: z.string().optional(),
    assetTag: z.string().optional(),
    capacity: z.string().optional(),
    currentLoad: z.number().min(0).max(100).optional(),
  }).optional(),
});

export const ItemPlacementSchema = z.object({
  item: z.any(), // DetectedObject from vision-types
  location: StorageLocationSchema,
  position: z.object({
    relativeX: z.number().min(0).max(1),
    relativeY: z.number().min(0).max(1),
    layer: z.number().optional(),
  }),
  placementQuality: z.object({
    isSecure: z.boolean(),
    isAccessible: z.boolean(),
    isProperlyOriented: z.boolean(),
    issues: z.array(z.string()).optional(),
  }),
  confidence: z.number().min(0).max(1),
});

export const LoadingContextSchema = z.object({
  operationType: z.enum(['loading', 'unloading', 'organizing', 'inventory']),
  primaryLocation: StorageLocationSchema,
  secondaryLocations: z.array(StorageLocationSchema).optional(),
  detectedPeople: z.array(z.object({
    boundingBox: z.any(),
    role: z.enum(['operator', 'helper', 'observer']).optional(),
  })).optional(),
  environmentalFactors: z.object({
    lighting: z.enum(['good', 'fair', 'poor']),
    weather: z.enum(['clear', 'rain', 'snow', 'fog']).optional(),
    timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  }).optional(),
});

export const LoadRequirementSchema = z.object({
  itemType: z.enum(['equipment', 'material']),
  itemId: z.string(),
  itemName: z.string(),
  quantity: z.number().positive(),
  isRequired: z.boolean(),
  specificUnit: z.string().optional(),
  allowSubstitutes: z.array(z.string()).optional(),
});

// Helper functions

export const isItemInLocation = (
  item: DetectedObject,
  location: StorageLocation,
  threshold: number = 0.5
): boolean => {
  if (!location.boundingBox) return false;
  
  const itemCenterX = item.boundingBox.x + item.boundingBox.width / 2;
  const itemCenterY = item.boundingBox.y + item.boundingBox.height / 2;
  
  const inBounds = 
    itemCenterX >= location.boundingBox.x &&
    itemCenterX <= location.boundingBox.x + location.boundingBox.width &&
    itemCenterY >= location.boundingBox.y &&
    itemCenterY <= location.boundingBox.y + location.boundingBox.height;
    
  // Also check overlap percentage
  const overlapX = Math.max(0, Math.min(
    item.boundingBox.x + item.boundingBox.width,
    location.boundingBox.x + location.boundingBox.width
  ) - Math.max(item.boundingBox.x, location.boundingBox.x));
  
  const overlapY = Math.max(0, Math.min(
    item.boundingBox.y + item.boundingBox.height,
    location.boundingBox.y + location.boundingBox.height
  ) - Math.max(item.boundingBox.y, location.boundingBox.y));
  
  const overlapArea = overlapX * overlapY;
  const itemArea = item.boundingBox.width * item.boundingBox.height;
  const overlapPercentage = overlapArea / itemArea;
  
  return inBounds || overlapPercentage >= threshold;
};

// Analyze placement quality
export const analyzePlacementQuality = (
  item: DetectedObject,
  location: StorageLocation,
  otherItems: DetectedObject[]
): ItemPlacement['placementQuality'] => {
  const issues: string[] = [];
  
  // Check if item is secure (not hanging over edge)
  const isSecure = location.boundingBox ? 
    isItemInLocation(item, location, 0.8) : true;
  
  if (!isSecure) {
    issues.push('Item partially outside storage area');
  }
  
  // Check if accessible (not blocked by other items)
  const isAccessible = !otherItems.some(other => {
    if (other.id === item.id) return false;
    // Simple check: is another item significantly overlapping from above?
    return other.boundingBox.y < item.boundingBox.y &&
           isOverlapping(item.boundingBox, other.boundingBox) > 0.5;
  });
  
  if (!isAccessible) {
    issues.push('Item blocked by other equipment');
  }
  
  // Check orientation (simplified - would need ML model for real detection)
  const isProperlyOriented = true; // Placeholder
  
  return {
    isSecure,
    isAccessible,
    isProperlyOriented,
    issues: issues.length > 0 ? issues : undefined,
  };
};

// Check bounding box overlap
const isOverlapping = (box1: any, box2: any): number => {
  const overlapX = Math.max(0, Math.min(
    box1.x + box1.width,
    box2.x + box2.width
  ) - Math.max(box1.x, box2.x));
  
  const overlapY = Math.max(0, Math.min(
    box1.y + box1.height,
    box2.y + box2.height
  ) - Math.max(box1.y, box2.y));
  
  const overlapArea = overlapX * overlapY;
  const box1Area = box1.width * box1.height;
  
  return overlapArea / box1Area;
};
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/vision/types/vision-types.ts
// phase: 3
// domain: vision-pipeline
// purpose: Core types for computer vision and object detection
// spec_ref: phase3/vision-pipeline#types
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: OPTIONAL
//
// dependencies:
//   internal:
//     - /src/core/types/base-types
//   external:
//     - zod: ^3.22.0
//
// exports:
//   - VisionResult: interface - Object detection result
//   - DetectedObject: interface - Single detected object
//   - ObjectClass: enum - Detectable object classes
//   - VisionProvider: enum - Vision API providers
//   - VisionResultSchema: zod schema
//   - DetectedObjectSchema: zod schema
//
// voice_considerations: |
//   Voice confirmation of detected objects.
//   Natural language object descriptions.
//   Voice-driven detection corrections.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/vision/types/vision-types.test.ts
//
// tasks:
//   1. Define object detection types
//   2. Create bounding box types
//   3. Add confidence scoring types
//   4. Define provider interfaces
//   5. Create validation schemas
//   6. Add equipment mapping types
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
import { BaseEntity, TenantAware, Timestamped, VoiceAware } from '@/core/types/base-types';

// Vision API providers
export enum VisionProvider {
  OPENAI_VISION = 'openai_vision',
  GOOGLE_VISION = 'google_vision',
  AZURE_VISION = 'azure_vision',
  AWS_REKOGNITION = 'aws_rekognition',
  OFFLINE_MODEL = 'offline_model',
}

// Detectable object classes for field service
export enum ObjectClass {
  // Power tools
  CHAINSAW = 'chainsaw',
  TRIMMER = 'trimmer',
  BLOWER = 'blower',
  MOWER = 'mower',
  EDGER = 'edger',
  HEDGE_TRIMMER = 'hedge_trimmer',
  PRESSURE_WASHER = 'pressure_washer',
  
  // Hand tools
  SHOVEL = 'shovel',
  RAKE = 'rake',
  HOE = 'hoe',
  PRUNERS = 'pruners',
  
  // Safety equipment
  SAFETY_CONE = 'safety_cone',
  HARD_HAT = 'hard_hat',
  SAFETY_VEST = 'safety_vest',
  GLOVES = 'gloves',
  SAFETY_GLASSES = 'safety_glasses',
  
  // Containers
  GAS_CAN = 'gas_can',
  OIL_CONTAINER = 'oil_container',
  CHEMICAL_CONTAINER = 'chemical_container',
  TOOLBOX = 'toolbox',
  
  // Materials
  PVC_PIPE = 'pvc_pipe',
  PVC_FITTING = 'pvc_fitting',
  SPRINKLER_HEAD = 'sprinkler_head',
  MULCH_BAG = 'mulch_bag',
  FERTILIZER_BAG = 'fertilizer_bag',
  
  // Vehicles
  TRUCK = 'truck',
  TRAILER = 'trailer',
  EQUIPMENT_RACK = 'equipment_rack',
  
  // Generic
  UNKNOWN_TOOL = 'unknown_tool',
  UNKNOWN_MATERIAL = 'unknown_material',
  PERSON = 'person',
  OTHER = 'other',
}

// Bounding box for detected objects
export interface BoundingBox {
  x: number; // Top-left X coordinate (0-1 normalized)
  y: number; // Top-left Y coordinate (0-1 normalized)
  width: number; // Width (0-1 normalized)
  height: number; // Height (0-1 normalized)
}

// Single detected object
export interface DetectedObject {
  id: string; // Unique ID for this detection
  class: ObjectClass;
  confidence: number; // 0-1 confidence score
  boundingBox: BoundingBox;
  label?: string; // Human-readable label
  attributes?: Record<string, any>; // Additional attributes (color, brand, etc.)
}

// Vision analysis result
export interface VisionResult extends Timestamped {
  id: string;
  tenantId: string;
  imageUrl?: string;
  imageData?: string; // Base64 encoded
  provider: VisionProvider;
  detectedObjects: DetectedObject[];
  processingTimeMs: number;
  metadata?: {
    imageWidth?: number;
    imageHeight?: number;
    location?: {
      latitude: number;
      longitude: number;
    };
    jobId?: string;
    userId?: string;
    deviceInfo?: Record<string, any>;
  };
  cost?: number; // API cost if applicable
}

// Equipment/material mapping
export interface ObjectToInventoryMapping {
  objectClass: ObjectClass;
  equipmentType?: string; // Maps to equipment type
  materialType?: string; // Maps to material type
  defaultName: string;
  searchKeywords: string[];
  requiredConfidence: number; // Minimum confidence to auto-match
}

// Vision scan request
export interface VisionScanRequest {
  imageData: string | ArrayBuffer | Blob;
  scanType: 'equipment_check' | 'material_count' | 'safety_inspection' | 'general';
  jobId?: string;
  expectedItems?: Array<{
    type: 'equipment' | 'material';
    id: string;
    name: string;
  }>;
  autoMatch?: boolean; // Automatically match to inventory
  includeUnknown?: boolean; // Include unrecognized objects
}

// Vision scan result with inventory matching
export interface VisionScanResult extends VisionResult {
  matchedItems: Array<{
    detectedObject: DetectedObject;
    inventoryType: 'equipment' | 'material';
    inventoryId: string;
    inventoryName: string;
    matchConfidence: number;
  }>;
  unmatchedObjects: DetectedObject[];
  missingExpectedItems?: Array<{
    type: 'equipment' | 'material';
    id: string;
    name: string;
  }>;
}

// Voice confirmation for vision results
export interface VisionVoiceConfirmation {
  resultId: string;
  action: 'confirm' | 'reject' | 'correct';
  objectId?: string;
  correction?: {
    actualClass?: ObjectClass;
    actualName?: string;
    actualCount?: number;
  };
}

// Validation schemas

export const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const DetectedObjectSchema = z.object({
  id: z.string(),
  class: z.nativeEnum(ObjectClass),
  confidence: z.number().min(0).max(1),
  boundingBox: BoundingBoxSchema,
  label: z.string().optional(),
  attributes: z.record(z.any()).optional(),
});

export const VisionResultSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  imageUrl: z.string().url().optional(),
  imageData: z.string().optional(),
  provider: z.nativeEnum(VisionProvider),
  detectedObjects: z.array(DetectedObjectSchema),
  processingTimeMs: z.number().positive(),
  metadata: z.object({
    imageWidth: z.number().positive().optional(),
    imageHeight: z.number().positive().optional(),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
    jobId: z.string().optional(),
    userId: z.string().optional(),
    deviceInfo: z.record(z.any()).optional(),
  }).optional(),
  cost: z.number().positive().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ObjectToInventoryMappingSchema = z.object({
  objectClass: z.nativeEnum(ObjectClass),
  equipmentType: z.string().optional(),
  materialType: z.string().optional(),
  defaultName: z.string(),
  searchKeywords: z.array(z.string()),
  requiredConfidence: z.number().min(0).max(1),
});

export const VisionScanRequestSchema = z.object({
  imageData: z.union([z.string(), z.instanceof(ArrayBuffer), z.instanceof(Blob)]),
  scanType: z.enum(['equipment_check', 'material_count', 'safety_inspection', 'general']),
  jobId: z.string().optional(),
  expectedItems: z.array(z.object({
    type: z.enum(['equipment', 'material']),
    id: z.string(),
    name: z.string(),
  })).optional(),
  autoMatch: z.boolean().optional(),
  includeUnknown: z.boolean().optional(),
});

// Type guards
export const isVisionResult = (obj: any): obj is VisionResult => {
  return VisionResultSchema.safeParse(obj).success;
};

export const isDetectedObject = (obj: any): obj is DetectedObject => {
  return DetectedObjectSchema.safeParse(obj).success;
};

// Default object mappings for field service
export const DEFAULT_OBJECT_MAPPINGS: ObjectToInventoryMapping[] = [
  // Power tools
  {
    objectClass: ObjectClass.CHAINSAW,
    equipmentType: 'power_tool',
    defaultName: 'Chainsaw',
    searchKeywords: ['chainsaw', 'chain saw', 'stihl', 'husqvarna'],
    requiredConfidence: 0.8,
  },
  {
    objectClass: ObjectClass.MOWER,
    equipmentType: 'power_tool',
    defaultName: 'Lawn Mower',
    searchKeywords: ['mower', 'lawn mower', 'push mower', 'riding mower'],
    requiredConfidence: 0.75,
  },
  {
    objectClass: ObjectClass.TRIMMER,
    equipmentType: 'power_tool',
    defaultName: 'String Trimmer',
    searchKeywords: ['trimmer', 'weed eater', 'string trimmer', 'weed whacker'],
    requiredConfidence: 0.8,
  },
  
  // Containers
  {
    objectClass: ObjectClass.GAS_CAN,
    materialType: 'fuel',
    defaultName: 'Gas Can',
    searchKeywords: ['gas can', 'fuel can', 'gasoline container'],
    requiredConfidence: 0.85,
  },
  
  // Materials
  {
    objectClass: ObjectClass.PVC_PIPE,
    materialType: 'plumbing',
    defaultName: 'PVC Pipe',
    searchKeywords: ['pvc', 'pipe', 'white pipe', 'plastic pipe'],
    requiredConfidence: 0.7,
  },
  {
    objectClass: ObjectClass.PVC_FITTING,
    materialType: 'plumbing',
    defaultName: 'PVC Fitting',
    searchKeywords: ['fitting', 'elbow', 'tee', 'coupling', 'pvc fitting'],
    requiredConfidence: 0.75,
  },
];
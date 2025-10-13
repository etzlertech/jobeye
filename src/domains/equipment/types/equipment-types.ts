// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/equipment/types/equipment-types.ts
// phase: 2
// domain: equipment-tracking
// purpose: Equipment domain types and validation schemas
// spec_ref: phase2/equipment-tracking#types
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   external:
//     - zod: ^3.23.8
//
// exports:
//   - Equipment: interface - Equipment entity
//   - EquipmentCreate: interface - Equipment creation payload
//   - EquipmentUpdate: interface - Equipment update payload
//   - EquipmentType: enum - Equipment types
//   - EquipmentState: enum - Equipment states
//   - MaintenanceRecord: interface - Maintenance history
//   - ValidationSchemas: object - Zod validation schemas
//
// voice_considerations: |
//   Support voice-friendly equipment identification.
//   Enable natural language model and serial number queries.
//   Track voice-recorded maintenance notes.
//   Support audible equipment status alerts.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/equipment/types/equipment-types.test.ts
//
// tasks:
//   1. Define equipment entity structure
//   2. Create equipment type enums
//   3. Define maintenance record types
//   4. Add validation schemas
//   5. Define voice command types
//   6. Add serialization helpers
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';

/**
 * Equipment types supported by the system
 */
export enum EquipmentType {
  MOWER = 'mower',
  TRIMMER = 'trimmer',
  BLOWER = 'blower',
  EDGER = 'edger',
  SPREADER = 'spreader',
  AERATOR = 'aerator',
  PRESSURE_WASHER = 'pressure_washer',
  IRRIGATION_CONTROLLER = 'irrigation_controller',
  IRRIGATION_VALVE = 'irrigation_valve',
  IRRIGATION_HEAD = 'irrigation_head',
  TRUCK = 'truck',
  TRAILER = 'trailer',
  OTHER = 'other',
}

/**
 * Equipment operational states
 */
export enum EquipmentState {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  REPAIR = 'repair',
  RETIRED = 'retired',
  LOST = 'lost',
}

/**
 * Equipment usage categories
 */
export enum EquipmentCategory {
  LAWN_CARE = 'lawn_care',
  IRRIGATION = 'irrigation',
  MAINTENANCE = 'maintenance',
  VEHICLE = 'vehicle',
  TOOL = 'tool',
}

/**
 * Equipment manufacturer information
 */
export interface EquipmentManufacturer {
  name: string;
  model: string;
  year?: number;
  website?: string;
  supportPhone?: string;
}

/**
 * Equipment specification details
 */
export interface EquipmentSpecs {
  engineType?: string;
  fuelType?: 'gas' | 'electric' | 'battery' | 'manual';
  power?: string; // e.g., "6.5 HP", "40V", "2000 PSI"
  weight?: number; // pounds
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  capacity?: string; // e.g., "21 inch cut", "5 gallon tank"
}

/**
 * Equipment location tracking
 */
export interface EquipmentLocation {
  type: 'property' | 'warehouse' | 'vehicle' | 'technician';
  id: string; // Property ID, warehouse ID, vehicle ID, or technician ID
  name: string; // Human-readable location name
  lastUpdated: Date;
  voiceConfirmed?: boolean;
}

/**
 * Equipment maintenance record
 */
export interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  type: 'preventive' | 'repair' | 'inspection' | 'cleaning';
  description: string;
  performedDate: Date;
  performedBy: string; // User ID
  cost?: number;
  partsUsed?: string[];
  notes?: string;
  voiceNotes?: string[];
  nextMaintenanceDate?: Date;
  warrantyWork?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Equipment usage tracking
 */
export interface EquipmentUsage {
  hoursUsed?: number;
  milesUsed?: number;
  cyclesCompleted?: number;
  lastUsedDate?: Date;
  averageUsagePerWeek?: number;
}

/**
 * Core equipment entity
 */
export interface Equipment {
  id: string;
  tenant_id: string;
  equipment_number: string;
  name: string;
  type: EquipmentType;
  category: EquipmentCategory;
  manufacturer: EquipmentManufacturer;
  serialNumber?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyExpiration?: Date;
  specs: EquipmentSpecs;
  state: EquipmentState;
  location: EquipmentLocation;
  usage: EquipmentUsage;
  maintenanceRecords?: MaintenanceRecord[];
  qrCode?: string;
  photos?: string[]; // URLs to equipment photos
  manuals?: string[]; // URLs to manual PDFs
  notes?: string;
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
 * Equipment creation payload
 */
export interface EquipmentCreate {
  name: string;
  type: EquipmentType;
  category: EquipmentCategory;
  manufacturer: EquipmentManufacturer;
  serialNumber?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyExpiration?: Date;
  specs?: Partial<EquipmentSpecs>;
  location: Omit<EquipmentLocation, 'lastUpdated'>;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  voiceMetadata?: {
    sessionId?: string;
    confidence?: number;
    recognizedText?: string;
  };
}

/**
 * Equipment update payload
 */
export interface EquipmentUpdate {
  name?: string;
  type?: EquipmentType;
  category?: EquipmentCategory;
  manufacturer?: Partial<EquipmentManufacturer>;
  serialNumber?: string;
  warrantyExpiration?: Date;
  specs?: Partial<EquipmentSpecs>;
  state?: EquipmentState;
  location?: Partial<EquipmentLocation>;
  usage?: Partial<EquipmentUsage>;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  is_active?: boolean;
}

/**
 * Equipment voice command types
 */
export interface EquipmentVoiceCommand {
  type: 'find' | 'status' | 'move' | 'maintenance' | 'report';
  equipment?: {
    name?: string;
    type?: EquipmentType;
    serialNumber?: string;
    location?: string;
  };
  action?: {
    newLocation?: string;
    maintenanceType?: string;
    notes?: string;
  };
  sessionId: string;
  confidence: number;
}

/**
 * Equipment search result
 */
export interface EquipmentSearchResult {
  equipment: Equipment;
  relevanceScore: number;
  matchReason: string;
  voiceMatch?: boolean;
}

// Validation schemas
export const equipmentCreateSchema = z.object({
  name: z.string().min(1, 'Equipment name is required'),
  type: z.nativeEnum(EquipmentType),
  category: z.nativeEnum(EquipmentCategory),
  manufacturer: z.object({
    name: z.string().min(1, 'Manufacturer name is required'),
    model: z.string().min(1, 'Model is required'),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
    website: z.string().url().optional(),
    supportPhone: z.string().optional(),
  }),
  serialNumber: z.string().optional(),
  purchaseDate: z.date().optional(),
  purchasePrice: z.number().positive().optional(),
  warrantyExpiration: z.date().optional(),
  specs: z.object({
    engineType: z.string().optional(),
    fuelType: z.enum(['gas', 'electric', 'battery', 'manual']).optional(),
    power: z.string().optional(),
    weight: z.number().positive().optional(),
    dimensions: z.object({
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
    }).optional(),
    capacity: z.string().optional(),
  }).optional(),
  location: z.object({
    type: z.enum(['property', 'warehouse', 'vehicle', 'technician']),
    id: z.string().min(1),
    name: z.string().min(1),
    voiceConfirmed: z.boolean().optional(),
  }),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.any()).optional(),
  voiceMetadata: z.object({
    sessionId: z.string().optional(),
    confidence: z.number().optional(),
    recognizedText: z.string().optional(),
  }).optional(),
});

export const equipmentUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(EquipmentType).optional(),
  category: z.nativeEnum(EquipmentCategory).optional(),
  manufacturer: z.object({
    name: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
    website: z.string().url().optional(),
    supportPhone: z.string().optional(),
  }).partial().optional(),
  serialNumber: z.string().optional(),
  warrantyExpiration: z.date().optional(),
  specs: z.object({
    engineType: z.string().optional(),
    fuelType: z.enum(['gas', 'electric', 'battery', 'manual']).optional(),
    power: z.string().optional(),
    weight: z.number().positive().optional(),
    dimensions: z.object({
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
    }).optional(),
    capacity: z.string().optional(),
  }).partial().optional(),
  state: z.nativeEnum(EquipmentState).optional(),
  location: z.object({
    type: z.enum(['property', 'warehouse', 'vehicle', 'technician']).optional(),
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    voiceConfirmed: z.boolean().optional(),
  }).partial().optional(),
  usage: z.object({
    hoursUsed: z.number().nonnegative().optional(),
    milesUsed: z.number().nonnegative().optional(),
    cyclesCompleted: z.number().nonnegative().optional(),
    lastUsedDate: z.date().optional(),
    averageUsagePerWeek: z.number().nonnegative().optional(),
  }).partial().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

export const maintenanceRecordSchema = z.object({
  type: z.enum(['preventive', 'repair', 'inspection', 'cleaning']),
  description: z.string().min(1, 'Description is required'),
  performedDate: z.date(),
  performedBy: z.string().min(1, 'Performed by is required'),
  cost: z.number().nonnegative().optional(),
  partsUsed: z.array(z.string()).default([]),
  notes: z.string().optional(),
  voiceNotes: z.array(z.string()).default([]),
  nextMaintenanceDate: z.date().optional(),
  warrantyWork: z.boolean().default(false),
});

/**
 * Type guards and helpers
 */
export function isEquipmentType(value: string): value is EquipmentType {
  return Object.values(EquipmentType).includes(value as EquipmentType);
}

export function isEquipmentState(value: string): value is EquipmentState {
  return Object.values(EquipmentState).includes(value as EquipmentState);
}

export function isEquipmentCategory(value: string): value is EquipmentCategory {
  return Object.values(EquipmentCategory).includes(value as EquipmentCategory);
}

/**
 * Equipment serialization helpers
 */
export function serializeEquipment(equipment: Equipment): Record<string, any> {
  return {
    ...equipment,
    purchaseDate: equipment.purchaseDate?.toISOString(),
    warrantyExpiration: equipment.warrantyExpiration?.toISOString(),
    location: {
      ...equipment.location,
      lastUpdated: equipment.location.lastUpdated.toISOString(),
    },
    usage: {
      ...equipment.usage,
      lastUsedDate: equipment.usage.lastUsedDate?.toISOString(),
    },
    createdAt: equipment.createdAt.toISOString(),
    updatedAt: equipment.updatedAt.toISOString(),
  };
}

export function deserializeEquipment(data: Record<string, any>): Equipment {
  return {
    ...data,
    purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
    warrantyExpiration: data.warrantyExpiration ? new Date(data.warrantyExpiration) : undefined,
    location: {
      ...data.location,
      lastUpdated: new Date(data.location.lastUpdated),
    },
    usage: {
      ...data.usage,
      lastUsedDate: data.usage.lastUsedDate ? new Date(data.usage.lastUsedDate) : undefined,
    },
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  } as Equipment;
}
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/equipment/types/container-types.ts
// phase: 4
// domain: equipment-tracking
// purpose: Types for loading containers (vehicles, trailers, storage locations)
// spec_ref: phase4/equipment-tracking#containers
// version: 2025-08-1
// complexity_budget: 200 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/core/types/base-types
//   external:
//     - zod: ^3.22.0
//
// exports:
//   - Container: interface - Container entity
//   - ContainerType: enum - Types of containers
//   - ContainerCreate: interface - Container creation data
//   - ContainerUpdate: interface - Container update data
//   - ContainerSchema: zod schema
//
// voice_considerations: |
//   Natural language container identification.
//   Voice editing of container assignments.
//   Default container suggestions.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/equipment/types/container-types.test.ts
//
// tasks:
//   1. Define container types and enums
//   2. Create container interfaces
//   3. Add validation schemas
//   4. Create type guards
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';

// Container types
export enum ContainerType {
  TRUCK = 'truck',
  VAN = 'van',
  TRAILER = 'trailer',
  STORAGE_BIN = 'storage_bin',
  GROUND = 'ground',
}

// Container colors for visual identification
export enum ContainerColor {
  RED = 'red',
  BLACK = 'black',
  WHITE = 'white',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow',
  GRAY = 'gray',
  ORANGE = 'orange',
  SILVER = 'silver',
  OTHER = 'other',
}

// Capacity information
export interface CapacityInfo {
  dimensions?: {
    length?: number; // feet
    width?: number; // feet
    height?: number; // feet
  };
  weightLimit?: number; // pounds
  volumeLimit?: number; // cubic feet
  itemLimit?: number; // max number of items
}

// Container entity
export interface Container {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  containerType: ContainerType;
  identifier: string; // e.g., 'VH-TKR', 'TR-DU12R'
  name: string; // e.g., 'Red Truck', 'Black Lowboy'
  color?: ContainerColor;
  capacityInfo?: CapacityInfo;
  primaryImageUrl?: string;
  additionalImageUrls?: string[];
  isDefault: boolean;
  isActive: boolean;
  metadata: Record<string, any>;
}

// Container creation data
export interface ContainerCreate {
  containerType: ContainerType;
  identifier: string;
  name: string;
  color?: ContainerColor;
  capacityInfo?: CapacityInfo;
  primaryImageUrl?: string;
  additionalImageUrls?: string[];
  isDefault?: boolean;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

// Container update data
export interface ContainerUpdate {
  name?: string;
  color?: ContainerColor;
  capacityInfo?: CapacityInfo;
  primaryImageUrl?: string;
  additionalImageUrls?: string[];
  isDefault?: boolean;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

// Voice command for containers
export interface ContainerVoiceCommand {
  action: 'select' | 'change' | 'list';
  containerIdentifier?: string;
  itemReference?: string; // "put the chainsaw in the red truck"
}

// Container assignment
export interface ContainerAssignment {
  itemId: string;
  itemType: 'equipment' | 'material';
  containerId: string;
  quantity: number;
  assignedAt: Date;
  assignedBy: string;
}

// Container search filters
export interface ContainerFilters {
  containerType?: ContainerType;
  color?: ContainerColor;
  isActive?: boolean;
  isDefault?: boolean;
  hasCapacity?: boolean;
  searchTerm?: string;
}

// Validation schemas

export const CapacityInfoSchema = z.object({
  dimensions: z.object({
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }).optional(),
  weightLimit: z.number().positive().optional(),
  volumeLimit: z.number().positive().optional(),
  itemLimit: z.number().int().positive().optional(),
}).optional();

export const ContainerSchema = z.object({
  containerType: z.nativeEnum(ContainerType),
  identifier: z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/, 'Identifier must be uppercase alphanumeric with hyphens'),
  name: z.string().min(1).max(100),
  color: z.nativeEnum(ContainerColor).optional(),
  capacityInfo: CapacityInfoSchema,
  primaryImageUrl: z.string().url().optional(),
  additionalImageUrls: z.array(z.string().url()).optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
});

export const ContainerCreateSchema = ContainerSchema;

export const ContainerUpdateSchema = ContainerSchema.partial().omit({
  containerType: true,
  identifier: true,
});

export const ContainerVoiceCommandSchema = z.object({
  action: z.enum(['select', 'change', 'list']),
  containerIdentifier: z.string().optional(),
  itemReference: z.string().optional(),
});

// Type guards
export const isContainer = (obj: any): obj is Container => {
  return ContainerSchema.safeParse(obj).success;
};

export const isContainerCreate = (obj: any): obj is ContainerCreate => {
  return ContainerCreateSchema.safeParse(obj).success;
};

// Helper functions

export const getContainerDisplayName = (container: Container): string => {
  return `${container.name} (${container.identifier})`;
};

export const getContainerCapacityPercentage = (
  container: Container,
  currentItemCount: number
): number | null => {
  if (!container.capacityInfo?.itemLimit) return null;
  return Math.round((currentItemCount / container.capacityInfo.itemLimit) * 100);
};

// Default containers for common setups
export const DEFAULT_CONTAINERS: Partial<ContainerCreate>[] = [
  {
    containerType: ContainerType.TRUCK,
    identifier: 'VH-TRK1',
    name: 'Primary Truck',
    color: ContainerColor.WHITE,
    isDefault: true,
  },
  {
    containerType: ContainerType.TRAILER,
    identifier: 'TR-001',
    name: 'Equipment Trailer',
    color: ContainerColor.BLACK,
  },
  {
    containerType: ContainerType.STORAGE_BIN,
    identifier: 'SHOP-A',
    name: 'Shop Storage A',
    capacityInfo: {
      itemLimit: 50,
    },
  },
];

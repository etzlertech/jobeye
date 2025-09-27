// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/property/types/property-types.ts
// phase: 2
// domain: property-management
// purpose: Define property domain types with voice metadata and geolocation support
// spec_ref: phase2/property-management#types
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/customer/types/customer-types
//   external:
//     - zod: ^3.23.8
//
// exports:
//   - Property: interface - Core property entity
//   - PropertyCreate: interface - Property creation payload
//   - PropertyUpdate: interface - Property update payload
//   - ServiceLocation: interface - Service-specific location details
//   - PropertyType: enum - Property classification
//   - PropertyState: enum - Property lifecycle states
//   - PropertyVoiceProfile: interface - Voice recognition metadata
//   - PropertySearchResult: interface - Search result with confidence
//   - propertySchema: ZodSchema - Validation schema
//
// voice_considerations: |
//   Store phonetic addresses for voice recognition.
//   Support landmark-based descriptions.
//   Enable voice-friendly property nicknames.
//   Track gate codes and access instructions in voice-readable format.
//
// test_requirements:
//   coverage: 95%
//   test_files:
//     - src/__tests__/domains/property/types/property-types.test.ts
//
// tasks:
//   1. Define core property interfaces
//   2. Add geolocation types
//   3. Create service location types
//   4. Add voice metadata types
//   5. Define validation schemas
//   6. Add state machine types
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
import { Customer } from '@/domains/customer/types/customer-types';

/**
 * Property type classifications
 */
export enum PropertyType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  INDUSTRIAL = 'industrial',
  AGRICULTURAL = 'agricultural',
  VACANT_LAND = 'vacant_land',
  MIXED_USE = 'mixed_use',
}

/**
 * Property lifecycle states
 */
export enum PropertyState {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SCHEDULED = 'scheduled',
}

/**
 * Service-specific location details
 */
export interface ServiceLocation {
  id: string;
  propertyId: string;
  gateCode?: string;
  accessInstructions?: string;
  petWarnings?: string;
  equipmentLocation?: string;
  shutoffLocations?: {
    water?: string;
    gas?: string;
    electrical?: string;
  };
  specialInstructions?: string;
  bestTimeToService?: string;
  voiceNotes?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Geolocation data
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  source: 'gps' | 'geocoding' | 'manual';
  timestamp: Date;
}

/**
 * Address components for structured storage
 */
export interface Address {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  formatted?: string; // Full formatted address
  landmarks?: string[]; // Nearby landmarks for voice reference
}

/**
 * Voice metadata for property recognition
 */
export interface PropertyVoiceProfile {
  propertyId: string;
  nickname?: string; // "The Smith house"
  phoneticAddress?: string; // How to pronounce the address
  landmarks: string[]; // "Near the water tower"
  alternateNames: string[]; // Other names used to refer to property
  commonMispronunciations?: string[]; // Common voice recognition errors
  voiceSearchHits: number; // Track successful voice searches
  lastVoiceUpdate?: Date;
}

/**
 * Core property entity
 */
export interface Property {
  id: string;
  tenant_id: string;
  customerId: string;
  customer?: Customer; // Populated on joins
  property_number: string; // Unique identifier like PROP-ABC-123
  name: string; // Property display name
  
  // Address information
  address: Address;
  location?: GeoLocation;
  
  // Property details
  type: PropertyType;
  size?: number; // Square footage
  lotSize?: number; // Lot size in square feet
  yearBuilt?: number;
  stories?: number;
  
  // Service information
  serviceLocation?: ServiceLocation;
  lastServiceDate?: Date;
  nextServiceDate?: Date;
  serviceFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'as_needed';
  
  // Voice metadata
  voiceProfile?: PropertyVoiceProfile;
  
  // State management
  state: PropertyState;
  is_active: boolean;
  
  // Metadata
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Property creation payload
 */
export interface PropertyCreate {
  customerId: string;
  address: Address;
  type: PropertyType;
  location?: Partial<GeoLocation>;
  size?: number;
  lotSize?: number;
  yearBuilt?: number;
  stories?: number;
  notes?: string;
  tags?: string[];
  serviceFrequency?: Property['serviceFrequency'];
  voiceMetadata?: {
    nickname?: string;
    landmarks?: string[];
  };
}

/**
 * Property update payload
 */
export interface PropertyUpdate {
  address?: Partial<Address>;
  type?: PropertyType;
  location?: Partial<GeoLocation>;
  size?: number;
  lotSize?: number;
  yearBuilt?: number;
  stories?: number;
  notes?: string;
  tags?: string[];
  serviceFrequency?: Property['serviceFrequency'];
  state?: PropertyState;
  is_active?: boolean;
}

/**
 * Property search result with voice context
 */
export interface PropertySearchResult {
  property: Property;
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'landmark' | 'nearby';
  confidence: number;
  matchedField: string;
  distance?: number; // For proximity searches
  voiceContext?: {
    spokenQuery: string;
    interpretedQuery: string;
    landmarks?: string[];
  };
  highlightedText?: string;
}

/**
 * Voice command types for property operations
 */
export interface PropertyVoiceCommand {
  type: 'find_property' | 'create_property' | 'update_property' | 
        'add_service_note' | 'update_gate_code' | 'schedule_service' |
        'list_properties' | 'property_details';
  customerId?: string;
  propertyId?: string;
  query?: string;
  address?: Partial<Address>;
  gateCode?: string;
  note?: string;
  serviceDate?: Date;
  [key: string]: any;
}

/**
 * Property state transitions
 */
export interface PropertyStateTransition {
  from: PropertyState;
  to: PropertyState;
  reason?: string;
  scheduledDate?: Date;
  performedBy?: string;
  timestamp?: Date;
}

/**
 * Validation schemas
 */
export const addressSchema = z.object({
  street: z.string().min(1),
  unit: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().default('US'),
  formatted: z.string().optional(),
  landmarks: z.array(z.string()).optional(),
});

export const geoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  altitude: z.number().optional(),
  source: z.enum(['gps', 'geocoding', 'manual']),
  timestamp: z.date(),
});

export const propertyCreateSchema = z.object({
  customerId: z.string().uuid(),
  address: addressSchema,
  type: z.nativeEnum(PropertyType),
  location: geoLocationSchema.partial().optional(),
  size: z.number().positive().optional(),
  lotSize: z.number().positive().optional(),
  yearBuilt: z.number().min(1800).max(new Date().getFullYear()).optional(),
  stories: z.number().positive().max(100).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  serviceFrequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'as_needed']).optional(),
  voiceMetadata: z.object({
    nickname: z.string().optional(),
    landmarks: z.array(z.string()).optional(),
  }).optional(),
});

export const propertyUpdateSchema = propertyCreateSchema.partial().omit({ customerId: true });

export const serviceLocationSchema = z.object({
  gateCode: z.string().regex(/^\d{4,10}$/).optional(),
  accessInstructions: z.string().max(500).optional(),
  petWarnings: z.string().max(200).optional(),
  equipmentLocation: z.string().max(200).optional(),
  shutoffLocations: z.object({
    water: z.string().optional(),
    gas: z.string().optional(),
    electrical: z.string().optional(),
  }).optional(),
  specialInstructions: z.string().max(500).optional(),
  bestTimeToService: z.string().optional(),
  voiceNotes: z.array(z.string()).optional(),
});

/**
 * Type guards
 */
export function isProperty(obj: any): obj is Property {
  return obj && typeof obj === 'object' && 'id' in obj && 'address' in obj && 'type' in obj;
}

export function isValidPropertyType(type: string): type is PropertyType {
  return Object.values(PropertyType).includes(type as PropertyType);
}

export function isValidPropertyState(state: string): state is PropertyState {
  return Object.values(PropertyState).includes(state as PropertyState);
}

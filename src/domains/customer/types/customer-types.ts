// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/customer/types/customer-types.ts
// phase: 2
// domain: customer-management
// purpose: Define comprehensive type definitions for customer domain including contacts, addresses, and voice metadata
// spec_ref: phase2/customer-management#types
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/types/supabase
//   external:
//     - zod: ^3.23.8
//
// exports:
//   - Customer: interface - Complete customer entity
//   - Contact: interface - Customer contact person
//   - Address: interface - Physical address structure
//   - CustomerTag: interface - Customer categorization
//   - CustomerNote: interface - Customer interaction notes
//   - CustomerSearchResult: interface - Voice-friendly search result
//   - CustomerVoiceCommand: type - Voice command patterns
//   - CustomerStatus: enum - Customer lifecycle states
//
// voice_considerations: |
//   Types must support voice-friendly identifiers and phonetic matching.
//   Include confidence scores for voice-based lookups.
//   Support voice session context for customer interactions.
//
// test_requirements:
//   coverage: 100%
//   test_files:
//     - src/__tests__/domains/customer/types/customer-types.test.ts
//
// tasks:
//   1. Define core customer interface with all fields
//   2. Create contact person type with roles
//   3. Define address types for billing/service locations  
//   4. Add voice metadata types
//   5. Create search result types with confidence scoring
//   6. Define validation schemas using Zod
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
import { Database } from '@/types/supabase';

// Base database types
export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

// Customer lifecycle states
export enum CustomerStatus {
  PROSPECT = 'prospect',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

// Contact roles
export enum ContactRole {
  PRIMARY = 'primary',
  BILLING = 'billing',
  SERVICE = 'service',
  EMERGENCY = 'emergency',
  OTHER = 'other',
}

// Address types
export enum AddressType {
  BILLING = 'billing',
  SERVICE = 'service',
  BOTH = 'both',
}

// Core interfaces
export interface Address {
  id?: string;
  type: AddressType;
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string; // Google Places ID
  accessNotes?: string; // Gate codes, special instructions
  isDefault: boolean;
  voiceNavigationHint?: string; // "Blue house with red door"
}

export interface Contact {
  id: string;
  customerId: string;
  role: ContactRole;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  isPrimary: boolean;
  canReceiveSMS: boolean;
  canReceiveEmail: boolean;
  preferredContactMethod: 'phone' | 'email' | 'sms';
  voiceRecognitionId?: string; // For voice caller ID
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerTag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  isSystem: boolean; // System-generated vs user-created
}

export interface CustomerNote {
  id: string;
  customerId: string;
  userId: string;
  noteType: 'general' | 'service' | 'billing' | 'voice_transcript';
  content: string;
  metadata?: Record<string, any>;
  voiceSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer extends CustomerRow {
  // Extended fields beyond database
  contacts?: Contact[];
  addresses?: Address[];
  tags?: CustomerTag[];
  notes?: CustomerNote[];
  propertyCount?: number;
  activeJobCount?: number;
  lastServiceDate?: Date;
  nextScheduledService?: Date;
  totalRevenue?: number;
  outstandingBalance?: number;
  voiceProfile?: CustomerVoiceProfile;
}

// Voice-specific types
export interface CustomerVoiceProfile {
  customerId: string;
  phoneticName?: string; // How the name sounds
  alternateNames: string[]; // Nicknames, variations
  voiceNotes?: string; // "Pronounce as 'Sm-eye-th' not 'Smith'"
  preferredGreeting?: string;
  lastVoiceInteraction?: Date;
  voiceInteractionCount: number;
}

export interface CustomerSearchResult {
  customer: Customer;
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'partial';
  confidence: number; // 0-1 score
  matchedField: 'name' | 'phone' | 'email' | 'customer_number' | 'address';
  highlightedText?: string; // For UI display
  voiceContext?: {
    spokenQuery: string;
    interpretedQuery: string;
    alternativeMatches?: CustomerSearchResult[];
  };
}

// Voice command patterns
export type CustomerVoiceCommand = 
  | { type: 'find_customer'; query: string }
  | { type: 'create_customer'; name: string; phone?: string }
  | { type: 'update_customer'; customerId: string; field: string; value: any }
  | { type: 'add_note'; customerId: string; content: string }
  | { type: 'list_properties'; customerId: string }
  | { type: 'customer_history'; customerId: string; timeframe?: string };

// Offline sync types
export interface CustomerOfflineOperation {
  id: string;
  operationType: 'create' | 'update' | 'delete';
  entityType: 'customer' | 'contact' | 'address' | 'note';
  entityId?: string;
  data: any;
  timestamp: Date;
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

// Validation schemas
export const addressSchema = z.object({
  type: z.enum(['billing', 'service', 'both']),
  street: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().default('US'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  placeId: z.string().optional(),
  accessNotes: z.string().optional(),
  isDefault: z.boolean(),
  voiceNavigationHint: z.string().optional(),
});

export const contactSchema = z.object({
  role: z.nativeEnum(ContactRole),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\d{3}-\d{3}-\d{4}$/).optional(),
  mobilePhone: z.string().regex(/^\d{3}-\d{3}-\d{4}$/).optional(),
  isPrimary: z.boolean(),
  canReceiveSMS: z.boolean().default(true),
  canReceiveEmail: z.boolean().default(true),
  preferredContactMethod: z.enum(['phone', 'email', 'sms']),
  notes: z.string().optional(),
});

export const customerCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\d{3}-\d{3}-\d{4}$/),
  mobilePhone: z.string().regex(/^\d{3}-\d{3}-\d{4}$/).optional(),
  billingAddress: addressSchema.optional(),
  serviceAddress: addressSchema.optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

// Utility types
export type CustomerWithRelations = Customer & {
  contacts: Contact[];
  addresses: Address[];
  tags: CustomerTag[];
  recentNotes: CustomerNote[];
};

export type CustomerSummary = Pick<
  Customer,
  'id' | 'customer_number' | 'name' | 'email' | 'phone' | 'is_active'
> & {
  primaryContact?: Contact;
  defaultServiceAddress?: Address;
};
export enum OfflineOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  entityId: string;
  data: Record<string, unknown>;
  tenantId: string;
  timestamp: Date;
  version?: number;
}

export interface SyncConflict {
  operationId: string;
  type: 'version_mismatch' | 'entity_exists' | 'entity_not_found';
  localData?: Record<string, unknown>;
  remoteData?: Record<string, unknown>;
  message: string;
}

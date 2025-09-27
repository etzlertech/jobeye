// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/job/types/job-types.ts
// phase: 4
// domain: job-execution
// purpose: Core job management types with state machine and voice support
// spec_ref: phase4/job-execution#types
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/customer/types/customer-types
//     - /src/domains/property/types/property-types
//   external:
//     - zod: ^3.22.0
//
// exports:
//   - Job: interface - Core job entity
//   - JobStatus: enum - Job lifecycle states
//   - JobPriority: enum - Job priority levels
//   - JobType: enum - Service type classification
//   - JobCreate: interface - Job creation payload
//   - JobUpdate: interface - Job update payload
//   - jobCreateSchema: schema - Validation for job creation
//   - jobUpdateSchema: schema - Validation for job updates
//
// voice_considerations: |
//   Support voice job creation and status updates.
//   Enable natural language job descriptions.
//   Voice confirmation for critical state changes.
//   Audio notes and voice memos for jobs.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/job/types/job-types.test.ts
//
// tasks:
//   1. Define job entity with complete lifecycle
//   2. Create job status state machine
//   3. Add voice metadata support
//   4. Implement Zod validation schemas
//   5. Add job type classifications
//   6. Create recurring job patterns
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';

// Job Status State Machine
export enum JobStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REQUIRES_FOLLOWUP = 'requires_followup',
}

// Job Priority Levels
export enum JobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

// Job Type Classifications
export enum JobType {
  LAWN_CARE = 'lawn_care',
  LANDSCAPING = 'landscaping',
  IRRIGATION_INSTALL = 'irrigation_install',
  IRRIGATION_REPAIR = 'irrigation_repair',
  IRRIGATION_MAINTENANCE = 'irrigation_maintenance',
  PEST_CONTROL = 'pest_control',
  FERTILIZATION = 'fertilization',
  AERATION = 'aeration',
  SEEDING = 'seeding',
  TREE_SERVICE = 'tree_service',
  CLEANUP = 'cleanup',
  CONSULTATION = 'consultation',
  EMERGENCY_REPAIR = 'emergency_repair',
  SEASONAL_PREP = 'seasonal_prep',
  OTHER = 'other',
}

// Recurring Job Patterns
export enum JobRecurrence {
  NONE = 'none',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEASONALLY = 'seasonally',
  ANNUALLY = 'annually',
  CUSTOM = 'custom',
}

// Job Location Information
export interface JobLocation {
  type: 'property' | 'address' | 'coordinates';
  propertyId?: string;
  propertyName?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  accessInstructions?: string;
  parkingInstructions?: string;
}

// Job Scheduling Information
export interface JobSchedule {
  scheduledDate: Date;
  estimatedStartTime?: string; // HH:mm format
  estimatedDuration?: number; // minutes
  timeWindow?: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
  actualStartTime?: Date;
  actualEndTime?: Date;
  actualDuration?: number; // minutes
}

// Job Assignment Information
export interface JobAssignment {
  assignedTo?: string; // user ID
  assignedBy?: string; // user ID
  assignedAt?: Date;
  teamMembers?: string[]; // user IDs
  equipmentAssigned?: string[]; // equipment IDs
  materialsAllocated?: Array<{
    materialId: string;
    quantity: number;
    unit: string;
  }>;
}

// Job Pricing Information
export interface JobPricing {
  estimatedCost: number;
  quotedPrice?: number;
  actualCost?: number;
  finalPrice?: number;
  laborHours?: number;
  laborRate?: number;
  materialCosts?: number;
  equipmentCosts?: number;
  markupPercentage?: number;
  taxAmount?: number;
  currency: string;
}

// Job Completion Information
export interface JobCompletion {
  completedAt?: Date;
  completedBy?: string; // user ID
  qualityScore?: number; // 1-10
  customerSatisfaction?: number; // 1-5
  notes?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  workPerformed?: string[];
  materialsUsed?: Array<{
    materialId: string;
    quantity: number;
    unit: string;
  }>;
  equipmentUsed?: string[];
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
}

// Voice Metadata for Jobs
export interface JobVoiceMetadata {
  createdViaVoice?: boolean;
  voiceInstructions?: Array<{
    timestamp: Date;
    audioUrl?: string;
    transcription: string;
    userId: string;
  }>;
  voiceUpdates?: Array<{
    timestamp: Date;
    audioUrl?: string;
    transcription: string;
    updateType: string;
    userId: string;
  }>;
}

// Core Job Entity
export interface Job {
  id: string;
  tenant_id: string;
  job_number: string;
  
  // Basic Information
  title: string;
  description: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  
  // Customer and Location
  customerId: string;
  customerName?: string;
  location: JobLocation;
  
  // Scheduling
  schedule: JobSchedule;
  recurrence?: JobRecurrence;
  parentJobId?: string; // For recurring jobs
  
  // Assignment
  assignment: JobAssignment;
  
  // Financial
  pricing: JobPricing;
  
  // Completion
  completion?: JobCompletion;
  
  // Voice Support
  voiceMetadata?: JobVoiceMetadata;
  
  // Metadata
  tags: string[];
  customFields: Record<string, any>;
  templateId?: string;
  externalId?: string; // For integrations
  
  // System Fields
  is_active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// Job Creation Schema
const jobLocationSchema = z.object({
  type: z.enum(['property', 'address', 'coordinates']),
  propertyId: z.string().optional(),
  propertyName: z.string().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().optional(),
  }).optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  accessInstructions: z.string().optional(),
  parkingInstructions: z.string().optional(),
});

const jobScheduleSchema = z.object({
  scheduledDate: z.date(),
  estimatedStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  estimatedDuration: z.number().min(1).optional(),
  timeWindow: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
});

export const jobCreateSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  description: z.string().min(1, 'Job description is required'),
  type: z.nativeEnum(JobType),
  priority: z.nativeEnum(JobPriority).default(JobPriority.NORMAL),
  customerId: z.string().min(1, 'Customer ID is required'),
  location: jobLocationSchema,
  schedule: jobScheduleSchema,
  recurrence: z.nativeEnum(JobRecurrence).default(JobRecurrence.NONE),
  parentJobId: z.string().optional(),
  estimatedCost: z.number().min(0).default(0),
  quotedPrice: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  assignedTo: z.string().optional(),
  teamMembers: z.array(z.string()).default([]),
  equipmentAssigned: z.array(z.string()).default([]),
  materialsAllocated: z.array(z.object({
    materialId: z.string(),
    quantity: z.number().min(0),
    unit: z.string(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.any()).default({}),
  templateId: z.string().optional(),
  externalId: z.string().optional(),
  voiceMetadata: z.object({
    createdViaVoice: z.boolean().default(false),
    voiceInstructions: z.array(z.object({
      timestamp: z.date(),
      audioUrl: z.string().optional(),
      transcription: z.string(),
      userId: z.string(),
    })).default([]),
  }).optional(),
});

// Job Update Schema
export const jobUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: z.nativeEnum(JobType).optional(),
  priority: z.nativeEnum(JobPriority).optional(),
  status: z.nativeEnum(JobStatus).optional(),
  schedule: jobScheduleSchema.partial().optional(),
  assignment: z.object({
    assignedTo: z.string().optional(),
    teamMembers: z.array(z.string()).optional(),
    equipmentAssigned: z.array(z.string()).optional(),
    materialsAllocated: z.array(z.object({
      materialId: z.string(),
      quantity: z.number().min(0),
      unit: z.string(),
    })).optional(),
  }).optional(),
  pricing: z.object({
    estimatedCost: z.number().min(0).optional(),
    quotedPrice: z.number().min(0).optional(),
    actualCost: z.number().min(0).optional(),
    finalPrice: z.number().min(0).optional(),
    laborHours: z.number().min(0).optional(),
    laborRate: z.number().min(0).optional(),
    materialCosts: z.number().min(0).optional(),
    equipmentCosts: z.number().min(0).optional(),
    markupPercentage: z.number().min(0).max(100).optional(),
    taxAmount: z.number().min(0).optional(),
  }).optional(),
  completion: z.object({
    completedAt: z.date().optional(),
    completedBy: z.string().optional(),
    qualityScore: z.number().min(1).max(10).optional(),
    customerSatisfaction: z.number().min(1).max(5).optional(),
    notes: z.string().optional(),
    beforePhotos: z.array(z.string()).optional(),
    afterPhotos: z.array(z.string()).optional(),
    workPerformed: z.array(z.string()).optional(),
    materialsUsed: z.array(z.object({
      materialId: z.string(),
      quantity: z.number().min(0),
      unit: z.string(),
    })).optional(),
    equipmentUsed: z.array(z.string()).optional(),
    followUpRequired: z.boolean().optional(),
    followUpDate: z.date().optional(),
    followUpNotes: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

// Type Exports for Creation/Update
export type JobCreate = z.infer<typeof jobCreateSchema>;
export type JobUpdate = z.infer<typeof jobUpdateSchema>;

// Type Guards
export const isJobStatus = (value: string): value is JobStatus => {
  return Object.values(JobStatus).includes(value as JobStatus);
};

export const isJobType = (value: string): value is JobType => {
  return Object.values(JobType).includes(value as JobType);
};

export const isJobPriority = (value: string): value is JobPriority => {
  return Object.values(JobPriority).includes(value as JobPriority);
};

// Job State Machine Validations
export const getValidStatusTransitions = (currentStatus: JobStatus): JobStatus[] => {
  switch (currentStatus) {
    case JobStatus.DRAFT:
      return [JobStatus.SCHEDULED, JobStatus.CANCELLED];
    case JobStatus.SCHEDULED:
      return [JobStatus.ASSIGNED, JobStatus.CANCELLED, JobStatus.DRAFT];
    case JobStatus.ASSIGNED:
      return [JobStatus.IN_PROGRESS, JobStatus.ON_HOLD, JobStatus.CANCELLED, JobStatus.SCHEDULED];
    case JobStatus.IN_PROGRESS:
      return [JobStatus.COMPLETED, JobStatus.ON_HOLD, JobStatus.REQUIRES_FOLLOWUP];
    case JobStatus.ON_HOLD:
      return [JobStatus.IN_PROGRESS, JobStatus.CANCELLED, JobStatus.SCHEDULED];
    case JobStatus.COMPLETED:
      return [JobStatus.REQUIRES_FOLLOWUP];
    case JobStatus.REQUIRES_FOLLOWUP:
      return [JobStatus.COMPLETED];
    case JobStatus.CANCELLED:
      return [JobStatus.DRAFT]; // Can recreate from cancelled
    default:
      return [];
  }
};

export const isValidStatusTransition = (from: JobStatus, to: JobStatus): boolean => {
  return getValidStatusTransitions(from).includes(to);
};
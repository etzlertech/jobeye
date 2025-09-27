// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/job-templates/types/job-template-types.ts
// phase: 4
// domain: job-execution
// purpose: Job template types for standardized workflow creation
// spec_ref: phase4/job-execution#templates
// version: 2025-08-1
// complexity_budget: 250 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/job/types/job-types
//   external:
//     - zod: ^3.22.0
//
// exports:
//   - JobTemplate: interface - Template entity
//   - TemplateStep: interface - Workflow step definition
//   - TemplateCreate: interface - Template creation payload
//   - jobTemplateCreateSchema: schema - Validation schema
//
// voice_considerations: |
//   Support voice template creation and modification.
//   Voice-guided workflow execution.
//   Natural language step descriptions.
//   Voice confirmation for critical steps.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/job-templates/types/job-template-types.test.ts
//
// tasks:
//   1. Define job template structure
//   2. Create workflow step definitions
//   3. Add template validation schemas
//   4. Implement template inheritance
//   5. Add voice metadata support
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
import { JobType, JobPriority } from '@/domains/job/types/job-types';

// Template Step Types
export enum StepType {
  INSPECTION = 'inspection',
  PREPARATION = 'preparation',
  EXECUTION = 'execution',
  QUALITY_CHECK = 'quality_check',
  CLEANUP = 'cleanup',
  DOCUMENTATION = 'documentation',
  CUSTOMER_INTERACTION = 'customer_interaction',
  SAFETY_CHECK = 'safety_check',
}

// Step Status for tracking progress
export enum StepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

// Template Step Definition
export interface TemplateStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  type: StepType;
  estimatedDuration: number; // minutes
  isRequired: boolean;
  isCritical: boolean; // Requires extra verification
  
  // Voice Support
  voiceInstructions?: string;
  voiceConfirmationRequired?: boolean;
  
  // Dependencies
  dependsOn?: string[]; // Step IDs that must be completed first
  blocksSteps?: string[]; // Step IDs that cannot start until this is done
  
  // Materials and Equipment
  requiredEquipment?: Array<{
    equipmentType: string;
    quantity: number;
    isOptional: boolean;
  }>;
  requiredMaterials?: Array<{
    materialType: string;
    quantity: number;
    unit: string;
    isOptional: boolean;
  }>;
  
  // Quality Checks
  qualityChecks?: Array<{
    id: string;
    description: string;
    type: 'visual' | 'measurement' | 'test' | 'photo';
    isRequired: boolean;
    acceptanceCriteria?: string;
  }>;
  
  // Documentation Requirements
  photosRequired?: Array<{
    type: 'before' | 'during' | 'after';
    description: string;
    isRequired: boolean;
  }>;
  notesRequired?: boolean;
  customerSignatureRequired?: boolean;
  
  // Conditional Logic
  skipConditions?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  }>;
  
  // Custom Fields
  customFields?: Record<string, any>;
}

// Template Category
export enum TemplateCategory {
  LAWN_CARE = 'lawn_care',
  LANDSCAPING = 'landscaping',
  IRRIGATION = 'irrigation',
  PEST_CONTROL = 'pest_control',
  MAINTENANCE = 'maintenance',
  INSTALLATION = 'installation',
  REPAIR = 'repair',
  INSPECTION = 'inspection',
  CONSULTATION = 'consultation',
  EMERGENCY = 'emergency',
}

// Template Difficulty Level
export enum TemplateDifficulty {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

// Template Version Info
export interface TemplateVersion {
  version: string;
  changelog: string;
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
}

// Voice Metadata for Templates
export interface TemplateVoiceMetadata {
  voiceCreated?: boolean;
  voiceInstructions?: Array<{
    stepId: string;
    instruction: string;
    audioUrl?: string;
    language?: string;
  }>;
  voiceCommands?: Array<{
    trigger: string;
    action: string;
    stepId?: string;
  }>;
}

// Core Job Template Entity
export interface JobTemplate {
  id: string;
  tenant_id: string;
  template_number: string;
  
  // Basic Information
  title: string;
  description: string;
  category: TemplateCategory;
  jobType: JobType;
  difficulty: TemplateDifficulty;
  
  // Template Structure
  steps: TemplateStep[];
  estimatedTotalDuration: number; // minutes
  estimatedCost: number;
  
  // Pricing
  defaultPricing?: {
    laborRate: number;
    markupPercentage: number;
    fixedPrice?: number;
    pricePerUnit?: number;
    unit?: string;
  };
  
  // Requirements
  requiredSkills?: string[];
  requiredCertifications?: string[];
  minimumTeamSize: number;
  maximumTeamSize?: number;
  
  // Equipment and Materials Summary
  equipmentSummary: Array<{
    equipmentType: string;
    quantity: number;
    isOptional: boolean;
  }>;
  materialsSummary: Array<{
    materialType: string;
    estimatedQuantity: number;
    unit: string;
    isOptional: boolean;
  }>;
  
  // Safety and Compliance
  safetyRequirements?: string[];
  complianceNotes?: string[];
  insuranceRequirements?: string[];
  
  // Voice Support
  voiceMetadata?: TemplateVoiceMetadata;
  
  // Template Management
  parentTemplateId?: string; // For template inheritance
  isPublic: boolean; // Can be shared across tenants
  usageCount: number;
  averageRating?: number;
  
  // Versioning
  version: string;
  versionHistory: TemplateVersion[];
  
  // Metadata
  tags: string[];
  customFields: Record<string, any>;
  
  // System Fields
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// Template Step Schema
const templateStepSchema = z.object({
  stepNumber: z.number().min(1),
  title: z.string().min(1, 'Step title is required'),
  description: z.string().min(1, 'Step description is required'),
  type: z.nativeEnum(StepType),
  estimatedDuration: z.number().min(1, 'Estimated duration must be at least 1 minute'),
  isRequired: z.boolean().default(true),
  isCritical: z.boolean().default(false),
  voiceInstructions: z.string().optional(),
  voiceConfirmationRequired: z.boolean().default(false),
  dependsOn: z.array(z.string()).default([]),
  blocksSteps: z.array(z.string()).default([]),
  requiredEquipment: z.array(z.object({
    equipmentType: z.string(),
    quantity: z.number().min(1),
    isOptional: z.boolean().default(false),
  })).default([]),
  requiredMaterials: z.array(z.object({
    materialType: z.string(),
    quantity: z.number().min(0),
    unit: z.string(),
    isOptional: z.boolean().default(false),
  })).default([]),
  qualityChecks: z.array(z.object({
    description: z.string(),
    type: z.enum(['visual', 'measurement', 'test', 'photo']),
    isRequired: z.boolean().default(true),
    acceptanceCriteria: z.string().optional(),
  })).default([]),
  photosRequired: z.array(z.object({
    type: z.enum(['before', 'during', 'after']),
    description: z.string(),
    isRequired: z.boolean().default(true),
  })).default([]),
  notesRequired: z.boolean().default(false),
  customerSignatureRequired: z.boolean().default(false),
  skipConditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']),
    value: z.any(),
  })).default([]),
  customFields: z.record(z.any()).default({}),
});

// Job Template Creation Schema
export const jobTemplateCreateSchema = z.object({
  title: z.string().min(1, 'Template title is required'),
  description: z.string().min(1, 'Template description is required'),
  category: z.nativeEnum(TemplateCategory),
  jobType: z.nativeEnum(JobType),
  difficulty: z.nativeEnum(TemplateDifficulty).default(TemplateDifficulty.BASIC),
  steps: z.array(templateStepSchema).min(1, 'At least one step is required'),
  estimatedCost: z.number().min(0).default(0),
  defaultPricing: z.object({
    laborRate: z.number().min(0),
    markupPercentage: z.number().min(0).max(100),
    fixedPrice: z.number().min(0).optional(),
    pricePerUnit: z.number().min(0).optional(),
    unit: z.string().optional(),
  }).optional(),
  requiredSkills: z.array(z.string()).default([]),
  requiredCertifications: z.array(z.string()).default([]),
  minimumTeamSize: z.number().min(1).default(1),
  maximumTeamSize: z.number().min(1).optional(),
  safetyRequirements: z.array(z.string()).default([]),
  complianceNotes: z.array(z.string()).default([]),
  insuranceRequirements: z.array(z.string()).default([]),
  voiceMetadata: z.object({
    voiceCreated: z.boolean().default(false),
    voiceInstructions: z.array(z.object({
      stepId: z.string(),
      instruction: z.string(),
      audioUrl: z.string().optional(),
      language: z.string().default('en'),
    })).default([]),
    voiceCommands: z.array(z.object({
      trigger: z.string(),
      action: z.string(),
      stepId: z.string().optional(),
    })).default([]),
  }).optional(),
  parentTemplateId: z.string().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.any()).default({}),
});

// Job Template Update Schema
export const jobTemplateUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.nativeEnum(TemplateCategory).optional(),
  jobType: z.nativeEnum(JobType).optional(),
  difficulty: z.nativeEnum(TemplateDifficulty).optional(),
  steps: z.array(templateStepSchema).optional(),
  estimatedCost: z.number().min(0).optional(),
  defaultPricing: z.object({
    laborRate: z.number().min(0).optional(),
    markupPercentage: z.number().min(0).max(100).optional(),
    fixedPrice: z.number().min(0).optional(),
    pricePerUnit: z.number().min(0).optional(),
    unit: z.string().optional(),
  }).optional(),
  requiredSkills: z.array(z.string()).optional(),
  requiredCertifications: z.array(z.string()).optional(),
  minimumTeamSize: z.number().min(1).optional(),
  maximumTeamSize: z.number().min(1).optional(),
  safetyRequirements: z.array(z.string()).optional(),
  complianceNotes: z.array(z.string()).optional(),
  insuranceRequirements: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

// Type Exports for Creation/Update
export type JobTemplateCreate = z.infer<typeof jobTemplateCreateSchema>;
export type JobTemplateUpdate = z.infer<typeof jobTemplateUpdateSchema>;

// Type Guards
export const isTemplateCategory = (value: string): value is TemplateCategory => {
  return Object.values(TemplateCategory).includes(value as TemplateCategory);
};

export const isTemplateDifficulty = (value: string): value is TemplateDifficulty => {
  return Object.values(TemplateDifficulty).includes(value as TemplateDifficulty);
};

export const isStepType = (value: string): value is StepType => {
  return Object.values(StepType).includes(value as StepType);
};

export const isStepStatus = (value: string): value is StepStatus => {
  return Object.values(StepStatus).includes(value as StepStatus);
};
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/irrigation/types/irrigation-types.ts
// phase: 4
// domain: irrigation
// purpose: Core types and schemas for irrigation system management
// spec_ref: phase4/irrigation#types
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/core/types/base-types
//     - /src/core/errors/error-types
//   external:
//     - zod: ^3.22.0
//
// exports:
//   - IrrigationSystem: interface - System entity
//   - IrrigationZone: interface - Zone entity
//   - IrrigationSchedule: interface - Schedule entity
//   - IrrigationRun: interface - Run history entity
//   - ControllerType: enum - Controller types
//   - ZoneType: enum - Zone types
//   - ValveStatus: enum - Valve statuses
//   - ScheduleType: enum - Schedule types
//   - IrrigationSystemSchema: zod schema
//   - IrrigationZoneSchema: zod schema
//   - IrrigationScheduleSchema: zod schema
//   - IrrigationRunSchema: zod schema
//
// voice_considerations: |
//   Natural language zone identification.
//   Voice commands for irrigation control.
//   Status reporting in conversational format.
//   Zone grouping for voice control.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/irrigation/types/irrigation-types.test.ts
//
// tasks:
//   1. Define irrigation system types
//   2. Create zone management types
//   3. Implement schedule types
//   4. Add run history types
//   5. Create validation schemas
//   6. Add voice command types
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
interface BaseEntity {
  id: string;
}

interface TenantAware {
  tenantId: string;
}

interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

interface VoiceAware {
  voiceControlEnabled: boolean;
  voiceCommands: string[];
}

// Controller types
export enum ControllerType {
  SMART = 'smart',
  CONVENTIONAL = 'conventional',
  HYBRID = 'hybrid',
}

// Zone types
export enum ZoneType {
  LAWN = 'lawn',
  SHRUBS = 'shrubs',
  TREES = 'trees',
  DRIP = 'drip',
  GARDEN = 'garden',
  OTHER = 'other',
}

// Valve statuses
export enum ValveStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  FAULT = 'fault',
  UNKNOWN = 'unknown',
}

// Schedule types
export enum ScheduleType {
  FIXED = 'fixed',
  SMART = 'smart',
  WEATHER_BASED = 'weather_based',
  SEASONAL = 'seasonal',
  MANUAL = 'manual',
}

// Run status
export enum RunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

// Trigger sources
export enum TriggerSource {
  SCHEDULE = 'schedule',
  MANUAL = 'manual',
  VOICE = 'voice',
  API = 'api',
}

// Backflow device information
export interface BackflowDevice {
  type: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  lastTestDate?: Date;
  nextTestDue?: Date;
}

// Irrigation system entity
export interface IrrigationSystem extends BaseEntity, TenantAware, Timestamped, VoiceAware {
  propertyId: string;
  systemName: string;
  controllerType?: ControllerType;
  controllerMake?: string;
  controllerModel?: string;
  controllerLocation?: string;
  wifiEnabled: boolean;
  remoteAccessEnabled: boolean;
  rainSensorInstalled: boolean;
  flowSensorInstalled: boolean;
  backflowDeviceInfo?: BackflowDevice;
  lastInspectionDate?: Date;
  nextInspectionDue?: Date;
  winterizationDate?: Date;
  activationDate?: Date;
  notes?: string;
  voiceControlEnabled: boolean;
  voiceCommands: string[];
  metadata: Record<string, any>;
}

// Nozzle information
export interface NozzleInfo {
  type: string;
  brand?: string;
  model?: string;
  flowRate?: number; // GPM
  radius?: number; // feet
  arc?: number; // degrees
}

// Irrigation zone entity
export interface IrrigationZone extends BaseEntity, TenantAware, Timestamped {
  systemId: string;
  zoneNumber: number;
  zoneName?: string;
  zoneType?: ZoneType;
  areaSqft?: number;
  plantType?: string;
  soilType?: string;
  sunExposure?: 'full_sun' | 'partial_shade' | 'full_shade';
  slopePercentage?: number;
  
  // Technical details
  valveLocation?: string;
  valveSize?: string;
  valveType?: string;
  gpmFlowRate?: number;
  headCount?: number;
  headType?: string;
  nozzleTypes?: NozzleInfo[];
  
  // Runtime settings
  defaultRuntimeMinutes?: number;
  cycleSoakEnabled: boolean;
  cycleCount: number;
  soakMinutes: number;
  
  // Status
  isActive: boolean;
  currentStatus: ValveStatus;
  lastRunDate?: Date;
  totalRuntimeYtd: number; // minutes this year
  
  // Voice
  voiceIdentifier?: string; // "front lawn", "back shrubs", etc.
  
  metadata: Record<string, any>;
}

// Zone runtime configuration
export interface ZoneRuntime {
  zoneId: string;
  minutes: number;
  cycleCount?: number;
  soakMinutes?: number;
}

// Weather adjustment settings
export interface WeatherAdjustment {
  enabled: boolean;
  rainDelayThreshold?: number; // inches
  temperatureThreshold?: number; // fahrenheit
  windThreshold?: number; // mph
}

// Irrigation schedule entity
export interface IrrigationSchedule extends BaseEntity, TenantAware, Timestamped {
  systemId: string;
  scheduleName: string;
  scheduleType: ScheduleType;
  isActive: boolean;
  
  // Schedule details
  startDate?: Date;
  endDate?: Date;
  daysOfWeek: number[]; // 0-6 (Sun-Sat)
  startTimes: string[]; // HH:MM format
  
  // Smart scheduling
  weatherAdjustment?: WeatherAdjustment;
  
  // Zone assignments
  zoneRuntimes: ZoneRuntime[];
  
  // Seasonal adjustments
  seasonalAdjustment: number; // percentage (100 = no adjustment)
}

// Weather data captured during run
export interface WeatherData {
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  conditions?: string;
}

// Irrigation run history
export interface IrrigationRun extends BaseEntity, TenantAware {
  systemId: string;
  scheduleId?: string;
  zoneId: string;
  
  // Run details
  startedAt: Date;
  endedAt?: Date;
  scheduledMinutes?: number;
  actualMinutes?: number;
  
  // Trigger info
  triggeredBy: TriggerSource;
  triggeredByUser?: string;
  voiceCommandId?: string;
  
  // Water usage
  gallonsUsed?: number;
  
  // Status
  status: RunStatus;
  cancellationReason?: string;
  
  // Weather at time of run
  weatherData?: WeatherData;
}

// Voice command for irrigation
export interface IrrigationVoiceCommand {
  action: 'start' | 'stop' | 'pause' | 'resume' | 'status';
  target?: 'zone' | 'system' | 'schedule';
  identifier?: string; // zone name, system name, etc.
  duration?: number; // minutes
  zones?: string[]; // for multi-zone commands
}

// Validation schemas

export const BackflowDeviceSchema = z.object({
  type: z.string(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  lastTestDate: z.date().optional(),
  nextTestDue: z.date().optional(),
});

export const IrrigationSystemSchema = z.object({
  propertyId: z.string().uuid(),
  systemName: z.string().min(1).max(255),
  controllerType: z.nativeEnum(ControllerType).optional(),
  controllerMake: z.string().max(100).optional(),
  controllerModel: z.string().max(100).optional(),
  controllerLocation: z.string().optional(),
  wifiEnabled: z.boolean().default(false),
  remoteAccessEnabled: z.boolean().default(false),
  rainSensorInstalled: z.boolean().default(false),
  flowSensorInstalled: z.boolean().default(false),
  backflowDeviceInfo: BackflowDeviceSchema.optional(),
  lastInspectionDate: z.date().optional(),
  nextInspectionDue: z.date().optional(),
  winterizationDate: z.date().optional(),
  activationDate: z.date().optional(),
  notes: z.string().optional(),
  voiceControlEnabled: z.boolean().default(false),
  voiceCommands: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

export const NozzleInfoSchema = z.object({
  type: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
  flowRate: z.number().positive().optional(),
  radius: z.number().positive().optional(),
  arc: z.number().min(0).max(360).optional(),
});

export const IrrigationZoneSchema = z.object({
  systemId: z.string().uuid(),
  zoneNumber: z.number().int().positive(),
  zoneName: z.string().max(255).optional(),
  zoneType: z.nativeEnum(ZoneType).optional(),
  areaSqft: z.number().int().positive().optional(),
  plantType: z.string().max(100).optional(),
  soilType: z.string().max(100).optional(),
  sunExposure: z.enum(['full_sun', 'partial_shade', 'full_shade']).optional(),
  slopePercentage: z.number().min(0).max(100).optional(),
  valveLocation: z.string().optional(),
  valveSize: z.string().max(20).optional(),
  valveType: z.string().max(50).optional(),
  gpmFlowRate: z.number().positive().optional(),
  headCount: z.number().int().positive().optional(),
  headType: z.string().max(100).optional(),
  nozzleTypes: z.array(NozzleInfoSchema).optional(),
  defaultRuntimeMinutes: z.number().int().positive().optional(),
  cycleSoakEnabled: z.boolean().default(false),
  cycleCount: z.number().int().min(1).default(1),
  soakMinutes: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  currentStatus: z.nativeEnum(ValveStatus).default(ValveStatus.CLOSED),
  lastRunDate: z.date().optional(),
  totalRuntimeYtd: z.number().int().min(0).default(0),
  voiceIdentifier: z.string().max(100).optional(),
  metadata: z.record(z.any()).default({}),
});

export const ZoneRuntimeSchema = z.object({
  zoneId: z.string().uuid(),
  minutes: z.number().int().positive(),
  cycleCount: z.number().int().min(1).optional(),
  soakMinutes: z.number().int().min(0).optional(),
});

export const WeatherAdjustmentSchema = z.object({
  enabled: z.boolean(),
  rainDelayThreshold: z.number().positive().optional(),
  temperatureThreshold: z.number().optional(),
  windThreshold: z.number().positive().optional(),
});

export const IrrigationScheduleSchema = z.object({
  systemId: z.string().uuid(),
  scheduleName: z.string().min(1).max(255),
  scheduleType: z.nativeEnum(ScheduleType).default(ScheduleType.FIXED),
  isActive: z.boolean().default(true),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  startTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).default([]),
  weatherAdjustment: WeatherAdjustmentSchema.optional(),
  zoneRuntimes: z.array(ZoneRuntimeSchema).default([]),
  seasonalAdjustment: z.number().int().min(0).max(200).default(100),
});

export const WeatherDataSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().min(0).max(100).optional(),
  windSpeed: z.number().min(0).optional(),
  precipitation: z.number().min(0).optional(),
  conditions: z.string().optional(),
});

export const IrrigationRunSchema = z.object({
  systemId: z.string().uuid(),
  scheduleId: z.string().uuid().optional(),
  zoneId: z.string().uuid(),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  scheduledMinutes: z.number().int().positive().optional(),
  actualMinutes: z.number().int().positive().optional(),
  triggeredBy: z.nativeEnum(TriggerSource),
  triggeredByUser: z.string().uuid().optional(),
  voiceCommandId: z.string().uuid().optional(),
  gallonsUsed: z.number().positive().optional(),
  status: z.nativeEnum(RunStatus),
  cancellationReason: z.string().optional(),
  weatherData: WeatherDataSchema.optional(),
});

export const IrrigationVoiceCommandSchema = z.object({
  action: z.enum(['start', 'stop', 'pause', 'resume', 'status']),
  target: z.enum(['zone', 'system', 'schedule']).optional(),
  identifier: z.string().optional(),
  duration: z.number().int().positive().optional(),
  zones: z.array(z.string()).optional(),
});

// Type guards
export const isIrrigationSystem = (obj: any): obj is IrrigationSystem => {
  return IrrigationSystemSchema.safeParse(obj).success;
};

export const isIrrigationZone = (obj: any): obj is IrrigationZone => {
  return IrrigationZoneSchema.safeParse(obj).success;
};

export const isIrrigationSchedule = (obj: any): obj is IrrigationSchedule => {
  return IrrigationScheduleSchema.safeParse(obj).success;
};

export const isIrrigationRun = (obj: any): obj is IrrigationRun => {
  return IrrigationRunSchema.safeParse(obj).success;
};

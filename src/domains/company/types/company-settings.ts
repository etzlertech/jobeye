// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/company/types/company-settings.ts
// purpose: Domain-level types and helpers for company settings configuration
// spec_ref: data-001-company-settings-schema
// exports:
//   - VisionThresholds
//   - VoicePreferences
//   - BudgetLimits
//   - CompanyFeatureFlags
//   - CompanySettingsRow
//   - CompanySettings
//   - mapCompanySettingsRow
//   - DEFAULT_COMPANY_SETTINGS (composed defaults)
// --- END DIRECTIVE BLOCK ---

import type { Database } from '@/lib/supabase/types';

export type CompanySettingsRow = Database['public']['Tables']['company_settings']['Row'];
export type CompanySettingsInsert = Database['public']['Tables']['company_settings']['Insert'];
export type CompanySettingsUpdate = Database['public']['Tables']['company_settings']['Update'];

export interface VisionThresholds {
  confidenceThreshold: number;
  maxObjects: number;
  checkExpectedItems: boolean;
}

export interface VoicePreferences {
  wakeWord: string;
  voiceName: string;
  speechRate: number;
  confirmationRequired: boolean;
}

export interface BudgetLimits {
  stt: number;
  tts: number;
  vlm: number;
  llm: number;
}

export interface CompanyFeatureFlags {
  offlineMode: boolean;
  visionVerification: boolean;
  voiceCommands: boolean;
}

export interface CompanySettings {
  id: string;
  tenantId: string;
  visionThresholds: VisionThresholds;
  voicePreferences: VoicePreferences;
  budgetLimits: BudgetLimits;
  features: CompanyFeatureFlags;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_VISION_THRESHOLDS: VisionThresholds = {
  confidenceThreshold: 0.7,
  maxObjects: 20,
  checkExpectedItems: true,
};

const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  wakeWord: 'Hey JobEye',
  voiceName: 'Google US English',
  speechRate: 1.0,
  confirmationRequired: true,
};

const DEFAULT_BUDGET_LIMITS: BudgetLimits = {
  stt: 10,
  tts: 5,
  vlm: 25,
  llm: 50,
};

const DEFAULT_FEATURE_FLAGS: CompanyFeatureFlags = {
  offlineMode: true,
  visionVerification: true,
  voiceCommands: true,
};

export const DEFAULT_COMPANY_SETTINGS = {
  visionThresholds: DEFAULT_VISION_THRESHOLDS,
  voicePreferences: DEFAULT_VOICE_PREFERENCES,
  budgetLimits: DEFAULT_BUDGET_LIMITS,
  features: DEFAULT_FEATURE_FLAGS,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

const toStringValue = (value: unknown, fallback: string): string => {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const normalizeVisionThresholds = (value: unknown): VisionThresholds => {
  if (!isRecord(value)) {
    return { ...DEFAULT_VISION_THRESHOLDS };
  }

  return {
    confidenceThreshold: toNumber(value.confidenceThreshold, DEFAULT_VISION_THRESHOLDS.confidenceThreshold),
    maxObjects: toNumber(value.maxObjects, DEFAULT_VISION_THRESHOLDS.maxObjects),
    checkExpectedItems: toBoolean(value.checkExpectedItems, DEFAULT_VISION_THRESHOLDS.checkExpectedItems),
  };
};

const normalizeVoicePreferences = (value: unknown): VoicePreferences => {
  if (!isRecord(value)) {
    return { ...DEFAULT_VOICE_PREFERENCES };
  }

  return {
    wakeWord: toStringValue(value.wakeWord, DEFAULT_VOICE_PREFERENCES.wakeWord),
    voiceName: toStringValue(value.voiceName, DEFAULT_VOICE_PREFERENCES.voiceName),
    speechRate: toNumber(value.speechRate, DEFAULT_VOICE_PREFERENCES.speechRate),
    confirmationRequired: toBoolean(value.confirmationRequired, DEFAULT_VOICE_PREFERENCES.confirmationRequired),
  };
};

const normalizeBudgetLimits = (value: unknown): BudgetLimits => {
  if (!isRecord(value)) {
    return { ...DEFAULT_BUDGET_LIMITS };
  }

  return {
    stt: toNumber(value.stt, DEFAULT_BUDGET_LIMITS.stt),
    tts: toNumber(value.tts, DEFAULT_BUDGET_LIMITS.tts),
    vlm: toNumber(value.vlm, DEFAULT_BUDGET_LIMITS.vlm),
    llm: toNumber(value.llm, DEFAULT_BUDGET_LIMITS.llm),
  };
};

const normalizeFeatureFlags = (value: unknown): CompanyFeatureFlags => {
  if (!isRecord(value)) {
    return { ...DEFAULT_FEATURE_FLAGS };
  }

  return {
    offlineMode: toBoolean(value.offlineMode, DEFAULT_FEATURE_FLAGS.offlineMode),
    visionVerification: toBoolean(value.visionVerification, DEFAULT_FEATURE_FLAGS.visionVerification),
    voiceCommands: toBoolean(value.voiceCommands, DEFAULT_FEATURE_FLAGS.voiceCommands),
  };
};

export const mapCompanySettingsRow = (row: CompanySettingsRow): CompanySettings => {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    visionThresholds: normalizeVisionThresholds(row.vision_thresholds),
    voicePreferences: normalizeVoicePreferences(row.voice_preferences),
    budgetLimits: normalizeBudgetLimits(row.budget_limits),
    features: normalizeFeatureFlags(row.features),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

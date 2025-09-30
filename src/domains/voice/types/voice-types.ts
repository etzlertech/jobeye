// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/voice/types/voice-types.ts
// phase: 3
// domain: voice-pipeline
// version: 1.0.0
// purpose: Type definitions for voice processing pipeline
// spec_ref: v4.0/voice-architecture.md
// complexity_budget: 100 LoC
//
// exports:
//   - interface VoiceRecording
//   - interface TranscriptionResult
//   - interface VoiceJobIntent
//   - interface ChecklistItem
//   - enum VoiceProvider
//   - enum IntentType
//
// voice_considerations: >
//   Define clear types for voice metadata including confidence scores,
//   language detection, and provider-specific response formats
//
// offline_capability: OPTIONAL
//
// test_requirements:
//   coverage: 0.0
//   test_file: n/a - type definitions only
// --- END DIRECTIVE BLOCK ---

export enum VoiceProvider {
  OPENAI_WHISPER = 'openai-whisper',
  ASSEMBLY_AI = 'assembly-ai',
  GOOGLE_SPEECH = 'google-speech'
}

export enum IntentType {
  CREATE_SCHEDULED_JOB = 'create_scheduled_job',
  UPDATE_JOB_STATUS = 'update_job_status',
  ADD_JOB_NOTE = 'add_job_note',
  SEARCH_CUSTOMER = 'search_customer'
}

// Extended intent vocabulary for inventory operations
export enum VoiceIntent {
  // Customer domain
  CREATE_CUSTOMER = 'create_customer',
  FIND_CUSTOMER = 'find_customer',
  UPDATE_CUSTOMER = 'update_customer',

  // Job domain
  CREATE_JOB = 'create_job',
  UPDATE_JOB_STATUS = 'update_job_status',
  FIND_JOBS = 'find_jobs',

  // Equipment domain
  CHECK_EQUIPMENT = 'check_equipment',
  UPDATE_EQUIPMENT = 'update_equipment',

  // Inventory domain (Feature 004)
  CHECK_OUT_EQUIPMENT = 'check_out_equipment',
  CHECK_IN_EQUIPMENT = 'check_in_equipment',
  CHECK_INVENTORY = 'check_inventory',
  USE_MATERIAL = 'use_material',
  RECORD_MATERIAL_USAGE = 'record_material_usage',
  TRANSFER_INVENTORY = 'transfer_inventory',
  SCAN_INVENTORY = 'scan_inventory',
  START_INVENTORY_AUDIT = 'start_inventory_audit',
  PROCESS_RECEIPT = 'process_receipt',

  // General
  HELP = 'help',
  CANCEL = 'cancel',
  CONFIRM = 'confirm',
}

// Command entity for extracted information
export interface CommandEntity {
  type: string;
  value: any;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

// Voice command structure
export interface VoiceCommand {
  id: string;
  sessionId: string;
  text: string;
  intent?: VoiceIntent;
  entities?: CommandEntity[];
  confidence?: number;
  timestamp: Date;
}

export interface VoiceRecording {
  id: string;
  sessionId: string;
  mediaId: string;
  duration: number;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionResult {
  id: string;
  sessionId: string;
  mediaId: string;
  provider: VoiceProvider;
  modelId: string;
  language: string;
  transcript: string;
  confidence: number;
  words?: TranscriptionWord[];
  tokensUsed: number;
  costUsd: number;
  error?: string;
  createdAt: Date;
}

export interface ChecklistItem {
  id: string;
  title: string;
  evidenceType: ('photo' | 'video')[];
  acceptanceCriteria: string;
  vlmPrompt?: string;
}

export interface VoiceJobIntent {
  intent: IntentType.CREATE_SCHEDULED_JOB;
  confidence: number;
  slots: {
    jobType: 'mowing' | 'trimming' | 'cleanup' | 'irrigation' | 'custom';
    customerName: string;
    propertyName?: string;
    startAt: string; // ISO 8601
    durationMinutes: number;
    assigneeNameOrEmail: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    checklistItems: ChecklistItem[];
    notes?: string;
  };
}

export interface IntentRecognitionResult {
  id: string;
  transcriptId: string;
  provider: string;
  modelId: string;
  intent: IntentType;
  confidence: number;
  entities: VoiceJobIntent | Record<string, any>;
  rawResponse: any;
  tokensUsed: number;
  costUsd: number;
  createdAt: Date;
}
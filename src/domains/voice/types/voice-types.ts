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
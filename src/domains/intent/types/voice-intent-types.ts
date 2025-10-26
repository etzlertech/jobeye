/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/domains/intent/types/voice-intent-types.ts
 * phase: 3
 * domain: intent
 * purpose: Type definitions for voice-driven intent classification and CRUD operations
 * spec_ref: voice-to-crud-plan.md
 * complexity_budget: 100
 * migrations_touched: []
 * state_machine: null
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: ['../repositories/intent-classification.repository']
 * }
 * exports: ['VoiceIntentType', 'VoiceIntentResult', 'VoiceIntentEntities', 'ConversationContext']
 * voice_considerations: Core types for all voice-to-CRUD operations
 * tasks: [
 *   'Define voice-specific intent types',
 *   'Define entity extraction types',
 *   'Define conversation context for multi-turn dialogs'
 * ]
 */

import { IntentType, IntentContext } from '../repositories/intent-classification.repository';

/**
 * Extended intent types for voice-driven CRUD operations
 */
export type VoiceIntentType = IntentType
  | 'check_in'           // Return items from job
  | 'check_out'          // Assign items to job
  | 'transfer'           // Move items between locations
  | 'assign_crew'        // Assign crew to job
  | 'assign_item'        // Assign item to job
  | 'material_usage'     // Record material consumption
  | 'cycle_count'        // Inventory cycle count
  | 'kit_create'         // Create kit/BOM
  | 'kit_assign';        // Assign kit to job

/**
 * Entities extracted from voice transcript
 */
export interface VoiceIntentEntities {
  // Item-related
  itemNames?: string[];
  itemIds?: string[];
  quantities?: number[];
  conditions?: ('good' | 'damaged' | 'needs_repair')[];

  // Location-related
  fromLocationId?: string;
  fromLocationName?: string;
  toLocationId?: string;
  toLocationName?: string;

  // Job-related
  jobId?: string;
  jobNumber?: string;

  // Crew-related
  crewIds?: string[];
  crewNames?: string[];

  // Customer/Property-related
  customerId?: string;
  customerName?: string;
  propertyId?: string;
  propertyAddress?: string;

  // Scheduling-related
  scheduledDate?: string; // ISO 8601
  scheduledTime?: string;

  // Material-related
  materialType?: string;
  unitOfMeasure?: string;

  // Kit/BOM-related
  kitName?: string;
  kitId?: string;

  // General
  notes?: string;
  tags?: string[];
}

/**
 * Result of voice intent classification
 */
export interface VoiceIntentResult {
  // Core classification
  intent: VoiceIntentType;
  entities: VoiceIntentEntities;
  confidence: number; // 0.0-1.0

  // Clarification handling
  needs_clarification: boolean;
  follow_up?: string; // Question to ask user for clarification
  missing_entities?: string[]; // Which entities are missing

  // Context tracking
  conversation_id?: string;
  turn_number?: number;

  // Metadata
  model_used: string;
  processing_time_ms: number;
  cost_usd: number;
}

/**
 * Conversation context for multi-turn dialogs
 * Tracks state across clarification loops
 */
export interface ConversationContext {
  // Session tracking
  conversation_id: string;
  user_id: string;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;

  // Conversation state
  turn_number: number;
  current_intent?: VoiceIntentType;
  accumulated_entities: VoiceIntentEntities;

  // Previous turns (for context)
  previous_transcripts: string[];
  previous_intents: VoiceIntentType[];

  // User context
  user_context: IntentContext;

  // Clarification tracking
  clarification_count: number;
  max_clarifications: number; // Default: 3

  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Request for intent classification
 */
export interface ClassifyVoiceIntentRequest {
  transcript: string;
  context: IntentContext;
  conversation_context?: ConversationContext; // For multi-turn dialogs
}

/**
 * Confirmation result for yes/no responses
 */
export interface VoiceConfirmationResult {
  confirmed: boolean;
  confidence: number;
  interpretation: 'yes' | 'no' | 'unclear';
  original_transcript: string;
}

/**
 * Request for confirmation processing
 */
export interface ProcessConfirmationRequest {
  transcript: string;
  previous_intent: VoiceIntentResult;
  confirmation_question: string;
  conversation_context?: ConversationContext;
}

/**
 * Action execution result
 */
export interface VoiceActionResult {
  success: boolean;
  intent: VoiceIntentType;
  data?: any; // Result data from CRUD operation
  response_text: string; // Human-readable response
  needs_confirmation?: boolean;
  confirmation_question?: string;
  error?: string;
}

/**
 * Voice settings for TTS/STT
 */
export interface VoiceSettings {
  language: string;
  voice_speed: number;
  voice_pitch: number;
  auto_speak: boolean;
  confirm_actions: boolean;
  use_browser_stt: boolean; // NEW: Prefer browser STT for cost savings
}

/**
 * @file src/domains/safety/services/safety-verification.types.ts
 * @phase 3
 * @domain safety
 * @purpose Shared types for SafetyVerificationService dependencies and results.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T064
 * @complexity_budget 150 LoC
 * @dependencies []
 * @exports
 *   - SafetyChecklistItem
 *   - SafetyDetection
 *   - SafetyVerificationResult
 *   - SafetyVerificationContext
 *   - SafetyYoloClient
 *   - SafetyVlmClient
 *   - SafetyVerificationDependencies
 *   - SafetyVerificationPersistencePayload
 * @voice_considerations
 *   - Types capture explanations and fallback usage so voice prompts can report status.
 * END AGENT DIRECTIVE BLOCK
 */

export interface SafetyChecklistItem {
  id: string;
  label: string;
  requiredLabels: string[];
  minimumConfidence?: number;
  fallbackPrompt?: string;
}

export interface SafetyDetection {
  label: string;
  confidence: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SafetyVerificationResult {
  verified: boolean;
  confidence: number;
  matchedLabels: string[];
  missingLabels: string[];
  fallbackUsed: boolean;
  explanation?: string;
  detectedSamples: SafetyDetection[];
  analyzedAt: string;
}

export interface SafetyVerificationContext {
  tenantId?: string;
  jobId?: string;
  checklistId?: string;
  checklistItemId?: string;
  performedByUserId?: string;
}

export interface SafetyYoloClient {
  detect(image: Blob, options?: { confidenceThreshold?: number }): Promise<{
    detections: SafetyDetection[];
    processingTimeMs: number;
    modelVersion: string;
  }>;
}

export interface SafetyVlmClientResponse {
  verified: boolean;
  confidence: number;
  matchedLabels: string[];
  missingLabels: string[];
  explanation?: string;
}

export interface SafetyVlmClient {
  evaluate(
    image: Blob,
    checklist: SafetyChecklistItem,
    options?: { abortSignal?: AbortSignal }
  ): Promise<SafetyVlmClientResponse | null>;
}

export interface SafetyVerificationPersistencePayload {
  result: SafetyVerificationResult;
  context?: SafetyVerificationContext;
  checklist: SafetyChecklistItem;
  rawDetections: SafetyDetection[];
}

export interface SafetyVerificationDependencies {
  yoloClient: SafetyYoloClient;
  vlmClient: SafetyVlmClient;
  persistResult?: (payload: SafetyVerificationPersistencePayload) => Promise<void>;
  logger?: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
  now?: () => Date;
  confidenceThreshold?: number;
  fallbackConfidenceThreshold?: number;
}

// Re-export all types explicitly
export type {
  SafetyChecklistItem,
  SafetyDetection,
  SafetyVerificationResult,
  SafetyVerificationContext,
  SafetyYoloClient,
  SafetyVlmClient,
  SafetyVlmClientResponse,
  SafetyVerificationPersistencePayload
};

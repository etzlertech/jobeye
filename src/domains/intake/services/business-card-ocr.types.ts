/**
 * @file src/domains/intake/services/business-card-ocr.types.ts
 * @phase 3
 * @domain intake
 * @purpose Shared type definitions for BusinessCardOcrService and helpers.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T074
 * @complexity_budget 150 LoC
 * @dependencies
 *   internal: []
 *   external: []
 * @exports
 *   - OcrTextExtraction
 *   - VisionBusinessCardExtraction
 *   - BusinessCardContact
 *   - BusinessCardContactParser
 *   - ParsedContact
 *   - BusinessCardOcrDependencies
 *   - BusinessCardOcrContext
 *   - BusinessCardOcrPersistencePayload
 * @voice_considerations
 *   - Types capture confidence and source metadata so voice flows can inform users accurately.
 * END AGENT DIRECTIVE BLOCK
 */

export interface OcrTextExtraction {
  text: string;
  confidence: number;
}

export interface VisionBusinessCardExtraction {
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  confidence?: number | null;
  rawText?: string | null;
}

export type BusinessCardContactSource = 'tesseract' | 'vision';

export interface BusinessCardContact {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  confidence: number;
  source: BusinessCardContactSource;
  fallbackUsed: boolean;
  rawText?: string;
  analyzedAt: string;
}

export interface ParsedContact {
  data: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  rawText: string;
  fieldsPresent: number;
}

export interface BusinessCardContactParser {
  parse(text: string): ParsedContact;
}

export interface BusinessCardOcrContext {
  tenantId?: string;
  sessionId?: string;
  status?: 'pending_review' | 'approved' | 'rejected' | 'merged';
  processingTimeMs?: number;
  costUsd?: number;
  duplicateOfId?: string;
  duplicateConfidence?: number;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface BusinessCardExtractionRepository {
  create(extraction: {
    tenant_id: string;
    session_id: string;
    extraction_type: 'contact';
    raw_text?: string | null;
    structured_data: Record<string, unknown>;
    confidence_score: number;
    provider: 'tesseract' | 'gpt-4o-mini';
    processing_time_ms?: number | null;
    cost?: number | null;
    duplicate_of_id?: string | null;
    duplicate_confidence?: number | null;
    status: 'pending_review' | 'approved' | 'rejected' | 'merged';
    reviewed_by?: string | null;
    reviewed_at?: string | null;
  }): Promise<unknown>;
}

export interface BusinessCardOcrPersistencePayload {
  result: BusinessCardContact;
  source: BusinessCardContactSource;
  rawText?: string;
  analyzedAt: string;
  fallbackUsed: boolean;
  context?: BusinessCardOcrContext;
}

export interface BusinessCardOcrDependencies {
  tesseractClient: {
    extractText(image: Blob, options?: Record<string, unknown>): Promise<OcrTextExtraction>;
  };
  visionClient: {
    analyzeBusinessCard(
      image: Blob,
      options?: Record<string, unknown>
    ): Promise<VisionBusinessCardExtraction | null | undefined>;
  };
  extractionRepository?: BusinessCardExtractionRepository;
  persistResult?: (payload: BusinessCardOcrPersistencePayload) => Promise<void>;
  contactParser?: BusinessCardContactParser;
  confidenceThreshold?: number;
  logger?: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
  now?: () => Date;
}

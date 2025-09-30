/**
 * T057: IntakeExtractionRepository
 * Repository for managing OCR extraction results with duplicate detection and confidence tracking
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface IntakeExtraction {
  id: string;
  tenant_id: string;
  session_id: string;
  extraction_type: 'contact' | 'property' | 'work_order' | 'equipment';
  raw_text?: string;
  structured_data: Record<string, any>;
  confidence_score: number;
  provider: 'tesseract' | 'gpt-4o-mini' | 'manual';
  processing_time_ms?: number;
  cost?: number;
  duplicate_of_id?: string;
  duplicate_confidence?: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'merged';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export class IntakeExtractionRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<IntakeExtraction | null> {
    const { data, error } = await this.supabase
      .from('intake_extractions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findBySessionId(sessionId: string): Promise<IntakeExtraction[]> {
    const { data, error } = await this.supabase
      .from('intake_extractions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByType(
    extractionType: IntakeExtraction['extraction_type'],
    options?: {
      status?: IntakeExtraction['status'];
      minConfidence?: number;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<IntakeExtraction[]> {
    let query = this.supabase
      .from('intake_extractions')
      .select('*')
      .eq('extraction_type', extractionType)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.minConfidence !== undefined) {
      query = query.gte('confidence_score', options.minConfidence);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findPendingReview(limit?: number): Promise<IntakeExtraction[]> {
    let query = this.supabase
      .from('intake_extractions')
      .select('*')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findDuplicates(extractionId: string): Promise<IntakeExtraction[]> {
    const { data, error } = await this.supabase
      .from('intake_extractions')
      .select('*')
      .eq('duplicate_of_id', extractionId)
      .order('duplicate_confidence', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findLowConfidence(threshold: number, limit?: number): Promise<IntakeExtraction[]> {
    let query = this.supabase
      .from('intake_extractions')
      .select('*')
      .lt('confidence_score', threshold)
      .eq('status', 'pending_review')
      .order('confidence_score', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async create(extraction: Omit<IntakeExtraction, 'id' | 'created_at' | 'updated_at'>): Promise<IntakeExtraction> {
    const { data, error } = await this.supabase
      .from('intake_extractions')
      .insert(extraction)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<IntakeExtraction>): Promise<IntakeExtraction> {
    const { data, error } = await this.supabase
      .from('intake_extractions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateStatus(
    id: string,
    status: IntakeExtraction['status'],
    reviewData?: {
      reviewed_by: string;
      reviewed_at?: string;
    }
  ): Promise<IntakeExtraction> {
    const updates: Partial<IntakeExtraction> = { status };

    if (reviewData) {
      updates.reviewed_by = reviewData.reviewed_by;
      updates.reviewed_at = reviewData.reviewed_at || new Date().toISOString();
    }

    return this.update(id, updates);
  }

  async markAsDuplicate(
    extractionId: string,
    duplicateOfId: string,
    confidence: number
  ): Promise<IntakeExtraction> {
    return this.update(extractionId, {
      duplicate_of_id: duplicateOfId,
      duplicate_confidence: confidence,
      status: 'merged',
    });
  }

  async updateStructuredData(id: string, structuredData: Record<string, any>): Promise<IntakeExtraction> {
    return this.update(id, { structured_data: structuredData });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('intake_extractions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getStatsByProvider(startDate?: string, endDate?: string): Promise<Array<{
    provider: string;
    count: number;
    avg_confidence: number;
    avg_cost: number;
    total_cost: number;
  }>> {
    let query = this.supabase
      .from('intake_extractions')
      .select('provider, confidence_score, cost');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Aggregate by provider
    const stats = new Map<string, { count: number; total_confidence: number; total_cost: number }>();

    (data || []).forEach((extraction) => {
      const existing = stats.get(extraction.provider) || { count: 0, total_confidence: 0, total_cost: 0 };
      existing.count++;
      existing.total_confidence += extraction.confidence_score || 0;
      existing.total_cost += extraction.cost || 0;
      stats.set(extraction.provider, existing);
    });

    return Array.from(stats.entries()).map(([provider, agg]) => ({
      provider,
      count: agg.count,
      avg_confidence: agg.count > 0 ? agg.total_confidence / agg.count : 0,
      avg_cost: agg.count > 0 ? agg.total_cost / agg.count : 0,
      total_cost: agg.total_cost,
    }));
  }
}
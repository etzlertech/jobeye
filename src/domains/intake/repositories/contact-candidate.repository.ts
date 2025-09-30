/**
 * T058: ContactCandidateRepository
 * Repository for managing contact candidates from business card scans with duplicate detection
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface ContactCandidate {
  id: string;
  tenant_id: string;
  extraction_id: string;
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  website?: string;
  notes?: string;
  source_photo_id?: string;
  confidence_score: number;
  duplicate_of_customer_id?: string;
  duplicate_confidence?: number;
  match_status: 'new' | 'potential_duplicate' | 'confirmed_duplicate' | 'approved' | 'rejected';
  converted_to_customer_id?: string;
  converted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export class ContactCandidateRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<ContactCandidate | null> {
    const { data, error } = await this.supabase
      .from('contact_candidates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findByExtractionId(extractionId: string): Promise<ContactCandidate[]> {
    const { data, error } = await this.supabase
      .from('contact_candidates')
      .select('*')
      .eq('extraction_id', extractionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByMatchStatus(
    matchStatus: ContactCandidate['match_status'],
    options?: {
      minConfidence?: number;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<ContactCandidate[]> {
    let query = this.supabase
      .from('contact_candidates')
      .select('*')
      .eq('match_status', matchStatus)
      .order('created_at', { ascending: false });

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

  async findPendingReview(limit?: number): Promise<ContactCandidate[]> {
    let query = this.supabase
      .from('contact_candidates')
      .select('*')
      .in('match_status', ['new', 'potential_duplicate'])
      .order('created_at', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findPotentialDuplicates(email?: string, phone?: string, name?: string): Promise<ContactCandidate[]> {
    let query = this.supabase
      .from('contact_candidates')
      .select('*');

    // Build OR conditions for fuzzy matching
    const conditions: string[] = [];
    if (email) conditions.push(`email.ilike.%${email}%`);
    if (phone) conditions.push(`phone.ilike.%${phone.replace(/\D/g, '')}%`);
    if (name) conditions.push(`name.ilike.%${name}%`);

    if (conditions.length === 0) {
      return [];
    }

    // Note: Supabase doesn't have native OR support in this way, so we'll filter client-side
    // In production, consider using a stored procedure or RPC for complex queries
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    // Filter results client-side for fuzzy matching
    return (data || []).filter((candidate) => {
      if (email && candidate.email?.toLowerCase().includes(email.toLowerCase())) return true;
      if (phone && candidate.phone?.replace(/\D/g, '').includes(phone.replace(/\D/g, ''))) return true;
      if (name && candidate.name?.toLowerCase().includes(name.toLowerCase())) return true;
      return false;
    });
  }

  async create(candidate: Omit<ContactCandidate, 'id' | 'created_at' | 'updated_at'>): Promise<ContactCandidate> {
    const { data, error } = await this.supabase
      .from('contact_candidates')
      .insert(candidate)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<ContactCandidate>): Promise<ContactCandidate> {
    const { data, error } = await this.supabase
      .from('contact_candidates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMatchStatus(
    id: string,
    matchStatus: ContactCandidate['match_status'],
    reviewData?: {
      reviewed_by: string;
      reviewed_at?: string;
      duplicate_of_customer_id?: string;
      duplicate_confidence?: number;
    }
  ): Promise<ContactCandidate> {
    const updates: Partial<ContactCandidate> = { match_status: matchStatus };

    if (reviewData) {
      updates.reviewed_by = reviewData.reviewed_by;
      updates.reviewed_at = reviewData.reviewed_at || new Date().toISOString();

      if (reviewData.duplicate_of_customer_id) {
        updates.duplicate_of_customer_id = reviewData.duplicate_of_customer_id;
        updates.duplicate_confidence = reviewData.duplicate_confidence;
      }
    }

    return this.update(id, updates);
  }

  async markAsConverted(id: string, customerId: string): Promise<ContactCandidate> {
    return this.update(id, {
      converted_to_customer_id: customerId,
      converted_at: new Date().toISOString(),
      match_status: 'approved',
    });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('contact_candidates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getConversionStats(startDate?: string, endDate?: string): Promise<{
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    conversion_rate: number;
    avg_confidence: number;
  }> {
    let query = this.supabase
      .from('contact_candidates')
      .select('match_status, confidence_score, converted_to_customer_id');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const total = data?.length || 0;
    const approved = data?.filter((c) => c.match_status === 'approved').length || 0;
    const rejected = data?.filter((c) => c.match_status === 'rejected').length || 0;
    const pending = data?.filter((c) => ['new', 'potential_duplicate'].includes(c.match_status)).length || 0;
    const converted = data?.filter((c) => c.converted_to_customer_id).length || 0;
    const totalConfidence = data?.reduce((sum, c) => sum + (c.confidence_score || 0), 0) || 0;

    return {
      total,
      approved,
      rejected,
      pending,
      conversion_rate: total > 0 ? (converted / total) * 100 : 0,
      avg_confidence: total > 0 ? totalConfidence / total : 0,
    };
  }
}
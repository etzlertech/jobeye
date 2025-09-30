/**
 * T059: PropertyCandidateRepository
 * Repository for managing property candidates from work order scans with address matching
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface PropertyCandidate {
  id: string;
  tenant_id: string;
  extraction_id: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  property_type?: string;
  lot_size_sqft?: number;
  notes?: string;
  source_photo_id?: string;
  confidence_score: number;
  duplicate_of_property_id?: string;
  duplicate_confidence?: number;
  match_status: 'new' | 'potential_duplicate' | 'confirmed_duplicate' | 'approved' | 'rejected';
  converted_to_property_id?: string;
  converted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export class PropertyCandidateRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<PropertyCandidate | null> {
    const { data, error } = await this.supabase
      .from('property_candidates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findByExtractionId(extractionId: string): Promise<PropertyCandidate[]> {
    const { data, error } = await this.supabase
      .from('property_candidates')
      .select('*')
      .eq('extraction_id', extractionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByMatchStatus(
    matchStatus: PropertyCandidate['match_status'],
    options?: {
      minConfidence?: number;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<PropertyCandidate[]> {
    let query = this.supabase
      .from('property_candidates')
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

  async findPendingReview(limit?: number): Promise<PropertyCandidate[]> {
    let query = this.supabase
      .from('property_candidates')
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

  async findByAddress(address: string, fuzzy: boolean = true): Promise<PropertyCandidate[]> {
    let query = this.supabase
      .from('property_candidates')
      .select('*');

    if (fuzzy) {
      // Case-insensitive partial match
      query = query.ilike('address', `%${address}%`);
    } else {
      // Exact match
      query = query.eq('address', address);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findNearLocation(latitude: number, longitude: number, radiusMeters: number = 100): Promise<PropertyCandidate[]> {
    // Note: For production, use PostGIS or similar for proper geospatial queries
    // This is a simplified implementation
    const { data, error } = await this.supabase
      .from('property_candidates')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw error;

    // Filter by distance client-side (use Haversine formula)
    const candidates = data || [];
    return candidates.filter((candidate) => {
      if (!candidate.latitude || !candidate.longitude) return false;

      const distance = this.calculateDistance(
        latitude,
        longitude,
        candidate.latitude,
        candidate.longitude
      );

      return distance <= radiusMeters;
    });
  }

  async create(candidate: Omit<PropertyCandidate, 'id' | 'created_at' | 'updated_at'>): Promise<PropertyCandidate> {
    const { data, error } = await this.supabase
      .from('property_candidates')
      .insert(candidate)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<PropertyCandidate>): Promise<PropertyCandidate> {
    const { data, error } = await this.supabase
      .from('property_candidates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMatchStatus(
    id: string,
    matchStatus: PropertyCandidate['match_status'],
    reviewData?: {
      reviewed_by: string;
      reviewed_at?: string;
      duplicate_of_property_id?: string;
      duplicate_confidence?: number;
    }
  ): Promise<PropertyCandidate> {
    const updates: Partial<PropertyCandidate> = { match_status: matchStatus };

    if (reviewData) {
      updates.reviewed_by = reviewData.reviewed_by;
      updates.reviewed_at = reviewData.reviewed_at || new Date().toISOString();

      if (reviewData.duplicate_of_property_id) {
        updates.duplicate_of_property_id = reviewData.duplicate_of_property_id;
        updates.duplicate_confidence = reviewData.duplicate_confidence;
      }
    }

    return this.update(id, updates);
  }

  async markAsConverted(id: string, propertyId: string): Promise<PropertyCandidate> {
    return this.update(id, {
      converted_to_property_id: propertyId,
      converted_at: new Date().toISOString(),
      match_status: 'approved',
    });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('property_candidates')
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
      .from('property_candidates')
      .select('match_status, confidence_score, converted_to_property_id');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const total = data?.length || 0;
    const approved = data?.filter((p) => p.match_status === 'approved').length || 0;
    const rejected = data?.filter((p) => p.match_status === 'rejected').length || 0;
    const pending = data?.filter((p) => ['new', 'potential_duplicate'].includes(p.match_status)).length || 0;
    const converted = data?.filter((p) => p.converted_to_property_id).length || 0;
    const totalConfidence = data?.reduce((sum, p) => sum + (p.confidence_score || 0), 0) || 0;

    return {
      total,
      approved,
      rejected,
      pending,
      conversion_rate: total > 0 ? (converted / total) * 100 : 0,
      avg_confidence: total > 0 ? totalConfidence / total : 0,
    };
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @returns distance in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
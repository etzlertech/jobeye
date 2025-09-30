/**
 * T056: IntakeSessionRepository
 * Repository for managing OCR/intake sessions for business card and work order scanning
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface IntakeSession {
  id: string;
  tenant_id: string;
  user_id: string;
  session_type: 'business_card' | 'work_order' | 'property_sketch' | 'equipment_tag';
  status: 'active' | 'processing' | 'completed' | 'failed';
  photos: Array<{
    photo_id: string;
    url: string;
    timestamp: string;
    ocr_attempted: boolean;
    ocr_confidence?: number;
  }>;
  extracted_data?: Record<string, any>;
  validation_errors?: string[];
  processing_cost?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export class IntakeSessionRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<IntakeSession | null> {
    const { data, error } = await this.supabase
      .from('intake_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findByUserId(userId: string, options?: {
    status?: IntakeSession['status'];
    sessionType?: IntakeSession['session_type'];
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<IntakeSession[]> {
    let query = this.supabase
      .from('intake_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.sessionType) {
      query = query.eq('session_type', options.sessionType);
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

  async findActiveSession(userId: string, sessionType: IntakeSession['session_type']): Promise<IntakeSession | null> {
    const { data, error } = await this.supabase
      .from('intake_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('session_type', sessionType)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  }

  async findByStatus(status: IntakeSession['status'], limit?: number): Promise<IntakeSession[]> {
    let query = this.supabase
      .from('intake_sessions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async create(session: Omit<IntakeSession, 'id' | 'created_at' | 'updated_at'>): Promise<IntakeSession> {
    const { data, error } = await this.supabase
      .from('intake_sessions')
      .insert(session)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<IntakeSession>): Promise<IntakeSession> {
    const { data, error } = await this.supabase
      .from('intake_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addPhoto(
    id: string,
    photo: {
      photo_id: string;
      url: string;
      timestamp: string;
      ocr_attempted: boolean;
      ocr_confidence?: number;
    }
  ): Promise<IntakeSession> {
    const session = await this.findById(id);
    if (!session) throw new Error('Session not found');

    const updatedPhotos = [...session.photos, photo];

    return this.update(id, { photos: updatedPhotos });
  }

  async updateStatus(
    id: string,
    status: IntakeSession['status'],
    additionalData?: {
      extracted_data?: Record<string, any>;
      validation_errors?: string[];
      processing_cost?: number;
      completed_at?: string;
    }
  ): Promise<IntakeSession> {
    const updates: Partial<IntakeSession> = { status };

    if (additionalData?.extracted_data) {
      updates.extracted_data = additionalData.extracted_data;
    }

    if (additionalData?.validation_errors) {
      updates.validation_errors = additionalData.validation_errors;
    }

    if (additionalData?.processing_cost !== undefined) {
      updates.processing_cost = additionalData.processing_cost;
    }

    if (status === 'completed' && !additionalData?.completed_at) {
      updates.completed_at = new Date().toISOString();
    } else if (additionalData?.completed_at) {
      updates.completed_at = additionalData.completed_at;
    }

    return this.update(id, updates);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('intake_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteOlderThan(daysOld: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await this.supabase
      .from('intake_sessions')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
  }
}
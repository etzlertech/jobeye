/**
 * @file /src/domains/inventory/repositories/training-data.repository.class.ts
 * @phase 3.4
 * @feature 004-voice-vision-inventory
 * @purpose Repository for training data records (class-based)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { z } from 'zod';

// Type definitions
export const TrainingDataRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  dataType: z.enum(['image', 'voice', 'text', 'structured']),
  category: z.string(),
  subcategory: z.string().optional(),
  sourceUrl: z.string().optional(),
  rawData: z.record(z.any()).default({}),
  labeledData: z.record(z.any()).default({}),
  confidence: z.number().min(0).max(1).optional(),
  isVerified: z.boolean().default(false),
  verifiedBy: z.string().uuid().optional(),
  verifiedAt: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  voiceSessionId: z.string().uuid().optional(),
  detectionSessionId: z.string().uuid().optional(),
  createdAt: z.string(),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string(),
});

export type TrainingDataRecord = z.infer<typeof TrainingDataRecordSchema>;

export const TrainingDataRecordCreateSchema = TrainingDataRecordSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TrainingDataRecordCreate = z.infer<typeof TrainingDataRecordCreateSchema>;

export const TrainingDataRecordUpdateSchema = TrainingDataRecordCreateSchema.partial();
export type TrainingDataRecordUpdate = z.infer<typeof TrainingDataRecordUpdateSchema>;

export interface TrainingDataFilter {
  tenantId?: string;
  dataType?: 'image' | 'voice' | 'text' | 'structured';
  category?: string;
  subcategory?: string;
  isVerified?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class TrainingDataRepository extends BaseRepository<'training_data_records'> {
  constructor(supabaseClient: SupabaseClient) {
    super('training_data_records', supabaseClient);
  }

  /**
   * Find training data record by ID
   */
  async findById(id: string): Promise<TrainingDataRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapFromDb(data);
    } catch (error) {
      throw createAppError({
        code: 'TRAINING_DATA_FIND_FAILED',
        message: `Failed to find training data record: ${id}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find training data by company
   */
  async findByCompany(tenantId: string, limit = 100): Promise<TrainingDataRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((item: any) => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'TRAINING_DATA_BY_COMPANY_FAILED',
        message: 'Failed to find training data by company',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find training data with filters
   */
  async findAll(options: {
    filters?: TrainingDataFilter;
    limit?: number;
    offset?: number;
  }): Promise<{ data: TrainingDataRecord[]; count: number }> {
    try {
      let query = this.supabaseClient
        .from(this.tableName)
        .select('*', { count: 'exact' });

      // Apply filters
      if (options.filters) {
        const { filters } = options;

        if (filters.tenantId) {
          query = query.eq('tenant_id', filters.tenantId);
        }
        if (filters.dataType) {
          query = query.eq('data_type', filters.dataType);
        }
        if (filters.category) {
          query = query.eq('category', filters.category);
        }
        if (filters.subcategory) {
          query = query.eq('subcategory', filters.subcategory);
        }
        if (filters.isVerified !== undefined) {
          query = query.eq('is_verified', filters.isVerified);
        }
        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }
      }

      // Pagination
      const limit = options.limit ?? 100;
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      // Order by creation date descending
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map((item: any) => this.mapFromDb(item)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'TRAINING_DATA_LIST_FAILED',
        message: 'Failed to list training data',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create training data record
   */
  async create(data: TrainingDataRecordCreate): Promise<TrainingDataRecord> {
    try {
      const validated = TrainingDataRecordCreateSchema.parse(data);

      const { data: created, error } = await this.supabaseClient
        .from(this.tableName)
        .insert(this.mapToDb(validated))
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(created);
    } catch (error) {
      throw createAppError({
        code: 'TRAINING_DATA_CREATE_FAILED',
        message: 'Failed to create training data record',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update training data record
   */
  async update(id: string, data: TrainingDataRecordUpdate): Promise<TrainingDataRecord> {
    try {
      const validated = TrainingDataRecordUpdateSchema.parse(data);

      const { data: updated, error } = await this.supabaseClient
        .from(this.tableName)
        .update({
          ...this.mapToDb(validated),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(updated);
    } catch (error) {
      throw createAppError({
        code: 'TRAINING_DATA_UPDATE_FAILED',
        message: 'Failed to update training data record',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete training data record
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      throw createAppError({
        code: 'TRAINING_DATA_DELETE_FAILED',
        message: 'Failed to delete training data record',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Verify training data record
   */
  async verify(id: string, verifiedBy: string): Promise<TrainingDataRecord> {
    try {
      return await this.update(id, {
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      throw createAppError({
        code: 'TRAINING_DATA_VERIFY_FAILED',
        message: 'Failed to verify training data record',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get unverified records for review
   */
  async getUnverifiedRecords(
    tenantId: string,
    limit = 50
  ): Promise<TrainingDataRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_verified', false)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((item: any) => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'UNVERIFIED_RECORDS_FAILED',
        message: 'Failed to get unverified records',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get training data statistics
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    verified: number;
    unverified: number;
    byDataType: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('data_type, category, is_verified')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      const records = data || [];
      const byDataType: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      
      let verified = 0;
      let unverified = 0;

      records.forEach(record => {
        // Count by verification status
        if (record.is_verified) {
          verified++;
        } else {
          unverified++;
        }

        // Count by data type
        byDataType[record.data_type] = (byDataType[record.data_type] || 0) + 1;

        // Count by category
        byCategory[record.category] = (byCategory[record.category] || 0) + 1;
      });

      return {
        total: records.length,
        verified,
        unverified,
        byDataType,
        byCategory,
      };
    } catch (error) {
      throw createAppError({
        code: 'TRAINING_DATA_STATS_FAILED',
        message: 'Failed to get training data statistics',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Map from database format to domain model
   */
  private mapFromDb(data: any): TrainingDataRecord {
    return TrainingDataRecordSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      dataType: data.data_type,
      category: data.category,
      subcategory: data.subcategory,
      sourceUrl: data.source_url,
      rawData: data.raw_data,
      labeledData: data.labeled_data,
      confidence: data.confidence,
      isVerified: data.is_verified,
      verifiedBy: data.verified_by,
      verifiedAt: data.verified_at,
      metadata: data.metadata,
      voiceSessionId: data.voice_session_id,
      detectionSessionId: data.detection_session_id,
      createdAt: data.created_at,
      createdBy: data.created_by,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Map from domain model to database format
   */
  private mapToDb(data: Partial<TrainingDataRecord>): any {
    const mapped: any = {};

    if (data.id !== undefined) mapped.id = data.id;
    if (data.tenantId !== undefined) mapped.tenant_id = data.tenantId;
    if (data.dataType !== undefined) mapped.data_type = data.dataType;
    if (data.category !== undefined) mapped.category = data.category;
    if (data.subcategory !== undefined) mapped.subcategory = data.subcategory;
    if (data.sourceUrl !== undefined) mapped.source_url = data.sourceUrl;
    if (data.rawData !== undefined) mapped.raw_data = data.rawData;
    if (data.labeledData !== undefined) mapped.labeled_data = data.labeledData;
    if (data.confidence !== undefined) mapped.confidence = data.confidence;
    if (data.isVerified !== undefined) mapped.is_verified = data.isVerified;
    if (data.verifiedBy !== undefined) mapped.verified_by = data.verifiedBy;
    if (data.verifiedAt !== undefined) mapped.verified_at = data.verifiedAt;
    if (data.metadata !== undefined) mapped.metadata = data.metadata;
    if (data.voiceSessionId !== undefined) mapped.voice_session_id = data.voiceSessionId;
    if (data.detectionSessionId !== undefined) mapped.detection_session_id = data.detectionSessionId;
    if (data.createdBy !== undefined) mapped.created_by = data.createdBy;

    return mapped;
  }
}

// Export for convenience
export { TrainingDataRecord, TrainingDataRecordCreate, TrainingDataRecordUpdate } from './training-data.repository.class';
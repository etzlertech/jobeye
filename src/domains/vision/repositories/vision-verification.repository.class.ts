/**
 * @file /src/domains/vision/repositories/vision-verification.repository.class.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Repository for vision verification records with RLS (class-based)
 * @complexity_budget 300
 * @test_coverage >=80%
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { BaseRepository } from '@/lib/repositories/base.repository';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { z } from 'zod';

// Type definitions
export const VisionVerificationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kitId: z.string(),
  jobId: z.string().optional(),
  verificationResult: z.enum(['complete', 'incomplete', 'failed', 'unverified']),
  processingMethod: z.enum(['local_yolo', 'remote_yolo', 'cloud_vlm', 'manual']),
  confidenceScore: z.number().min(0).max(1),
  detectionCount: z.number().default(0),
  expectedCount: z.number().default(0),
  processingTimeMs: z.number(),
  costUsd: z.number().default(0),
  imageUrl: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  verifiedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type VisionVerification = z.infer<typeof VisionVerificationSchema>;

export const VisionVerificationCreateSchema = VisionVerificationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VisionVerificationCreate = z.infer<typeof VisionVerificationCreateSchema>;

export const VisionVerificationUpdateSchema = VisionVerificationCreateSchema.partial();
export type VisionVerificationUpdate = z.infer<typeof VisionVerificationUpdateSchema>;

export interface VisionVerificationFilter {
  tenantId?: string;
  kitId?: string;
  jobId?: string;
  verificationResult?: 'complete' | 'incomplete' | 'failed' | 'unverified';
  processingMethod?: 'local_yolo' | 'cloud_vlm' | 'manual';
  verifiedAfter?: string;
  verifiedBefore?: string;
  limit?: number;
  offset?: number;
}

export class VisionVerificationRepository extends BaseRepository<'vision_verifications'> {
  constructor(supabaseClient: SupabaseClient<Database>) {
    super('vision_verifications', supabaseClient);
  }

  /**
   * Find verification by ID
   */
  async findById(id: string): Promise<VisionVerification | null> {
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
        code: 'VERIFICATION_FIND_FAILED',
        message: `Failed to find verification: ${id}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find verifications with filters
   */
  async findAll(options: {
    filters?: VisionVerificationFilter;
    limit?: number;
    offset?: number;
  }): Promise<{ data: VisionVerification[]; count: number }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' });

      // Apply filters
      if (options.filters) {
        const { filters } = options;

        if (filters.tenantId) {
          query = query.eq('tenant_id', filters.tenantId);
        }
        if (filters.kitId) {
          query = query.eq('kit_id', filters.kitId);
        }
        if (filters.jobId) {
          query = query.eq('job_id', filters.jobId);
        }
        if (filters.verificationResult) {
          query = query.eq('verification_result', filters.verificationResult);
        }
        if (filters.processingMethod) {
          query = query.eq('processing_method', filters.processingMethod);
        }
        if (filters.verifiedAfter) {
          query = query.gte('verified_at', filters.verifiedAfter);
        }
        if (filters.verifiedBefore) {
          query = query.lte('verified_at', filters.verifiedBefore);
        }
      }

      // Pagination
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      // Order by most recent first
      query = query.order('verified_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map(item => this.mapFromDb(item)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'VERIFICATION_LIST_FAILED',
        message: 'Failed to list verifications',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create verification record
   */
  async create(data: VisionVerificationCreate): Promise<VisionVerification> {
    try {
      const validated = VisionVerificationCreateSchema.parse(data);

      const { data: created, error } = await this.supabase
        .from(this.tableName)
        .insert(this.mapToDb(validated))
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(created);
    } catch (error) {
      throw createAppError({
        code: 'VERIFICATION_CREATE_FAILED',
        message: 'Failed to create verification',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update verification record
   */
  async update(id: string, data: VisionVerificationUpdate): Promise<VisionVerification> {
    try {
      const validated = VisionVerificationUpdateSchema.parse(data);

      const { data: updated, error } = await this.supabase
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
        code: 'VERIFICATION_UPDATE_FAILED',
        message: 'Failed to update verification',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete verification record
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      throw createAppError({
        code: 'VERIFICATION_DELETE_FAILED',
        message: 'Failed to delete verification',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get verification statistics for a company
   */
  async getVerificationStats(
    tenantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    total: number;
    complete: number;
    incomplete: number;
    failed: number;
    yoloCount: number;
    vlmCount: number;
    avgConfidence: number;
  }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('verification_result, processing_method, confidence_score')
        .eq('tenant_id', tenantId);

      if (startDate) {
        query = query.gte('verified_at', startDate);
      }
      if (endDate) {
        query = query.lte('verified_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          total: 0,
          complete: 0,
          incomplete: 0,
          failed: 0,
          yoloCount: 0,
          vlmCount: 0,
          avgConfidence: 0,
        };
      }

      return {
        total: data.length,
        complete: data.filter(v => v.verification_result === 'complete').length,
        incomplete: data.filter(v => v.verification_result === 'incomplete').length,
        failed: data.filter(v => v.verification_result === 'failed').length,
        yoloCount: data.filter(v => v.processing_method === 'local_yolo').length,
        vlmCount: data.filter(v => v.processing_method === 'cloud_vlm').length,
        avgConfidence: data.reduce((sum, v) => sum + (v.confidence_score || 0), 0) / data.length,
      };
    } catch (error) {
      throw createAppError({
        code: 'VERIFICATION_STATS_FAILED',
        message: 'Failed to get verification statistics',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find most recent verification for a kit
   */
  async findLatestVerificationForKit(kitId: string): Promise<VisionVerification | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('kit_id', kitId)
        .order('verified_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapFromDb(data);
    } catch (error) {
      throw createAppError({
        code: 'LATEST_VERIFICATION_FAILED',
        message: 'Failed to find latest verification for kit',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Map from database format to domain model
   */
  private mapFromDb(data: any): VisionVerification {
    return VisionVerificationSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      kitId: data.kit_id,
      jobId: data.job_id,
      verificationResult: data.verification_result,
      processingMethod: data.processing_method,
      confidenceScore: data.confidence_score,
      detectionCount: data.detection_count,
      expectedCount: data.expected_count,
      processingTimeMs: data.processing_time_ms,
      costUsd: data.cost_usd,
      imageUrl: data.image_url,
      metadata: data.metadata,
      verifiedAt: data.verified_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Map from domain model to database format
   */
  private mapToDb(data: Partial<VisionVerification>): any {
    const mapped: any = {};

    if (data.id !== undefined) mapped.id = data.id;
    if (data.tenantId !== undefined) mapped.tenant_id = data.tenantId;
    if (data.kitId !== undefined) mapped.kit_id = data.kitId;
    if (data.jobId !== undefined) mapped.job_id = data.jobId;
    if (data.verificationResult !== undefined) mapped.verification_result = data.verificationResult;
    if (data.processingMethod !== undefined) mapped.processing_method = data.processingMethod;
    if (data.confidenceScore !== undefined) mapped.confidence_score = data.confidenceScore;
    if (data.detectionCount !== undefined) mapped.detection_count = data.detectionCount;
    if (data.expectedCount !== undefined) mapped.expected_count = data.expectedCount;
    if (data.processingTimeMs !== undefined) mapped.processing_time_ms = data.processingTimeMs;
    if (data.costUsd !== undefined) mapped.cost_usd = data.costUsd;
    if (data.imageUrl !== undefined) mapped.image_url = data.imageUrl;
    if (data.metadata !== undefined) mapped.metadata = data.metadata;
    if (data.verifiedAt !== undefined) mapped.verified_at = data.verifiedAt;

    return mapped;
  }
}

// Export for convenience
export { VisionVerification, VisionVerificationCreate, VisionVerificationUpdate } from './vision-verification.repository.class';

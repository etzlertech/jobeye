/**
 * @file /src/domains/vision/repositories/detected-item.repository.class.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Repository for detected items in vision verifications (class-based)
 * @complexity_budget 250
 * @test_coverage ≥80%
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { z } from 'zod';

// Type definitions
export const DetectedItemSchema = z.object({
  id: z.string().uuid(),
  verificationId: z.string().uuid(),
  itemType: z.string(),
  itemName: z.string().optional(),
  confidenceScore: z.number().min(0).max(1),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  matchStatus: z.enum(['matched', 'unmatched', 'uncertain']),
  expectedItemId: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DetectedItem = z.infer<typeof DetectedItemSchema>;

export const DetectedItemCreateSchema = DetectedItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DetectedItemCreate = z.infer<typeof DetectedItemCreateSchema>;

export const DetectedItemUpdateSchema = DetectedItemCreateSchema.partial();
export type DetectedItemUpdate = z.infer<typeof DetectedItemUpdateSchema>;

export interface DetectedItemFilter {
  verificationId?: string;
  itemType?: string;
  matchStatus?: 'matched' | 'unmatched' | 'uncertain';
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export class DetectedItemRepository extends BaseRepository<DetectedItem> {
  constructor(supabaseClient: SupabaseClient) {
    super('vision_detected_items', supabaseClient);
  }

  /**
   * Find detected item by ID
   */
  async findById(id: string): Promise<DetectedItem | null> {
    try {
      const { data, error } = await this.supabaseClient
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
        code: 'DETECTED_ITEM_FIND_FAILED',
        message: `Failed to find detected item: ${id}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find detected items with filters
   */
  async findAll(options: {
    filters?: DetectedItemFilter;
    limit?: number;
    offset?: number;
  }): Promise<{ data: DetectedItem[]; count: number }> {
    try {
      let query = this.supabaseClient
        .from(this.tableName)
        .select('*', { count: 'exact' });

      // Apply filters
      if (options.filters) {
        const { filters } = options;

        if (filters.verificationId) {
          query = query.eq('verification_id', filters.verificationId);
        }
        if (filters.itemType) {
          query = query.eq('item_type', filters.itemType);
        }
        if (filters.matchStatus) {
          query = query.eq('match_status', filters.matchStatus);
        }
        if (filters.minConfidence !== undefined) {
          query = query.gte('confidence_score', filters.minConfidence);
        }
      }

      // Pagination
      const limit = options.limit ?? 100;
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      // Order by confidence descending
      query = query.order('confidence_score', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map(item => this.mapFromDb(item)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'DETECTED_ITEM_LIST_FAILED',
        message: 'Failed to list detected items',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all detected items for a verification
   */
  async findByVerificationId(verificationId: string): Promise<DetectedItem[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('*')
        .eq('verification_id', verificationId)
        .order('confidence_score', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'DETECTED_ITEMS_BY_VERIFICATION_FAILED',
        message: 'Failed to find detected items for verification',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create detected item
   */
  async create(data: DetectedItemCreate): Promise<DetectedItem> {
    try {
      const validated = DetectedItemCreateSchema.parse(data);

      const { data: created, error } = await this.supabaseClient
        .from(this.tableName)
        .insert(this.mapToDb(validated))
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(created);
    } catch (error) {
      throw createAppError({
        code: 'DETECTED_ITEM_CREATE_FAILED',
        message: 'Failed to create detected item',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create multiple detected items (bulk insert)
   */
  async createMany(items: DetectedItemCreate[]): Promise<DetectedItem[]> {
    try {
      const validated = items.map(item => DetectedItemCreateSchema.parse(item));

      const { data: created, error } = await this.supabaseClient
        .from(this.tableName)
        .insert(validated.map(item => this.mapToDb(item)))
        .select();

      if (error) throw error;

      return (created || []).map(item => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'DETECTED_ITEMS_CREATE_FAILED',
        message: 'Failed to create detected items',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update detected item
   */
  async update(id: string, data: DetectedItemUpdate): Promise<DetectedItem> {
    try {
      const validated = DetectedItemUpdateSchema.parse(data);

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
        code: 'DETECTED_ITEM_UPDATE_FAILED',
        message: 'Failed to update detected item',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete detected item
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
        code: 'DETECTED_ITEM_DELETE_FAILED',
        message: 'Failed to delete detected item',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete all items for a verification
   */
  async deleteByVerificationId(verificationId: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from(this.tableName)
        .delete()
        .eq('verification_id', verificationId);

      if (error) throw error;
    } catch (error) {
      throw createAppError({
        code: 'DETECTED_ITEMS_DELETE_FAILED',
        message: 'Failed to delete detected items for verification',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get item statistics for a verification
   */
  async getStatsForVerification(verificationId: string): Promise<{
    total: number;
    matched: number;
    unmatched: number;
    uncertain: number;
    avgConfidence: number;
    itemTypes: { itemType: string; count: number }[];
  }> {
    try {
      const items = await this.findByVerificationId(verificationId);

      if (items.length === 0) {
        return {
          total: 0,
          matched: 0,
          unmatched: 0,
          uncertain: 0,
          avgConfidence: 0,
          itemTypes: [],
        };
      }

      // Calculate item type counts
      const itemTypeCounts = items.reduce((acc, item) => {
        const existing = acc.find(i => i.itemType === item.itemType);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ itemType: item.itemType, count: 1 });
        }
        return acc;
      }, [] as { itemType: string; count: number }[]);

      return {
        total: items.length,
        matched: items.filter(i => i.matchStatus === 'matched').length,
        unmatched: items.filter(i => i.matchStatus === 'unmatched').length,
        uncertain: items.filter(i => i.matchStatus === 'uncertain').length,
        avgConfidence: items.reduce((sum, i) => sum + i.confidenceScore, 0) / items.length,
        itemTypes: itemTypeCounts.sort((a, b) => b.count - a.count),
      };
    } catch (error) {
      throw createAppError({
        code: 'DETECTED_ITEM_STATS_FAILED',
        message: 'Failed to get detected item statistics',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Map from database format to domain model
   */
  private mapFromDb(data: any): DetectedItem {
    return DetectedItemSchema.parse({
      id: data.id,
      verificationId: data.verification_id,
      itemType: data.item_type,
      itemName: data.item_name,
      confidenceScore: data.confidence_score,
      boundingBox: data.bounding_box,
      matchStatus: data.match_status,
      expectedItemId: data.expected_item_id,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Map from domain model to database format
   */
  private mapToDb(data: Partial<DetectedItem>): any {
    const mapped: any = {};

    if (data.id !== undefined) mapped.id = data.id;
    if (data.verificationId !== undefined) mapped.verification_id = data.verificationId;
    if (data.itemType !== undefined) mapped.item_type = data.itemType;
    if (data.itemName !== undefined) mapped.item_name = data.itemName;
    if (data.confidenceScore !== undefined) mapped.confidence_score = data.confidenceScore;
    if (data.boundingBox !== undefined) mapped.bounding_box = data.boundingBox;
    if (data.matchStatus !== undefined) mapped.match_status = data.matchStatus;
    if (data.expectedItemId !== undefined) mapped.expected_item_id = data.expectedItemId;
    if (data.metadata !== undefined) mapped.metadata = data.metadata;

    return mapped;
  }
}

// Export for convenience
export { DetectedItem, DetectedItemCreate, DetectedItemUpdate } from './detected-item.repository.class';
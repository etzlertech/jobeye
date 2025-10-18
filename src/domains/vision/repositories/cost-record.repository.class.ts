/**
 * @file /src/domains/vision/repositories/cost-record.repository.class.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Repository for VLM cost tracking with budget enforcement (class-based)
 * @complexity_budget 300
 * @test_coverage >=80%
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { BaseRepository } from '@/lib/repositories/base.repository';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { z } from 'zod';

// Type definitions
export const CostRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  verificationId: z.string().uuid().optional(),
  provider: z.string(),
  model: z.string().optional(),
  operation: z.string(),
  tokenCount: z.number().default(0),
  costUsd: z.number().min(0),
  metadata: z.record(z.any()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CostRecord = z.infer<typeof CostRecordSchema>;

export const CostRecordCreateSchema = CostRecordSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CostRecordCreate = z.infer<typeof CostRecordCreateSchema>;

export interface CostRecordFilter {
  tenantId?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface DailyCostSummary {
  date: string;
  totalCost: number;
  requestCount: number;
  avgCostPerRequest: number;
}

export interface ProviderStats {
  provider: string;
  totalCost: number;
  requestCount: number;
  avgCost: number;
}

export interface BudgetStatus {
  allowed: boolean;
  reason?: string;
  currentCost: number;
  currentRequests: number;
  remainingBudget: number;
  remainingRequests: number;
}

type CostRecordRow = Database['public']['Tables']['vision_cost_records']['Row'];
type CostRecordInsert = Database['public']['Tables']['vision_cost_records']['Insert'];

export class CostRecordRepository extends BaseRepository<'vision_cost_records'> {
  constructor(supabaseClient: SupabaseClient) {
    super('vision_cost_records', supabaseClient);
  }

  private recordsTable() {
    return this.supabase.from('vision_cost_records') as any;
  }

  /**
   * Find cost record by ID
   */
  async findById(id: string): Promise<CostRecord | null> {
    try {
      const { data, error } = await this.recordsTable()
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapFromDb(data as CostRecordRow);
    } catch (error) {
      throw createAppError({
        code: 'COST_RECORD_FIND_FAILED',
        message: `Failed to find cost record: ${id}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find cost records with filters
   */
  async findAll(options: {
    filters?: CostRecordFilter;
    limit?: number;
    offset?: number;
  }): Promise<{ data: CostRecord[]; count: number }> {
    try {
      let query = this.recordsTable()
        .select('*', { count: 'exact' });

      // Apply filters
      if (options.filters) {
        const { filters } = options;

        if (filters.tenantId) {
          query = query.eq('tenant_id', filters.tenantId);
        }
        if (filters.provider) {
          query = query.eq('provider', filters.provider);
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

      // Order by most recent first
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      const rows = (data ?? []) as CostRecordRow[];
      return {
        data: rows.map(item => this.mapFromDb(item)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'COST_RECORD_LIST_FAILED',
        message: 'Failed to list cost records',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create cost record
   */
  async create(data: CostRecordCreate): Promise<CostRecord> {
    try {
      const validated = CostRecordCreateSchema.parse(data);

      const insertPayload = this.mapToDb(validated) as CostRecordInsert;

      const { data: created, error } = await this.recordsTable()
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(created as CostRecordRow);
    } catch (error) {
      throw createAppError({
        code: 'COST_RECORD_CREATE_FAILED',
        message: 'Failed to create cost record',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get today's cost for a company
   */
  async getTodaysCost(tenantId: string): Promise<{ totalCost: number; requestCount: number }> {
    try {
      // Get start of today in UTC
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data, error } = await this.recordsTable()
        .select('cost_usd')
        .eq('tenant_id', tenantId)
        .gte('created_at', todayISO);

      if (error) throw error;

      const rows = (data ?? []) as Array<{ cost_usd: number }>;
      const totalCost = rows.reduce((sum, record) => sum + Number(record.cost_usd), 0);
      const requestCount = rows.length;

      return { totalCost, requestCount };
    } catch (error) {
      throw createAppError({
        code: 'TODAY_COST_FAILED',
        message: 'Failed to get today\'s cost',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get daily cost summaries for a date range
   */
  async getDailyCostSummaries(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyCostSummary[]> {
    try {
      const { data, error } = await this.recordsTable()
        .select('created_at, cost_usd')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const dailyMap = new Map<string, { totalCost: number; count: number }>();

      const rows = (data ?? []) as Array<{ created_at: string; cost_usd: number }>;

      rows.forEach(record => {
        const date = record.created_at.split('T')[0]; // Get YYYY-MM-DD
        const existing = dailyMap.get(date);

        if (existing) {
          existing.totalCost += Number(record.cost_usd);
          existing.count += 1;
        } else {
          dailyMap.set(date, {
            totalCost: Number(record.cost_usd),
            count: 1,
          });
        }
      });

      // Convert to array
      return Array.from(dailyMap.entries()).map(([date, stats]) => ({
        date,
        totalCost: stats.totalCost,
        requestCount: stats.count,
        avgCostPerRequest: stats.totalCost / stats.count,
      }));
    } catch (error) {
      throw createAppError({
        code: 'DAILY_SUMMARIES_FAILED',
        message: 'Failed to get daily cost summaries',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get total cost for a company within date range
   */
  async getTotalCost(
    tenantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ totalCost: number; requestCount: number }> {
    try {
      let query = this.recordsTable()
        .select('cost_usd')
        .eq('tenant_id', tenantId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      const rows = (data ?? []) as Array<{ cost_usd: number }>;
      const totalCost = rows.reduce((sum, record) => sum + Number(record.cost_usd), 0);
      const requestCount = rows.length;

      return { totalCost, requestCount };
    } catch (error) {
      throw createAppError({
        code: 'TOTAL_COST_FAILED',
        message: 'Failed to get total cost',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Check if company can make VLM request based on budget
   */
  async canMakeVlmRequest(
    tenantId: string,
    dailyBudgetLimit: number = 10.0,
    dailyRequestLimit: number = 100
  ): Promise<BudgetStatus> {
    try {
      const { totalCost, requestCount } = await this.getTodaysCost(tenantId);
      const remainingBudget = dailyBudgetLimit - totalCost;
      const remainingRequests = dailyRequestLimit - requestCount;

      let allowed = true;
      let reason: string | undefined;

      if (requestCount >= dailyRequestLimit) {
        allowed = false;
        reason = `Daily request limit reached (${dailyRequestLimit} requests)`;
      } else if (totalCost >= dailyBudgetLimit) {
        allowed = false;
        reason = `Daily budget limit reached ($${dailyBudgetLimit.toFixed(2)})`;
      }

      return {
        allowed,
        reason,
        currentCost: totalCost,
        currentRequests: requestCount,
        remainingBudget,
        remainingRequests,
      };
    } catch (error) {
      throw createAppError({
        code: 'BUDGET_CHECK_FAILED',
        message: 'Failed to check VLM request budget',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get cost statistics by provider
   */
  async getCostStatsByProvider(
    tenantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ProviderStats[]> {
    try {
      let query = this.recordsTable()
        .select('provider, cost_usd')
        .eq('tenant_id', tenantId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by provider
      const providerMap = new Map<string, { totalCost: number; count: number }>();

      const rows = (data ?? []) as Array<{ provider: string; cost_usd: number }>;

      rows.forEach(record => {
        const existing = providerMap.get(record.provider);

        if (existing) {
          existing.totalCost += Number(record.cost_usd);
          existing.count += 1;
        } else {
          providerMap.set(record.provider, {
            totalCost: Number(record.cost_usd),
            count: 1,
          });
        }
      });

      // Convert to array
      return Array.from(providerMap.entries()).map(([provider, data]) => ({
        provider,
        totalCost: data.totalCost,
        requestCount: data.count,
        avgCost: data.totalCost / data.count,
      }));
    } catch (error) {
      throw createAppError({
        code: 'PROVIDER_STATS_FAILED',
        message: 'Failed to get cost statistics by provider',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Map from database format to domain model
   */
  private mapFromDb(data: CostRecordRow): CostRecord {
    return CostRecordSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      verificationId: data.verification_id,
      provider: data.provider,
      model: data.model,
      operation: data.operation,
      tokenCount: data.token_count,
      costUsd: data.cost_usd,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Map from domain model to database format
   */
  private mapToDb(data: Partial<CostRecord>): Partial<CostRecordRow> {
    const mapped: Partial<CostRecordRow> = {};

    if (data.id !== undefined) mapped.id = data.id;
    if (data.tenantId !== undefined) mapped.tenant_id = data.tenantId;
    if (data.verificationId !== undefined) mapped.verification_id = data.verificationId;
    if (data.provider !== undefined) mapped.provider = data.provider;
    if (data.model !== undefined) mapped.model = data.model;
    if (data.operation !== undefined) mapped.operation = data.operation;
    if (data.tokenCount !== undefined) mapped.token_count = data.tokenCount;
    if (data.costUsd !== undefined) mapped.cost_usd = data.costUsd;
    if (data.metadata !== undefined) mapped.metadata = data.metadata as CostRecordRow['metadata'];

    return mapped;
  }
}

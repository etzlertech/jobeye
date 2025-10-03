/**
 * Repository for item transaction records
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  ItemTransaction,
  ItemTransactionSchema,
  TransactionFilters,
  TransactionType,
} from '@/domains/shared/types/item-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export interface TransactionCreate {
  tenantId: string;
  transactionType: TransactionType;
  itemId: string;
  quantity?: number;
  fromLocationId?: string;
  toLocationId?: string;
  fromUserId?: string;
  toUserId?: string;
  jobId?: string;
  purchaseOrderId?: string;
  workOrderId?: string;
  cost?: number;
  notes?: string;
  reason?: string;
  voiceSessionId?: string;
  detectionSessionId?: string;
  confidenceScore?: number;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export class ItemTransactionRepository extends BaseRepository<ItemTransaction> {
  constructor(supabaseClient: SupabaseClient) {
    super('item_transactions', supabaseClient);
  }

  /**
   * Create transaction record
   */
  async create(data: TransactionCreate): Promise<ItemTransaction> {
    try {
      const { data: created, error } = await this.supabaseClient
        .from(this.tableName)
        .insert(this.mapToDb(data))
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(created);
    } catch (error) {
      throw createAppError({
        code: 'TRANSACTION_CREATE_FAILED',
        message: 'Failed to create transaction',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find transactions with filters
   */
  async findAll(options: {
    tenantId: string;
    filters?: TransactionFilters;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ItemTransaction[]; count: number }> {
    try {
      let query = this.supabaseClient
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      // Apply filters
      if (options.filters) {
        const { filters } = options;
        
        if (filters.transactionType) {
          query = query.eq('transaction_type', filters.transactionType);
        }
        if (filters.itemId) {
          query = query.eq('item_id', filters.itemId);
        }
        if (filters.jobId) {
          query = query.eq('job_id', filters.jobId);
        }
        if (filters.fromLocationId) {
          query = query.eq('from_location_id', filters.fromLocationId);
        }
        if (filters.toLocationId) {
          query = query.eq('to_location_id', filters.toLocationId);
        }
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      // Order by created_at desc
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map(item => this.mapFromDb(item)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'TRANSACTION_LIST_FAILED',
        message: 'Failed to list transactions',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get transaction history for an item
   */
  async getItemHistory(itemId: string, tenantId: string, limit = 50): Promise<ItemTransaction[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(item => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'ITEM_HISTORY_FAILED',
        message: 'Failed to get item history',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get recent transactions for a location
   */
  async getLocationActivity(locationId: string, tenantId: string, limit = 50): Promise<ItemTransaction[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(item => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'LOCATION_ACTIVITY_FAILED',
        message: 'Failed to get location activity',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get job-related transactions
   */
  async getJobTransactions(jobId: string, tenantId: string): Promise<ItemTransaction[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'JOB_TRANSACTIONS_FAILED',
        message: 'Failed to get job transactions',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get transaction summary for reporting
   */
  async getTransactionSummary(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    groupBy: 'transaction_type' | 'item_id' | 'job_id'
  ): Promise<Array<{ group: string; count: number; total_quantity: number }>> {
    try {
      const { data, error } = await this.supabaseClient
        .rpc('get_transaction_summary', {
          p_tenant_id: tenantId,
          p_date_from: dateFrom,
          p_date_to: dateTo,
          p_group_by: groupBy
        });

      if (error) throw error;

      return data || [];
    } catch (error) {
      throw createAppError({
        code: 'TRANSACTION_SUMMARY_FAILED',
        message: 'Failed to get transaction summary',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Map from database format to domain model
   */
  private mapFromDb(data: any): ItemTransaction {
    return ItemTransactionSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      transactionType: data.transaction_type,
      itemId: data.item_id,
      quantity: data.quantity,
      fromLocationId: data.from_location_id,
      toLocationId: data.to_location_id,
      fromUserId: data.from_user_id,
      toUserId: data.to_user_id,
      jobId: data.job_id,
      purchaseOrderId: data.purchase_order_id,
      workOrderId: data.work_order_id,
      cost: data.cost,
      notes: data.notes,
      reason: data.reason,
      voiceSessionId: data.voice_session_id,
      detectionSessionId: data.detection_session_id,
      confidenceScore: data.confidence_score,
      metadata: data.metadata,
      createdAt: data.created_at,
      createdBy: data.created_by,
    });
  }

  /**
   * Map from domain model to database format
   */
  private mapToDb(data: Partial<ItemTransaction> | TransactionCreate): any {
    const mapped: any = {};
    
    if ('id' in data && data.id !== undefined) mapped.id = data.id;
    if ('tenantId' in data && data.tenantId !== undefined) mapped.tenant_id = data.tenantId;
    if ('transactionType' in data && data.transactionType !== undefined) mapped.transaction_type = data.transactionType;
    if ('itemId' in data && data.itemId !== undefined) mapped.item_id = data.itemId;
    if ('quantity' in data && data.quantity !== undefined) mapped.quantity = data.quantity;
    if ('fromLocationId' in data && data.fromLocationId !== undefined) mapped.from_location_id = data.fromLocationId;
    if ('toLocationId' in data && data.toLocationId !== undefined) mapped.to_location_id = data.toLocationId;
    if ('fromUserId' in data && data.fromUserId !== undefined) mapped.from_user_id = data.fromUserId;
    if ('toUserId' in data && data.toUserId !== undefined) mapped.to_user_id = data.toUserId;
    if ('jobId' in data && data.jobId !== undefined) mapped.job_id = data.jobId;
    if ('purchaseOrderId' in data && data.purchaseOrderId !== undefined) mapped.purchase_order_id = data.purchaseOrderId;
    if ('workOrderId' in data && data.workOrderId !== undefined) mapped.work_order_id = data.workOrderId;
    if ('cost' in data && data.cost !== undefined) mapped.cost = data.cost;
    if ('notes' in data && data.notes !== undefined) mapped.notes = data.notes;
    if ('reason' in data && data.reason !== undefined) mapped.reason = data.reason;
    if ('voiceSessionId' in data && data.voiceSessionId !== undefined) mapped.voice_session_id = data.voiceSessionId;
    if ('detectionSessionId' in data && data.detectionSessionId !== undefined) mapped.detection_session_id = data.detectionSessionId;
    if ('confidenceScore' in data && data.confidenceScore !== undefined) mapped.confidence_score = data.confidenceScore;
    if ('metadata' in data && data.metadata !== undefined) mapped.metadata = data.metadata;
    if ('createdBy' in data && data.createdBy !== undefined) mapped.created_by = data.createdBy;

    return mapped;
  }
}
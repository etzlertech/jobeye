/**
 * Repository for item transaction records backed by the shared `item_transactions` table.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  ItemTransaction,
  ItemTransactionSchema,
  TransactionFilters,
  TransactionType,
} from '@/domains/shared/types/item-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

type ItemTransactionsTable = Database['public']['Tables']['item_transactions'];
type ItemTransactionRow = ItemTransactionsTable['Row'];
type ItemTransactionInsert = ItemTransactionsTable['Insert'];
type ItemTransactionUpdate = ItemTransactionsTable['Update'];

const ITEM_TRANSACTIONS_TABLE = 'item_transactions' as const;

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
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export class ItemTransactionRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private get client(): SupabaseClient<any> {
    return this.supabase as unknown as SupabaseClient<any>;
  }

  /**
   * Create a new transaction record.
   */
  async create(data: TransactionCreate): Promise<ItemTransaction> {
    try {
      const insertPayload: ItemTransactionInsert = {
        tenant_id: data.tenantId,
        transaction_type: data.transactionType,
        item_id: data.itemId,
        quantity: data.quantity ?? 1,
        from_location_id: data.fromLocationId ?? null,
        to_location_id: data.toLocationId ?? null,
        from_user_id: data.fromUserId ?? null,
        to_user_id: data.toUserId ?? null,
        job_id: data.jobId ?? null,
        purchase_order_id: data.purchaseOrderId ?? null,
        work_order_id: data.workOrderId ?? null,
        cost: data.cost ?? null,
        notes: data.notes ?? null,
        reason: data.reason ?? null,
        voice_session_id: data.voiceSessionId ?? null,
        detection_session_id: data.detectionSessionId ?? null,
        confidence_score: data.confidenceScore ?? null,
        metadata: (data.metadata ?? null) as ItemTransactionInsert['metadata'],
        created_by: data.createdBy ?? null,
      };

      const { data: created, error } = await this.client
        .from(ITEM_TRANSACTIONS_TABLE)
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapRow(created as ItemTransactionRow);
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
   * Find transactions with filtering and pagination support.
   */
  async findAll(options: {
    tenantId: string;
    filters?: TransactionFilters;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ItemTransaction[]; count: number }> {
    try {
      let query = this.client
        .from(ITEM_TRANSACTIONS_TABLE)
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      const { filters } = options;
      if (filters) {
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

      if (options.limit !== undefined) {
        query = query.limit(options.limit);
      }
      if (options.offset !== undefined) {
        const rangeEnd = options.offset + (options.limit ?? 10) - 1;
        query = query.range(options.offset, rangeEnd);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: (data as ItemTransactionRow[] | null)?.map((row) => this.mapRow(row)) ?? [],
        count: count ?? 0,
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
   * Retrieve the transaction history for a specific item.
   */
  async getItemHistory(itemId: string, tenantId: string, limit = 50): Promise<ItemTransaction[]> {
    try {
      const { data, error } = await this.client
        .from(ITEM_TRANSACTIONS_TABLE)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data as ItemTransactionRow[] | null)?.map((row) => this.mapRow(row)) ?? [];
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
   * Retrieve recent transactions for a location (either origin or destination).
   */
  async getLocationActivity(locationId: string, tenantId: string, limit = 50): Promise<ItemTransaction[]> {
    try {
      const { data, error } = await this.client
        .from(ITEM_TRANSACTIONS_TABLE)
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data as ItemTransactionRow[] | null)?.map((row) => this.mapRow(row)) ?? [];
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
   * Retrieve the transactions associated with a specific job.
   */
  async getJobTransactions(jobId: string, tenantId: string): Promise<ItemTransaction[]> {
    try {
      const { data, error } = await this.client
        .from(ITEM_TRANSACTIONS_TABLE)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data as ItemTransactionRow[] | null)?.map((row) => this.mapRow(row)) ?? [];
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
   * Aggregate transaction activity via the `get_transaction_summary` RPC.
   */
  async getTransactionSummary(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    groupBy: 'transaction_type' | 'item_id' | 'job_id'
  ): Promise<Array<{ group: string; count: number; total_quantity: number }>> {
    try {
      const { data, error } = await (this.supabase.rpc as any)('get_transaction_summary', {
        p_tenant_id: tenantId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_group_by: groupBy,
      });

      if (error) throw error;

      return (data as Array<{ group: string; count: number; total_quantity: number }> | null) ?? [];
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
   * Update helper for internal consumers (kept for API parity with existing service logic).
   */
  async update(id: string, updates: Partial<ItemTransaction>): Promise<ItemTransaction> {
    try {
      const updatePayload: ItemTransactionUpdate = {};

      if (updates.transactionType !== undefined) updatePayload.transaction_type = updates.transactionType;
      if (updates.itemId !== undefined) updatePayload.item_id = updates.itemId;
      if (updates.quantity !== undefined) updatePayload.quantity = updates.quantity;
      if (updates.fromLocationId !== undefined) updatePayload.from_location_id = updates.fromLocationId ?? null;
      if (updates.toLocationId !== undefined) updatePayload.to_location_id = updates.toLocationId ?? null;
      if (updates.fromUserId !== undefined) updatePayload.from_user_id = updates.fromUserId ?? null;
      if (updates.toUserId !== undefined) updatePayload.to_user_id = updates.toUserId ?? null;
      if (updates.jobId !== undefined) updatePayload.job_id = updates.jobId ?? null;
      if (updates.purchaseOrderId !== undefined) updatePayload.purchase_order_id = updates.purchaseOrderId ?? null;
      if (updates.workOrderId !== undefined) updatePayload.work_order_id = updates.workOrderId ?? null;
      if (updates.cost !== undefined) updatePayload.cost = updates.cost ?? null;
      if (updates.notes !== undefined) updatePayload.notes = updates.notes ?? null;
      if (updates.reason !== undefined) updatePayload.reason = updates.reason ?? null;
      if (updates.voiceSessionId !== undefined) updatePayload.voice_session_id = updates.voiceSessionId ?? null;
      if (updates.detectionSessionId !== undefined) updatePayload.detection_session_id = updates.detectionSessionId ?? null;
      if (updates.confidenceScore !== undefined) updatePayload.confidence_score = updates.confidenceScore ?? null;
      if (updates.metadata !== undefined) {
        updatePayload.metadata = (updates.metadata ?? null) as ItemTransactionUpdate['metadata'];
      }
      if (updates.createdBy !== undefined) updatePayload.created_by = updates.createdBy ?? null;

      const { data, error } = await this.client
        .from(ITEM_TRANSACTIONS_TABLE)
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapRow(data as ItemTransactionRow);
    } catch (error) {
      throw createAppError({
        code: 'TRANSACTION_UPDATE_FAILED',
        message: 'Failed to update transaction',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  private mapRow(row: ItemTransactionRow): ItemTransaction {
    return ItemTransactionSchema.parse({
      id: row.id,
      tenantId: row.tenant_id,
      transactionType: row.transaction_type,
      itemId: row.item_id,
      quantity: row.quantity ?? 1,
      fromLocationId: row.from_location_id ?? undefined,
      toLocationId: row.to_location_id ?? undefined,
      fromUserId: row.from_user_id ?? undefined,
      toUserId: row.to_user_id ?? undefined,
      jobId: row.job_id ?? undefined,
      purchaseOrderId: row.purchase_order_id ?? undefined,
      workOrderId: row.work_order_id ?? undefined,
      cost: row.cost ?? undefined,
      notes: row.notes ?? undefined,
      reason: row.reason ?? undefined,
      voiceSessionId: row.voice_session_id ?? undefined,
      detectionSessionId: row.detection_session_id ?? undefined,
      confidenceScore: row.confidence_score ?? undefined,
      metadata: (row.metadata as Record<string, unknown> | null) ?? {},
      createdAt: row.created_at ?? new Date().toISOString(),
      createdBy: row.created_by ?? undefined,
    });
  }
}

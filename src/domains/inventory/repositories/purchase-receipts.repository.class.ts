/**
 * @file /src/domains/inventory/repositories/purchase-receipts.repository.class.ts
 * @phase 3.4
 * @feature 004-voice-vision-inventory
 * @purpose Repository for purchase receipts (class-based)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { z } from 'zod';

// Type definitions
export const PurchaseReceiptSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  vendorName: z.string(),
  purchaseDate: z.string(),
  totalAmount: z.number().min(0),
  taxAmount: z.number().min(0).default(0),
  currency: z.string().default('USD'),
  receiptNumber: z.string().optional(),
  imageUrl: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    category: z.string().optional(),
  })).default([]),
  extractedData: z.record(z.any()).default({}),
  voiceSessionId: z.string().uuid().optional(),
  detectionSessionId: z.string().uuid().optional(),
  createdAt: z.string(),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string(),
});

export type PurchaseReceipt = z.infer<typeof PurchaseReceiptSchema>;

export const PurchaseReceiptCreateSchema = PurchaseReceiptSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PurchaseReceiptCreate = z.infer<typeof PurchaseReceiptCreateSchema>;

export const PurchaseReceiptUpdateSchema = PurchaseReceiptCreateSchema.partial();
export type PurchaseReceiptUpdate = z.infer<typeof PurchaseReceiptUpdateSchema>;

export interface PurchaseReceiptFilter {
  tenantId?: string;
  vendorName?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}

export class PurchaseReceiptRepository extends BaseRepository<PurchaseReceipt> {
  constructor(supabaseClient: SupabaseClient) {
    super('purchase_receipts', supabaseClient);
  }

  /**
   * Find purchase receipt by ID
   */
  async findById(id: string): Promise<PurchaseReceipt | null> {
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
        code: 'RECEIPT_FIND_FAILED',
        message: `Failed to find purchase receipt: ${id}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find receipts by company
   */
  async findByCompany(tenantId: string, limit = 50): Promise<PurchaseReceipt[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('purchase_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(item => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'RECEIPTS_BY_COMPANY_FAILED',
        message: 'Failed to find receipts by company',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find receipts with filters
   */
  async findAll(options: {
    filters?: PurchaseReceiptFilter;
    limit?: number;
    offset?: number;
  }): Promise<{ data: PurchaseReceipt[]; count: number }> {
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
        if (filters.vendorName) {
          query = query.ilike('vendor_name', `%${filters.vendorName}%`);
        }
        if (filters.startDate) {
          query = query.gte('purchase_date', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('purchase_date', filters.endDate);
        }
        if (filters.minAmount !== undefined) {
          query = query.gte('total_amount', filters.minAmount);
        }
        if (filters.maxAmount !== undefined) {
          query = query.lte('total_amount', filters.maxAmount);
        }
      }

      // Pagination
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      // Order by purchase date descending
      query = query.order('purchase_date', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map(item => this.mapFromDb(item)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'RECEIPT_LIST_FAILED',
        message: 'Failed to list purchase receipts',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create purchase receipt
   */
  async create(data: PurchaseReceiptCreate): Promise<PurchaseReceipt> {
    try {
      const validated = PurchaseReceiptCreateSchema.parse(data);

      const { data: created, error } = await this.supabaseClient
        .from(this.tableName)
        .insert(this.mapToDb(validated))
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(created);
    } catch (error) {
      throw createAppError({
        code: 'RECEIPT_CREATE_FAILED',
        message: 'Failed to create purchase receipt',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update purchase receipt
   */
  async update(id: string, data: PurchaseReceiptUpdate): Promise<PurchaseReceipt> {
    try {
      const validated = PurchaseReceiptUpdateSchema.parse(data);

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
        code: 'RECEIPT_UPDATE_FAILED',
        message: 'Failed to update purchase receipt',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete purchase receipt
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
        code: 'RECEIPT_DELETE_FAILED',
        message: 'Failed to delete purchase receipt',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get spending summary for a period
   */
  async getSpendingSummary(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalAmount: number;
    totalTax: number;
    receiptCount: number;
    averageAmount: number;
    byVendor: Array<{ vendor: string; amount: number; count: number }>;
  }> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('vendor_name, total_amount, tax_amount')
        .eq('tenant_id', tenantId)
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate);

      if (error) throw error;

      const receipts = data || [];
      const totalAmount = receipts.reduce((sum, r) => sum + r.total_amount, 0);
      const totalTax = receipts.reduce((sum, r) => sum + (r.tax_amount || 0), 0);
      
      // Group by vendor
      const vendorMap = new Map<string, { amount: number; count: number }>();
      receipts.forEach(r => {
        const existing = vendorMap.get(r.vendor_name) || { amount: 0, count: 0 };
        vendorMap.set(r.vendor_name, {
          amount: existing.amount + r.total_amount,
          count: existing.count + 1,
        });
      });

      const byVendor = Array.from(vendorMap.entries())
        .map(([vendor, data]) => ({ vendor, ...data }))
        .sort((a, b) => b.amount - a.amount);

      return {
        totalAmount,
        totalTax,
        receiptCount: receipts.length,
        averageAmount: receipts.length > 0 ? totalAmount / receipts.length : 0,
        byVendor,
      };
    } catch (error) {
      throw createAppError({
        code: 'SPENDING_SUMMARY_FAILED',
        message: 'Failed to get spending summary',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Map from database format to domain model
   */
  private mapFromDb(data: any): PurchaseReceipt {
    return PurchaseReceiptSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      vendorName: data.vendor_name,
      purchaseDate: data.purchase_date,
      totalAmount: data.total_amount,
      taxAmount: data.tax_amount,
      currency: data.currency,
      receiptNumber: data.receipt_number,
      imageUrl: data.image_url,
      items: data.items,
      extractedData: data.extracted_data,
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
  private mapToDb(data: Partial<PurchaseReceipt>): any {
    const mapped: any = {};

    if (data.id !== undefined) mapped.id = data.id;
    if (data.tenantId !== undefined) mapped.tenant_id = data.tenantId;
    if (data.vendorName !== undefined) mapped.vendor_name = data.vendorName;
    if (data.purchaseDate !== undefined) mapped.purchase_date = data.purchaseDate;
    if (data.totalAmount !== undefined) mapped.total_amount = data.totalAmount;
    if (data.taxAmount !== undefined) mapped.tax_amount = data.taxAmount;
    if (data.currency !== undefined) mapped.currency = data.currency;
    if (data.receiptNumber !== undefined) mapped.receipt_number = data.receiptNumber;
    if (data.imageUrl !== undefined) mapped.image_url = data.imageUrl;
    if (data.items !== undefined) mapped.items = data.items;
    if (data.extractedData !== undefined) mapped.extracted_data = data.extractedData;
    if (data.voiceSessionId !== undefined) mapped.voice_session_id = data.voiceSessionId;
    if (data.detectionSessionId !== undefined) mapped.detection_session_id = data.detectionSessionId;
    if (data.createdBy !== undefined) mapped.created_by = data.createdBy;

    return mapped;
  }
}

// Export for convenience
export { PurchaseReceipt, PurchaseReceiptCreate, PurchaseReceiptUpdate } from './purchase-receipts.repository.class';
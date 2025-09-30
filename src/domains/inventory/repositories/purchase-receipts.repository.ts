/**
 * @file /src/domains/inventory/repositories/purchase-receipts.repository.ts
 * @phase 3.4
 * @feature 004-voice-vision-inventory
 */

import { createClient } from '@/lib/supabase/client';
import type { PurchaseReceipt, PurchaseReceiptCreate } from '../types/inventory-types';

export async function create(
  receipt: PurchaseReceiptCreate
): Promise<{ data: PurchaseReceipt | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('purchase_receipts')
    .insert(receipt)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function findById(
  id: string
): Promise<{ data: PurchaseReceipt | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('purchase_receipts')
    .select('*')
    .eq('id', id)
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function findByCompany(
  companyId: string,
  limit = 50
): Promise<{ data: PurchaseReceipt[]; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('purchase_receipts')
    .select('*')
    .eq('company_id', companyId)
    .order('purchase_date', { ascending: false })
    .limit(limit);

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null,
  };
}
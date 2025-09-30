/**
 * @file /src/domains/inventory/repositories/inventory-transactions.repository.ts
 * @phase 3.4
 * @feature 004-voice-vision-inventory
 */

import { createClient } from '@/lib/supabase/client';
import type { InventoryTransaction, InventoryTransactionCreate, TransactionType } from '../types/inventory-types';

export async function create(
  transaction: InventoryTransactionCreate
): Promise<{ data: InventoryTransaction | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('inventory_transactions')
    .insert(transaction)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function findByCompany(
  companyId: string,
  type?: TransactionType,
  limit = 50
): Promise<{ data: InventoryTransaction[]; error: Error | null }> {
  const supabase = createClient();

  let query = supabase
    .from('inventory_transactions')
    .select('*')
    .eq('tenant_id', companyId);

  if (type) {
    query = query.eq('type', type);
  }

  query = query.order('created_at', { ascending: false }).limit(limit);

  const { data, error } = await query;

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null,
  };
}
/**
 * @file /src/domains/inventory/repositories/inventory-items.repository.ts
 * @phase 3.4
 * @domain Inventory
 * @purpose Repository for inventory items with RLS and offline support
 * @complexity_budget 300
 * @test_coverage ≥80%
 * @dependencies @supabase/supabase-js
 * @feature 004-voice-vision-inventory
 */

import { createClient } from '@/lib/supabase/client';
import type {
  InventoryItem,
  InventoryItemCreate,
  InventoryItemUpdate,
  ItemStatus,
  ItemType,
} from '../types/inventory-types';

export interface InventoryItemFilter {
  companyId?: string;
  type?: ItemType;
  status?: ItemStatus;
  category?: string;
  currentLocationId?: string;
  search?: string; // Search by name or category
  limit?: number;
  offset?: number;
}

/**
 * Find inventory item by ID
 */
export async function findById(
  id: string
): Promise<{ data: InventoryItem | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', id)
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Find all inventory items with filters
 */
export async function findAll(
  filter: InventoryItemFilter = {}
): Promise<{ data: InventoryItem[]; error: Error | null; count: number }> {
  const supabase = createClient();

  let query = supabase
    .from('inventory_items')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filter.companyId) {
    query = query.eq('company_id', filter.companyId);
  }

  if (filter.type) {
    query = query.eq('type', filter.type);
  }

  if (filter.status) {
    query = query.eq('status', filter.status);
  }

  if (filter.category) {
    query = query.eq('category', filter.category);
  }

  if (filter.currentLocationId) {
    query = query.eq('current_location_id', filter.currentLocationId);
  }

  if (filter.search) {
    query = query.or(`name.ilike.%${filter.search}%,category.ilike.%${filter.search}%`);
  }

  // Pagination
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  // Order by name
  query = query.order('name', { ascending: true });

  const { data, error, count } = await query;

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null,
    count: count ?? 0,
  };
}

/**
 * Create inventory item
 */
export async function create(
  item: InventoryItemCreate
): Promise<{ data: InventoryItem | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('inventory_items')
    .insert(item)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Update inventory item
 */
export async function update(
  id: string,
  updates: InventoryItemUpdate
): Promise<{ data: InventoryItem | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('inventory_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Delete inventory item
 */
export async function deleteById(
  id: string
): Promise<{ error: Error | null }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id);

  return {
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Update item location (called by trigger or service)
 */
export async function updateLocation(
  id: string,
  locationId: string | null
): Promise<{ error: Error | null }> {
  return update(id, { current_location_id: locationId });
}

/**
 * Find items by location
 */
export async function findByLocation(
  locationId: string,
  companyId: string
): Promise<{ data: InventoryItem[]; error: Error | null }> {
  const result = await findAll({
    companyId,
    currentLocationId: locationId,
  });

  return {
    data: result.data,
    error: result.error,
  };
}
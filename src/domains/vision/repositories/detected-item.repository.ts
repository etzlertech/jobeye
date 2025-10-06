/**
 * @file /src/domains/vision/repositories/detected-item.repository.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Repository for detected items in vision verifications
 * @complexity_budget 250
 * @test_coverage >=80%
 * @dependencies @supabase/supabase-js
 */

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/database';

type DetectedItem = Database['public']['Tables']['vision_detected_items']['Row'];
type DetectedItemInsert = Database['public']['Tables']['vision_detected_items']['Insert'];

export interface DetectedItemFilter {
  verificationId?: string;
  itemType?: string;
  matchStatus?: 'matched' | 'unmatched' | 'uncertain';
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

/**
 * Find detected item by ID
 */
export async function findDetectedItemById(
  id: string
): Promise<{ data: DetectedItem | null; error: Error | null }> {

  const { data, error } = await supabase
    .from('vision_detected_items')
    .select('*')
    .eq('id', id)
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null
  };
}

/**
 * Find detected items with filters
 */
export async function findDetectedItems(
  filter: DetectedItemFilter
): Promise<{ data: DetectedItem[]; error: Error | null; count: number }> {

  let query = supabase
    .from('vision_detected_items')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filter.verificationId) {
    query = query.eq('verification_id', filter.verificationId);
  }

  if (filter.itemType) {
    query = query.eq('item_type', filter.itemType);
  }

  if (filter.matchStatus) {
    query = query.eq('match_status', filter.matchStatus);
  }

  if (filter.minConfidence !== undefined) {
    query = query.gte('confidence_score', filter.minConfidence);
  }

  // Pagination
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  // Order by confidence descending
  query = query.order('confidence_score', { ascending: false });

  const { data, error, count } = await query;

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null,
    count: count ?? 0
  };
}

/**
 * Find all detected items for a verification
 */
export async function findItemsForVerification(
  verificationId: string
): Promise<{ data: DetectedItem[]; error: Error | null }> {

  const { data, error } = await supabase
    .from('vision_detected_items')
    .select('*')
    .eq('verification_id', verificationId)
    .order('confidence_score', { ascending: false });

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null
  };
}

/**
 * Alias for findItemsForVerification (backward compatibility)
 */
export async function findByVerificationId(
  verificationId: string,
  tenantId?: string
): Promise<{ data: DetectedItem[]; error: Error | null }> {
  return findItemsForVerification(verificationId);
}

/**
 * Create detected item
 */
export async function createDetectedItem(
  item: DetectedItemInsert
): Promise<{ data: DetectedItem | null; error: Error | null }> {

  const { data, error } = await supabase
    .from('vision_detected_items')
    .insert(item)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null
  };
}

/**
 * Create multiple detected items (bulk insert)
 */
export async function createDetectedItems(
  items: DetectedItemInsert[]
): Promise<{ data: DetectedItem[]; error: Error | null }> {

  const { data, error } = await supabase
    .from('vision_detected_items')
    .insert(items)
    .select();

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null
  };
}

/**
 * Update detected item
 */
export async function updateDetectedItem(
  id: string,
  updates: Partial<DetectedItemInsert>
): Promise<{ data: DetectedItem | null; error: Error | null }> {

  const { data, error } = await supabase
    .from('vision_detected_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null
  };
}

/**
 * Delete detected item
 */
export async function deleteDetectedItem(
  id: string
): Promise<{ error: Error | null }> {

  const { error } = await supabase
    .from('vision_detected_items')
    .delete()
    .eq('id', id);

  return {
    error: error ? new Error(error.message) : null
  };
}

/**
 * Delete all items for a verification
 */
export async function deleteItemsForVerification(
  verificationId: string
): Promise<{ error: Error | null }> {

  const { error } = await supabase
    .from('vision_detected_items')
    .delete()
    .eq('verification_id', verificationId);

  return {
    error: error ? new Error(error.message) : null
  };
}

/**
 * Get item statistics for a verification
 */
export async function getItemStatsForVerification(
  verificationId: string
): Promise<{
  data: {
    total: number;
    matched: number;
    unmatched: number;
    uncertain: number;
    avgConfidence: number;
    itemTypes: { itemType: string; count: number }[];
  } | null;
  error: Error | null;
}> {
  const { data, error } = await findItemsForVerification(verificationId);

  if (error) {
    return { data: null, error };
  }

  if (data.length === 0) {
    return {
      data: {
        total: 0,
        matched: 0,
        unmatched: 0,
        uncertain: 0,
        avgConfidence: 0,
        itemTypes: []
      },
      error: null
    };
  }

  // Calculate item type counts
  const itemTypeCounts = data.reduce((acc, item) => {
    const existing = acc.find(i => i.itemType === item.item_type);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ itemType: item.item_type, count: 1 });
    }
    return acc;
  }, [] as { itemType: string; count: number }[]);

  const stats = {
    total: data.length,
    matched: data.filter(i => i.match_status === 'matched').length,
    unmatched: data.filter(i => i.match_status === 'unmatched').length,
    uncertain: data.filter(i => i.match_status === 'uncertain').length,
    avgConfidence: data.reduce((sum, i) => sum + Number(i.confidence_score), 0) / data.length,
    itemTypes: itemTypeCounts.sort((a, b) => b.count - a.count)
  };

  return { data: stats, error: null };
}

/**
 * @file /src/domains/vision/repositories/cost-record.repository.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Repository for VLM cost tracking with budget enforcement
 * @complexity_budget 300
 * @test_coverage ≥80%
 * @dependencies @supabase/supabase-js
 */

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/database.types';

type CostRecord = Database['public']['Tables']['vision_cost_records']['Row'];
type CostRecordInsert = Database['public']['Tables']['vision_cost_records']['Insert'];

export interface CostRecordFilter {
  companyId?: string;
  provider?: string;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  limit?: number;
  offset?: number;
}

export interface DailyCostSummary {
  date: string;
  totalCost: number;
  requestCount: number;
  avgCostPerRequest: number;
}

/**
 * Find cost record by ID
 */
export async function findCostRecordById(
  id: string
): Promise<{ data: CostRecord | null; error: Error | null }> {

  const { data, error } = await supabase
    .from('vision_cost_records')
    .select('*')
    .eq('id', id)
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null
  };
}

/**
 * Find cost records with filters
 */
export async function findCostRecords(
  filter: CostRecordFilter
): Promise<{ data: CostRecord[]; error: Error | null; count: number }> {

  let query = supabase
    .from('vision_cost_records')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filter.companyId) {
    query = query.eq('tenant_id', filter.companyId);
  }

  if (filter.provider) {
    query = query.eq('provider', filter.provider);
  }

  if (filter.startDate) {
    query = query.gte('created_at', filter.startDate);
  }

  if (filter.endDate) {
    query = query.lte('created_at', filter.endDate);
  }

  // Pagination
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  // Order by most recent first
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null,
    count: count ?? 0
  };
}

/**
 * Create cost record
 */
export async function createCostRecord(
  record: CostRecordInsert
): Promise<{ data: CostRecord | null; error: Error | null }> {

  const { data, error } = await supabase
    .from('vision_cost_records')
    .insert(record)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null
  };
}

/**
 * Get today's cost for a company
 */
export async function getTodaysCost(
  companyId: string
): Promise<{ data: { totalCost: number; requestCount: number } | null; error: Error | null }> {

  // Get start of today in UTC
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { data, error } = await supabase
    .from('vision_cost_records')
    .select('cost_usd')
    .eq('tenant_id', companyId)
    .gte('created_at', todayISO);

  if (error) {
    return {
      data: null,
      error: new Error(error.message)
    };
  }

  const totalCost = data.reduce((sum, record) => sum + Number(record.cost_usd), 0);
  const requestCount = data.length;

  return {
    data: { totalCost, requestCount },
    error: null
  };
}

/**
 * Get daily cost summaries for a date range
 */
export async function getDailyCostSummaries(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<{ data: DailyCostSummary[]; error: Error | null }> {

  const { data, error } = await supabase
    .from('vision_cost_records')
    .select('created_at, cost_usd')
    .eq('tenant_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (error) {
    return {
      data: [],
      error: new Error(error.message)
    };
  }

  // Group by date
  const dailyMap = new Map<string, { totalCost: number; count: number }>();

  data.forEach(record => {
    const date = record.created_at.split('T')[0]; // Get YYYY-MM-DD
    const existing = dailyMap.get(date);

    if (existing) {
      existing.totalCost += Number(record.cost_usd);
      existing.count += 1;
    } else {
      dailyMap.set(date, {
        totalCost: Number(record.cost_usd),
        count: 1
      });
    }
  });

  // Convert to array
  const summaries: DailyCostSummary[] = Array.from(dailyMap.entries()).map(([date, stats]) => ({
    date,
    totalCost: stats.totalCost,
    requestCount: stats.count,
    avgCostPerRequest: stats.totalCost / stats.count
  }));

  return { data: summaries, error: null };
}

/**
 * Get total cost for a company within date range
 */
export async function getTotalCost(
  companyId: string,
  startDate?: string,
  endDate?: string
): Promise<{ data: { totalCost: number; requestCount: number } | null; error: Error | null }> {

  let query = supabase
    .from('vision_cost_records')
    .select('cost_usd')
    .eq('tenant_id', companyId);

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error } = await query;

  if (error) {
    return {
      data: null,
      error: new Error(error.message)
    };
  }

  const totalCost = data.reduce((sum, record) => sum + Number(record.cost_usd), 0);
  const requestCount = data.length;

  return {
    data: { totalCost, requestCount },
    error: null
  };
}

/**
 * Check if company can make VLM request based on budget
 */
export async function canMakeVlmRequest(
  companyId: string,
  dailyBudgetLimit: number = 10.0,
  dailyRequestLimit: number = 100
): Promise<{
  data: {
    allowed: boolean;
    reason?: string;
    currentCost: number;
    currentRequests: number;
    remainingBudget: number;
    remainingRequests: number;
  } | null;
  error: Error | null;
}> {
  const { data, error } = await getTodaysCost(companyId);

  if (error) {
    return { data: null, error };
  }

  const { totalCost, requestCount } = data!;
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
    data: {
      allowed,
      reason,
      currentCost: totalCost,
      currentRequests: requestCount,
      remainingBudget,
      remainingRequests
    },
    error: null
  };
}

/**
 * Get cost statistics by provider
 */
export async function getCostStatsByProvider(
  companyId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  data: Array<{
    provider: string;
    totalCost: number;
    requestCount: number;
    avgCost: number;
  }>;
  error: Error | null;
}> {

  let query = supabase
    .from('vision_cost_records')
    .select('provider, cost_usd')
    .eq('tenant_id', companyId);

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error } = await query;

  if (error) {
    return {
      data: [],
      error: new Error(error.message)
    };
  }

  // Group by provider
  const providerMap = new Map<string, { totalCost: number; count: number }>();

  data.forEach(record => {
    const existing = providerMap.get(record.provider);

    if (existing) {
      existing.totalCost += Number(record.cost_usd);
      existing.count += 1;
    } else {
      providerMap.set(record.provider, {
        totalCost: Number(record.cost_usd),
        count: 1
      });
    }
  });

  // Convert to array
  const stats = Array.from(providerMap.entries()).map(([provider, data]) => ({
    provider,
    totalCost: data.totalCost,
    requestCount: data.count,
    avgCost: data.totalCost / data.count
  }));

  return { data: stats, error: null };
}
/**
 * @file /src/domains/vision/repositories/vision-verification.repository.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Repository for vision verification records with RLS
 * @complexity_budget 300
 * @test_coverage ≥80%
 * @dependencies @supabase/supabase-js
 */

import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database.types';

type VisionVerification = Database['public']['Tables']['vision_verifications']['Row'];
type VisionVerificationInsert = Database['public']['Tables']['vision_verifications']['Insert'];
type VisionVerificationUpdate = Database['public']['Tables']['vision_verifications']['Update'];

export interface VisionVerificationFilter {
  companyId?: string;
  kitId?: string;
  jobId?: string;
  verificationResult?: 'complete' | 'incomplete' | 'failed' | 'unverified';
  processingMethod?: 'local_yolo' | 'cloud_vlm' | 'manual';
  verifiedAfter?: string; // ISO date
  verifiedBefore?: string; // ISO date
  limit?: number;
  offset?: number;
}

/**
 * Find verification by ID
 */
export async function findVerificationById(
  id: string
): Promise<{ data: VisionVerification | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('vision_verifications')
    .select('*')
    .eq('id', id)
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null
  };
}

/**
 * Find verifications with filters
 */
export async function findVerifications(
  filter: VisionVerificationFilter
): Promise<{ data: VisionVerification[]; error: Error | null; count: number }> {
  const supabase = createClient();

  let query = supabase
    .from('vision_verifications')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filter.companyId) {
    query = query.eq('tenant_id', filter.companyId);
  }

  if (filter.kitId) {
    query = query.eq('kit_id', filter.kitId);
  }

  if (filter.jobId) {
    query = query.eq('job_id', filter.jobId);
  }

  if (filter.verificationResult) {
    query = query.eq('verification_result', filter.verificationResult);
  }

  if (filter.processingMethod) {
    query = query.eq('processing_method', filter.processingMethod);
  }

  if (filter.verifiedAfter) {
    query = query.gte('verified_at', filter.verifiedAfter);
  }

  if (filter.verifiedBefore) {
    query = query.lte('verified_at', filter.verifiedBefore);
  }

  // Pagination
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  // Order by most recent first
  query = query.order('verified_at', { ascending: false });

  const { data, error, count } = await query;

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null,
    count: count ?? 0
  };
}

/**
 * Create verification record
 */
export async function createVerification(
  verification: VisionVerificationInsert
): Promise<{ data: VisionVerification | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('vision_verifications')
    .insert(verification)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null
  };
}

/**
 * Update verification record
 */
export async function updateVerification(
  id: string,
  updates: VisionVerificationUpdate
): Promise<{ data: VisionVerification | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('vision_verifications')
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
 * Delete verification record
 */
export async function deleteVerification(
  id: string
): Promise<{ error: Error | null }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('vision_verifications')
    .delete()
    .eq('id', id);

  return {
    error: error ? new Error(error.message) : null
  };
}

/**
 * Get verification statistics for a company
 */
export async function getVerificationStats(
  companyId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  data: {
    total: number;
    complete: number;
    incomplete: number;
    failed: number;
    yoloCount: number;
    vlmCount: number;
    avgConfidence: number;
  } | null;
  error: Error | null;
}> {
  const supabase = createClient();

  let query = supabase
    .from('vision_verifications')
    .select('verification_result, processing_method, confidence_score')
    .eq('tenant_id', companyId);

  if (startDate) {
    query = query.gte('verified_at', startDate);
  }

  if (endDate) {
    query = query.lte('verified_at', endDate);
  }

  const { data, error } = await query;

  if (error) {
    return {
      data: null,
      error: new Error(error.message)
    };
  }

  if (!data || data.length === 0) {
    return {
      data: {
        total: 0,
        complete: 0,
        incomplete: 0,
        failed: 0,
        yoloCount: 0,
        vlmCount: 0,
        avgConfidence: 0
      },
      error: null
    };
  }

  const stats = {
    total: data.length,
    complete: data.filter(v => v.verification_result === 'complete').length,
    incomplete: data.filter(v => v.verification_result === 'incomplete').length,
    failed: data.filter(v => v.verification_result === 'failed').length,
    yoloCount: data.filter(v => v.processing_method === 'local_yolo').length,
    vlmCount: data.filter(v => v.processing_method === 'cloud_vlm').length,
    avgConfidence: data.reduce((sum, v) => sum + (v.confidence_score || 0), 0) / data.length
  };

  return { data: stats, error: null };
}

/**
 * Find most recent verification for a kit
 */
export async function findLatestVerificationForKit(
  kitId: string
): Promise<{ data: VisionVerification | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('vision_verifications')
    .select('*')
    .eq('kit_id', kitId)
    .order('verified_at', { ascending: false })
    .limit(1)
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null
  };
}
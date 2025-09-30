/**
 * @file /src/domains/inventory/repositories/training-data.repository.ts
 * @phase 3.4
 * @feature 004-voice-vision-inventory
 */

import { createClient } from '@/lib/supabase/client';
import type { TrainingDataRecord, TrainingDataRecordCreate } from '../types/inventory-types';

export async function create(
  record: TrainingDataRecordCreate
): Promise<{ data: TrainingDataRecord | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('training_data_records')
    .insert(record)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function findById(
  id: string
): Promise<{ data: TrainingDataRecord | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('training_data_records')
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
  limit = 100
): Promise<{ data: TrainingDataRecord[]; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('training_data_records')
    .select('*')
    .eq('tenant_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null,
  };
}
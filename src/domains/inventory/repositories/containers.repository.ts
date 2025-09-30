/**
 * @file /src/domains/inventory/repositories/containers.repository.ts
 * @phase 3.4
 * @domain Inventory
 * @purpose Repository for container management with RLS
 * @complexity_budget 300
 * @feature 004-voice-vision-inventory
 */

import { createClient } from '@/lib/supabase/client';
import type {
  Container,
  ContainerCreate,
  ContainerUpdate,
  ContainerType,
} from '../types/inventory-types';

export interface ContainerFilter {
  companyId?: string;
  type?: ContainerType;
  isActive?: boolean;
  isDefault?: boolean;
  parentContainerId?: string;
  limit?: number;
  offset?: number;
}

export async function findById(
  id: string
): Promise<{ data: Container | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('containers')
    .select('*')
    .eq('id', id)
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function findAll(
  filter: ContainerFilter = {}
): Promise<{ data: Container[]; error: Error | null; count: number }> {
  const supabase = createClient();

  let query = supabase
    .from('containers')
    .select('*', { count: 'exact' });

  if (filter.companyId) {
    query = query.eq('company_id', filter.companyId);
  }

  if (filter.type) {
    query = query.eq('type', filter.type);
  }

  if (filter.isActive !== undefined) {
    query = query.eq('is_active', filter.isActive);
  }

  if (filter.isDefault !== undefined) {
    query = query.eq('is_default', filter.isDefault);
  }

  if (filter.parentContainerId) {
    query = query.eq('parent_container_id', filter.parentContainerId);
  }

  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  query = query.range(offset, offset + limit - 1);
  query = query.order('name', { ascending: true });

  const { data, error, count } = await query;

  return {
    data: data ?? [],
    error: error ? new Error(error.message) : null,
    count: count ?? 0,
  };
}

export async function create(
  container: ContainerCreate
): Promise<{ data: Container | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('containers')
    .insert(container)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function update(
  id: string,
  updates: ContainerUpdate
): Promise<{ data: Container | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('containers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function deleteById(
  id: string
): Promise<{ error: Error | null }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('containers')
    .delete()
    .eq('id', id);

  return {
    error: error ? new Error(error.message) : null,
  };
}
/**
 * @file /src/domains/inventory/repositories/container-assignments.repository.ts
 * @phase 3.4
 * @feature 004-voice-vision-inventory
 */

import { supabase } from '@/lib/supabase/client';
import type { ContainerAssignment, ContainerAssignmentCreate } from '../types/inventory-types';

export async function create(
  assignment: ContainerAssignmentCreate
): Promise<{ data: ContainerAssignment | null; error: Error | null }> {

  const { data, error } = await supabase
    .from('container_assignments')
    .insert(assignment)
    .select()
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function findActiveByItem(
  itemId: string
): Promise<{ data: ContainerAssignment | null; error: Error | null }> {

  const { data, error } = await supabase
    .from('container_assignments')
    .select('*')
    .eq('item_id', itemId)
    .is('checked_out_at', null)
    .single();

  return {
    data,
    error: error ? new Error(error.message) : null,
  };
}

export async function checkOut(
  id: string,
  checkedOutAt: string
): Promise<{ error: Error | null }> {

  const { error } = await supabase
    .from('container_assignments')
    .update({ checked_out_at: checkedOutAt, status: 'completed' })
    .eq('id', id);

  return {
    error: error ? new Error(error.message) : null,
  };
}
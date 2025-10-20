/**
 * Item Categories API Endpoint
 *
 * Returns distinct categories for a given item_type to populate filter dropdowns.
 *
 * Query Parameters:
 * - item_type: Filter categories by 'equipment' or 'material'
 *
 * @see JOB_LOAD_REFACTOR_PLAN.md Phase 2 Task 4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
import type { Database } from '@/types/database';

type ItemType = Database['public']['Enums']['item_type'];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);

    const itemType = searchParams.get('item_type') as ItemType | null;

    // Build query to get distinct categories
    let query = supabase
      .from('items')
      .select('category')
      .not('category', 'is', null)
      .order('category', { ascending: true });

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Extract unique categories
    const categories = [...new Set(data?.map((item) => item.category).filter(Boolean))];

    return NextResponse.json({
      categories,
      item_type: itemType,
      count: categories.length
    });

  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Items API Endpoint
 *
 * Unified endpoint for fetching equipment, materials, and tools from the items table.
 * Replaces separate equipment/materials/tools endpoints with unified filtering.
 *
 * Query Parameters:
 * - item_type: Filter by 'equipment' or 'material'
 * - category: Filter by category (e.g., 'hand_tool', 'power_tool', 'fertilizer')
 * - search: Search by name or model
 * - tenant_id: Required for RLS
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

    // Extract query parameters
    const itemType = searchParams.get('item_type') as ItemType | null;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('items')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,model.ilike.%${search}%,manufacturer.ilike.%${search}%`);
    }

    const { data: items, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      items: items || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      },
      filters: {
        item_type: itemType,
        category,
        search
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const {
      name,
      item_type,
      category,
      manufacturer,
      model,
      unit_cost,
      quantity_in_stock,
      reorder_point,
      storage_location,
      metadata
    } = body;

    // Validation
    if (!name || !item_type) {
      return NextResponse.json(
        { error: 'name and item_type are required' },
        { status: 400 }
      );
    }

    // Get tenant_id from context
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = (user.app_metadata as any)?.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant_id found in user metadata' },
        { status: 403 }
      );
    }

    // Create item
    const { data: item, error } = await supabase
      .from('items')
      .insert({
        tenant_id: tenantId,
        name,
        item_type,
        category,
        manufacturer,
        model,
        unit_cost,
        quantity_in_stock: quantity_in_stock || 0,
        reorder_point: reorder_point || 0,
        storage_location,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      item
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}

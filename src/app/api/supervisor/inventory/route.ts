/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/inventory/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoints for inventory management - list and CRUD operations
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 200
 * migrations_touched: ['inventory', 'inventory_items']
 * state_machine: none
 * estimated_llm_cost: {
 *   "read": "$0.00",
 *   "write": "$0.00"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: ['inventory', 'inventory_items']
 * }
 * exports: ['GET', 'POST']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/supervisor/inventory.test.ts'
 * }
 * tasks: [
 *   'List inventory items for company',
 *   'Create new inventory items',
 *   'Filter by category and search'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';
import { getRequestContext } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase = user
      ? await createServerClient()
      : createServiceClient();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // Build query for real database (table is 'items' not 'inventory_items')
    let query = supabase
      .from('items')
      .select(`
        id,
        name,
        category,
        current_quantity,
        reorder_point,
        status,
        item_type,
        tracking_mode,
        attributes,
        created_at,
        updated_at
      `, { count: 'exact' });

    // Add filters
    query = query.eq('tenant_id', tenantId);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%, category.ilike.%${search}%`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Order by creation date
    query = query.order('created_at', { ascending: false });

    // Execute query
    const { data: items, error, count } = await query;

    if (error) throw error;

    // Calculate statistics
    const statsQuery = supabase
      .from('items')
      .select('status, current_quantity, reorder_point', { count: 'exact' });

    statsQuery.eq('tenant_id', tenantId);

    const { data: allItems } = await statsQuery;

    const stats = {
      total_items: count || 0,
      active: (allItems || []).filter(i => i.status === 'active').length,
      low_stock: (allItems || []).filter(i =>
        i.current_quantity !== null &&
        i.reorder_point !== null &&
        i.current_quantity <= i.reorder_point
      ).length,
      out_of_stock: (allItems || []).filter(i =>
        i.current_quantity !== null && i.current_quantity === 0
      ).length
    };

    return NextResponse.json({
      items: items || [],
      total_count: count || 0,
      stats
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase = user
      ? await createServerClient()
      : createServiceClient();
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'category'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return validationError('Missing required fields', { 
        missing_fields: missingFields 
      });
    }

    // Determine item type and tracking mode
    const itemType = body.category === 'equipment' ? 'equipment' : 'material';
    const trackingMode = itemType === 'equipment' ? 'individual' : 'quantity';

    // Create inventory item with correct schema (table is 'items')
    const insertData: any = {
      name: body.name,
      category: body.category,
      item_type: itemType,
      tracking_mode: trackingMode,
      status: 'active',
      tenant_id: tenantId,
      attributes: body.container ? { container: body.container } : {},
      unit_of_measure: 'units'
    };

    // Add quantity for all items
    insertData.current_quantity = body.quantity || 1;
    insertData.reorder_point = body.min_quantity || 5;

    const { data: item, error } = await supabase
      .from('items')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      item,
      message: 'Item added successfully and saved to database'
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}

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
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    const tenantId = request.headers.get('x-tenant-id');

    if (isDemo) {
      // Return mock inventory for demo mode
      const mockInventory = [
        {
          id: '1',
          name: 'Lawn Mower - Commercial',
          category: 'equipment',
          quantity: 3,
          min_quantity: 2,
          status: 'in_stock',
          container: 'Truck 1 - Main Bay',
          thumbnail_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Trimmer Line 0.095"',
          category: 'materials',
          quantity: 1,
          min_quantity: 5,
          status: 'low_stock',
          container: 'Storage - Shelf A',
          thumbnail_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Safety Goggles',
          category: 'safety',
          quantity: 0,
          min_quantity: 10,
          status: 'out_of_stock',
          container: 'Storage - Safety Cabinet',
          thumbnail_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '4',
          name: 'Hedge Trimmer',
          category: 'equipment',
          quantity: 2,
          min_quantity: 1,
          status: 'in_stock',
          container: 'Truck 2 - Tool Box',
          thumbnail_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '5',
          name: 'Fertilizer - Granular',
          category: 'materials',
          quantity: 8,
          min_quantity: 3,
          status: 'in_stock',
          container: 'Storage - Chemical Room',
          thumbnail_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      let filtered = mockInventory;

      // Apply filters
      if (category && category !== 'all') {
        filtered = filtered.filter(item => item.category === category);
      }

      if (search) {
        filtered = filtered.filter(item => 
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.category.toLowerCase().includes(search.toLowerCase()) ||
          item.container?.toLowerCase().includes(search.toLowerCase())
        );
      }

      if (status && status !== 'all') {
        filtered = filtered.filter(item => item.status === status);
      }

      return NextResponse.json({
        items: filtered,
        total_count: filtered.length,
        stats: {
          total_items: mockInventory.length,
          in_stock: mockInventory.filter(i => i.status === 'in_stock').length,
          low_stock: mockInventory.filter(i => i.status === 'low_stock').length,
          out_of_stock: mockInventory.filter(i => i.status === 'out_of_stock').length
        }
      });
    }

    // Build query for real database
    let query = supabase
      .from('inventory_items')
      .select(`
        id,
        name,
        category,
        current_quantity,
        reorder_level,
        status,
        type,
        tracking_mode,
        specifications,
        created_at,
        updated_at
      `, { count: 'exact' });

    // Add filters
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%, category.ilike.%${search}%, container.ilike.%${search}%`);
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
      .from('inventory_items')
      .select('status, current_quantity, reorder_level', { count: 'exact' });

    if (tenantId) {
      statsQuery.eq('tenant_id', tenantId);
    }

    const { data: allItems } = await statsQuery;
    
    const stats = {
      total_items: count || 0,
      active: (allItems || []).filter(i => i.status === 'active').length,
      low_stock: (allItems || []).filter(i => 
        i.current_quantity !== null && 
        i.reorder_level !== null && 
        i.current_quantity <= i.reorder_level
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
    const supabase = await createServerClient();
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'category'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return validationError('Missing required fields', { 
        missing_fields: missingFields 
      });
    }

    // Get company ID from headers
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return validationError('Company ID required');
    }

    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    if (isDemo) {
      // Return mock response for demo mode
      return NextResponse.json({
        item: {
          id: Date.now().toString(),
          name: body.name,
          category: body.category,
          current_quantity: body.quantity || 1,
          reorder_level: body.min_quantity || 5,
          status: 'active',
          type: body.category === 'equipment' ? 'equipment' : 'material',
          tracking_mode: body.category === 'equipment' ? 'individual' : 'quantity',
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        message: 'Item added successfully (demo mode - not saved to database)',
        isDemoMode: true
      }, { status: 201 });
    }

    // Determine item type and tracking mode
    const type = body.category === 'equipment' ? 'equipment' : 'material';
    const trackingMode = type === 'equipment' ? 'individual' : 'quantity';
    
    // Create inventory item with correct schema
    const insertData: any = {
      name: body.name,
      category: body.category,
      type,
      tracking_mode: trackingMode,
      status: 'active',
      tenant_id: tenantId,
      specifications: body.container ? { container: body.container } : {}
    };

    // Only add quantity for materials (not equipment)
    if (type === 'material') {
      insertData.current_quantity = body.quantity || 1;
      insertData.reorder_level = body.min_quantity || 5;
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      item,
      message: 'Item added successfully and saved to database',
      isDemoMode: false
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}
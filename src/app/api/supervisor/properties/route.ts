/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/properties/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoints for property management
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 200
 * migrations_touched: ['properties']
 * state_machine: none
 * estimated_llm_cost: {
 *   "read": "$0.00",
 *   "write": "$0.00"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: ['properties', 'customers']
 * }
 * exports: ['GET', 'POST']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/supervisor/properties.test.ts'
 * }
 * tasks: [
 *   'List properties for company',
 *   'Create new property',
 *   'Filter by customer'
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customer_id');
    const search = searchParams.get('search');

    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    // Build query with customer join
    let query = supabase
      .from('properties')
      .select(`
        *,
        customer:customers(
          id,
          name,
          email
        )
      `, { count: 'exact' });

    // Add filters
    query = query.eq('tenant_id', tenantId);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (search) {
      // Search in name field only for now (simplified to avoid JSONB syntax issues)
      query = query.ilike('name', `%${search}%`);
    }

    // Order by creation date
    query = query.order('created_at', { ascending: false });

    // Execute query
    const { data: properties, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      properties: properties || [],
      total_count: count || 0
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
    const requiredFields = ['customer_id', 'address'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return validationError('Missing required fields', { 
        missing_fields: missingFields 
      });
    }

    // Create property
    const { data: property, error } = await supabase
      .from('properties')
      .insert({
        ...body,
        tenant_id: tenantId
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      property,
      message: 'Property created successfully and saved to database'
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}

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
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customer_id');
    const search = searchParams.get('search');

    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    const companyId = request.headers.get('x-tenant-id');

    if (isDemo) {
      // Return mock properties for demo mode
      const mockProperties = [
        {
          id: '1',
          customer_id: '1',
          address: '123 Main St, Anytown, USA',
          type: 'residential',
          size: '0.25 acres',
          notes: 'Front and back lawn, flower beds',
          customer: { name: 'Johnson Family' },
          created_at: new Date().toISOString()
        },
        {
          id: '2', 
          customer_id: '1',
          address: '125 Main St, Anytown, USA',
          type: 'commercial',
          size: '0.5 acres',
          notes: 'Business property with parking lot',
          customer: { name: 'Johnson Family' },
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          customer_id: '2',
          address: '456 Oak Ave, Somewhere, USA',
          type: 'residential',
          size: '0.33 acres',
          notes: 'Large backyard, pool area',
          customer: { name: 'Smith Residence' },
          created_at: new Date().toISOString()
        }
      ];

      const filtered = customerId 
        ? mockProperties.filter(p => p.customer_id === customerId)
        : mockProperties;

      return NextResponse.json({
        properties: filtered,
        total_count: filtered.length
      });
    }

    // Build query
    let query = supabase
      .from('properties')
      .select('*, customer:customers(name)', { count: 'exact' });

    // Add filters
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (search) {
      query = query.or(`address.ilike.%${search}%`);
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
    const supabase = await createServerClient();
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['customer_id', 'address'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return validationError('Missing required fields', { 
        missing_fields: missingFields 
      });
    }

    // Get company ID from headers
    const companyId = request.headers.get('x-tenant-id');
    if (!companyId) {
      return validationError('Company ID required');
    }

    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    if (isDemo) {
      // Return mock response for demo mode
      return NextResponse.json({
        property: {
          id: Date.now().toString(),
          ...body,
          company_id: companyId,
          created_at: new Date().toISOString()
        }
      }, { status: 201 });
    }

    // Create property
    const { data: property, error } = await supabase
      .from('properties')
      .insert({
        ...body,
        company_id: companyId
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ property }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}
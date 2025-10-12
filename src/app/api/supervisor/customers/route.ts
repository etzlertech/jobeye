/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/customers/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoints for customer management
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 200
 * migrations_touched: ['companies', 'customers']
 * state_machine: none
 * estimated_llm_cost: {
 *   "read": "$0.00",
 *   "write": "$0.00"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: ['customers']
 * }
 * exports: ['GET', 'POST']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/supervisor/customers.test.ts'
 * }
 * tasks: [
 *   'List customers for company',
 *   'Create new customer',
 *   'Handle pagination and filtering'
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const offset = (page - 1) * limit;

    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return validationError('Tenant ID required');
    }

    // Build query - map billing_address to address for UI compatibility
    let query = supabase
      .from('customers')
      .select(`
        id,
        name,
        email,
        phone,
        billing_address,
        notes,
        created_at
      `, { count: 'exact' });

    query = query.eq('tenant_id', tenantId);

    // Add search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Add pagination
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Execute query
    const { data: customers, error, count } = await query;

    if (error) throw error;

    // Transform customers for UI compatibility (map billing_address to address)
    const transformedCustomers = (customers || []).map(customer => ({
      ...customer,
      address: customer.billing_address 
        ? `${customer.billing_address.street}, ${customer.billing_address.city}, ${customer.billing_address.state} ${customer.billing_address.zip}`.replace(/N\/A,?\s*/g, '').replace(/,\s*$/, '')
        : null,
      property_count: 0 // Removed properties relation for now
    }));

    return NextResponse.json({
      customers: transformedCustomers,
      total_count: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit)
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
    const requiredFields = ['name', 'email'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return validationError('Missing required fields', { 
        missing_fields: missingFields 
      });
    }

    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return validationError('Tenant ID required');
    }

    // All users (including demo users) now use live database

    // Generate customer number
    const timestamp = Date.now();
    const customerNumber = `CUST-${timestamp}`;

    // Transform address field to billing_address object if provided
    const billingAddress = body.address ? {
      street: body.address,
      city: 'N/A',
      state: 'N/A',
      zip: 'N/A'
    } : null;

    // Prepare customer data with correct schema
    const customerData = {
      tenant_id: tenantId,
      customer_number: customerNumber,
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      billing_address: billingAddress,
      notes: body.notes || null
    };

    // Create customer
    const { data: customer, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      customer,
      message: 'Customer successfully created and saved to database'
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}

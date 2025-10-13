/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/properties/[id]/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoints for individual property operations
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
 *   supabase: ['properties']
 * }
 * exports: ['GET', 'PUT', 'DELETE']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/supervisor/properties-id.test.ts'
 * }
 * tasks: [
 *   'Get property by ID',
 *   'Update property',
 *   'Delete property'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';
import { getRequestContext } from '@/lib/auth/context';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const propertyId = params.id;
    // Get property without join for now
    let query = supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId);

    query = query.eq('tenant_id', tenantId);

    const { data: property, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ property });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;

    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const propertyId = params.id;
    const body = await request.json();

    // Validate required fields if provided
    if (body.customer_id !== undefined && !body.customer_id) {
      return validationError('Customer ID cannot be empty');
    }
    if (body.address !== undefined && !body.address?.trim()) {
      return validationError('Address cannot be empty');
    }

    // Update property with company verification
    const { data: property, error } = await supabase
      .from('properties')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', propertyId)
      .eq('tenant_id', tenantId) // Ensure tenant isolation
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Property not found or access denied' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      property,
      message: 'Property updated successfully'
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;

    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const propertyId = params.id;

    // Delete property with company verification
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)
      .eq('tenant_id', tenantId); // Ensure tenant isolation

    if (error) throw error;

    return NextResponse.json({
      message: 'Property deleted successfully'
    });

  } catch (error) {
    return handleApiError(error);
  }
}

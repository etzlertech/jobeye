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
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const propertyId = params.id;

    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    const companyId = request.headers.get('x-tenant-id');

    if (isDemo) {
      // Return mock property for demo mode
      return NextResponse.json({
        property: {
          id: propertyId,
          customer_id: '1',
          address: '123 Main St, Anytown, USA',
          type: 'residential',
          size: '0.25 acres',
          notes: 'Front and back lawn, flower beds',
          customer: { name: 'Johnson Family' },
          created_at: new Date().toISOString()
        }
      });
    }

    // Get property with customer info
    let query = supabase
      .from('properties')
      .select('*, customer:customers(name)')
      .eq('id', propertyId);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

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
    const supabase = await createServerClient();
    const propertyId = params.id;
    const body = await request.json();

    // Get company ID from headers
    const companyId = request.headers.get('x-tenant-id');
    if (!companyId) {
      return validationError('Company ID required');
    }

    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    if (isDemo) {
      // Return mock response for demo mode - simulate successful update
      return NextResponse.json({
        property: {
          id: propertyId,
          ...body,
          company_id: companyId,
          updated_at: new Date().toISOString()
        },
        message: 'Property updated successfully in demo mode'
      });
    }

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
      .eq('company_id', companyId) // Ensure tenant isolation
      .select('*, customer:customers(name)')
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
    const supabase = await createServerClient();
    const propertyId = params.id;

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
        message: 'Property deleted successfully in demo mode'
      });
    }

    // Delete property with company verification
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)
      .eq('company_id', companyId); // Ensure tenant isolation

    if (error) throw error;

    return NextResponse.json({
      message: 'Property deleted successfully'
    });

  } catch (error) {
    return handleApiError(error);
  }
}
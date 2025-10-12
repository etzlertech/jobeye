import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { id } = params;

    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return validationError('Tenant ID required');
    }

    // Handle customer_name field from UI (map to name in DB)
    const updateData: any = {};
    if (body.customer_name !== undefined) {
      updateData.name = body.customer_name;
    }
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.email !== undefined) {
      updateData.email = body.email;
    }
    if (body.phone !== undefined) {
      updateData.phone = body.phone;
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      customer: data,
      message: 'Customer updated successfully'
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
    const { id } = params;

    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return validationError('Tenant ID required');
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return NextResponse.json({ 
      message: 'Customer deleted successfully'
    });

  } catch (error) {
    return handleApiError(error);
  }
}
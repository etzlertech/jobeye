import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
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

    const { id } = params;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    // Map field names for frontend
    const customer = {
      ...data,
      primaryImageUrl: data.primary_image_url,
      mediumUrl: data.medium_url,
      thumbnailUrl: data.thumbnail_url
    };

    return NextResponse.json({ customer });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const body = await request.json();
    const { id } = params;

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
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const { id } = params;

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

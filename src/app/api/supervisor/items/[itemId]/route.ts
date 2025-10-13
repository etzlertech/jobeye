import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { ItemRepository } from '@/domains/shared/repositories/item.repository';
import { handleApiError, notFound, validationError } from '@/core/errors/error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    // Get request context (handles both session and header-based auth)
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    
    // Get appropriate Supabase client
    let supabase;
    if (!user) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const itemRepo = new ItemRepository(supabase);
    const item = await itemRepo.findById(params.itemId, { tenant_id: tenantId });
    
    if (!item) {
      return notFound('Item not found');
    }
    
    return NextResponse.json({ item });
    
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const body = await request.json();
    
    // Get request context (handles both session and header-based auth)
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    
    console.log('Items API PUT - ItemID:', params.itemId);
    console.log('Update data:', JSON.stringify(body, null, 2));
    console.log('TenantID:', tenantId, 'Source:', context.source);
    
    // Get appropriate Supabase client
    let supabase;
    if (!user) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const itemRepo = new ItemRepository(supabase);
    
    // Check if item exists
    const existingItem = await itemRepo.findById(params.itemId, { tenant_id: tenantId });
    if (!existingItem) {
      return notFound('Item not found');
    }
    
    // Don't allow changing tracking_mode if there are transactions
    if (body.tracking_mode && body.tracking_mode !== existingItem.tracking_mode) {
      return validationError('Cannot change tracking mode after transactions exist');
    }
    
    // Update item
    const updatedItem = await itemRepo.update(
      params.itemId,
      {
        ...body,
        updated_at: new Date().toISOString()
      },
      { tenant_id: tenantId }
    );
    
    if (!updatedItem) {
      throw new Error('Failed to update item');
    }
    
    return NextResponse.json({ 
      item: updatedItem,
      message: 'Item updated successfully'
    });
    
  } catch (error) {
    console.error('Items API PUT error:', error);
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const body = await request.json();
    
    // Get request context (handles both session and header-based auth)
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    
    console.log('Items API PATCH - ItemID:', params.itemId, 'TenantID:', tenantId, 'Source:', context.source);
    
    // Get appropriate Supabase client
    let supabase;
    if (!user) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const itemRepo = new ItemRepository(supabase);
    
    // Check if item exists
    const existingItem = await itemRepo.findById(params.itemId, { tenant_id: tenantId });
    if (!existingItem) {
      return notFound('Item not found');
    }
    
    // Update only the fields provided in the request body
    const updatedItem = await itemRepo.update(
      params.itemId,
      {
        ...body,
        updated_at: new Date().toISOString()
      },
      { tenant_id: tenantId }
    );
    
    if (!updatedItem) {
      throw new Error('Failed to update item');
    }
    
    return NextResponse.json({ 
      item: updatedItem,
      message: 'Item updated successfully'
    });
    
  } catch (error) {
    console.error('Items API PATCH error:', error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    // Get appropriate Supabase client
    const isDemoRequest = !request.headers.get('authorization');
    let supabase;
    if (isDemoRequest) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const itemRepo = new ItemRepository(supabase);
    
    // Check if item exists
    const existingItem = await itemRepo.findById(params.itemId, { tenant_id: tenantId });
    if (!existingItem) {
      return notFound('Item not found');
    }
    
    // Soft delete by setting status to inactive
    const updated = await itemRepo.update(
      params.itemId,
      { status: 'inactive' },
      { tenant_id: tenantId }
    );
    
    if (!updated) {
      throw new Error('Failed to delete item');
    }
    
    return NextResponse.json({ 
      message: 'Item deleted successfully'
    });
    
  } catch (error) {
    return handleApiError(error);
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { ItemRepository } from '@/domains/shared/repositories/item.repository';
import { handleApiError, validationError } from '@/core/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    console.log('Items API GET - TenantID:', tenantId);
    
    // Get appropriate Supabase client
    const isDemoRequest = !request.headers.get('authorization');
    console.log('Is demo request:', isDemoRequest);
    
    let supabase;
    try {
      if (isDemoRequest) {
        console.log('Creating service client for demo request');
        supabase = createServiceClient();
      } else {
        console.log('Creating server client for authenticated request');
        supabase = await createServerClient();
      }
    } catch (clientError) {
      console.error('Failed to create Supabase client:', clientError);
      throw clientError;
    }
    
    console.log('Supabase client created successfully');
    const itemRepo = new ItemRepository(supabase);
    
    // Parse query params
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || undefined;
    const itemType = searchParams.get('item_type') || undefined;
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    
    const result = await itemRepo.findAll({
      tenantId,  // camelCase
      filters: {
        searchTerm: search,  // camelCase from ItemFilters
        itemType: itemType as any,  // camelCase
        category,
        status: status as any
      },
      limit,
      offset
    });
    
    return NextResponse.json({
      data: result.data,  // Changed from 'items' to 'data' to match expected format
      count: result.count,
      page,
      limit,
      totalPages: Math.ceil(result.count / limit)
    });
    
  } catch (error) {
    console.error('Items API GET error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return more detailed error for debugging
    if (error instanceof Error) {
      return NextResponse.json({
        error: error.message,
        details: error.stack,
        type: error.constructor.name
      }, { status: 500 });
    }
    
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    console.log('Items API POST - Request:', JSON.stringify(body, null, 2));
    console.log('TenantID:', tenantId);
    
    // Get appropriate Supabase client
    const isDemoRequest = !request.headers.get('authorization');
    let supabase;
    if (isDemoRequest) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const itemRepo = new ItemRepository(supabase);
    
    // Validate required fields
    const requiredFields = ['item_type', 'category', 'name', 'tracking_mode', 'unit_of_measure'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return validationError('Missing required fields', {
        missing_fields: missingFields
      });
    }
    
    // Build item data with camelCase for repository
    const itemData = {
      tenantId,  // camelCase
      itemType: body.item_type,  // camelCase
      category: body.category,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      trackingMode: body.tracking_mode,  // camelCase
      currentQuantity: body.current_quantity || 0,  // camelCase
      unitOfMeasure: body.unit_of_measure,  // camelCase
      minQuantity: body.min_quantity || null,  // camelCase
      reorderPoint: body.reorder_point || null,  // camelCase
      manufacturer: body.manufacturer || null,
      model: body.model || null,
      sku: body.sku || null,
      barcode: body.barcode || null,
      status: body.status || 'active',
      primaryImageUrl: body.primary_image_url || null,  // camelCase
      thumbnailUrl: body.thumbnail_url || null,  // camelCase
      mediumUrl: body.medium_url || null  // camelCase
    };
    
    console.log('Creating item with data:', itemData);
    
    const item = await itemRepo.create(itemData);
    
    if (!item) {
      throw new Error('Failed to create item');
    }
    
    console.log('✅ Item created:', item.id);
    
    // If initial quantity > 0, create a check-in transaction
    // TODO: Fix transaction creation - currently causing 500 errors
    // Temporarily disabled to allow item creation to work
    /*
    if (item.currentQuantity > 0) {  // camelCase from repository
      const { ItemTransactionRepository } = await import('@/domains/shared/repositories/item-transaction.repository');
      const txRepo = new ItemTransactionRepository(supabase);
      
      const transaction = await txRepo.create({
        tenantId,  // camelCase
        transactionType: 'check_in',  // camelCase
        itemId: item.id,  // camelCase
        quantity: item.currentQuantity,  // camelCase
        notes: 'Initial inventory',
        createdBy: null
      });
      
      console.log('Initial transaction created:', transaction?.id);
    }
    */
    
    return NextResponse.json({
      item,
      message: 'Item created successfully'
    }, { status: 201 });
    
  } catch (error) {
    console.error('Items API POST error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return handleApiError(error);
  }
}
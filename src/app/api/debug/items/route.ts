import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    // Get items table schema
    const { data: sampleItem } = await supabase
      .from('items')
      .select('*')
      .limit(1)
      .single();
    
    // Get some actual items
    const { data: items } = await supabase
      .from('items')
      .select('*')
      .limit(5);
    
    // Get transactions
    const { data: transactions } = await supabase
      .from('item_transactions')
      .select('*')
      .limit(5);
    
    return NextResponse.json({
      schema: {
        itemColumns: sampleItem ? Object.keys(sampleItem) : [],
        requiredFields: [
          'tenant_id (UUID)',
          'item_type (equipment|material|tool|consumable)',
          'category (string)',
          'name (string)', 
          'tracking_mode (individual|quantity|batch)',
          'current_quantity (decimal)',
          'unit_of_measure (string)'
        ],
        defaultValues: {
          status: 'active',
          current_quantity: 0
        }
      },
      sampleData: {
        items,
        transactions
      },
      warnings: [
        'containers table does not exist',
        'inventory_items table does not exist',
        'ContainerService will fail if used'
      ]
    });
  } catch (error) {
    console.error('Debug items GET error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();
    
    console.log('🔍 Debug Items POST');
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // Add defaults
    const itemData = {
      tenant_id: body.tenant_id || '00000000-0000-0000-0000-000000000000',
      item_type: body.item_type || 'material',
      category: body.category || 'general',
      name: body.name || 'Test Item',
      tracking_mode: body.tracking_mode || 'quantity',
      current_quantity: body.current_quantity || 0,
      unit_of_measure: body.unit_of_measure || 'each',
      status: body.status || 'active',
      ...body
    };
    
    console.log('Attempting insert with:', itemData);
    
    const { data, error } = await supabase
      .from('items')
      .insert(itemData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Insert failed:', error);
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        attemptedData: itemData
      }, { status: 400 });
    }
    
    console.log('✅ Insert successful:', data);
    
    // Create a transaction
    if (body.createTransaction) {
      const transaction = {
        tenant_id: data.tenant_id,
        item_id: data.id,
        transaction_type: 'check_in',
        quantity: data.current_quantity,
        location_type: 'ground',
        location_id: null,
        notes: 'Initial inventory'
      };
      
      const { data: txData, error: txError } = await supabase
        .from('item_transactions')
        .insert(transaction)
        .select()
        .single();
      
      console.log('Transaction result:', txError || txData);
      
      return NextResponse.json({
        item: data,
        transaction: txError ? { error: txError.message } : txData,
        debug: {
          itemData,
          transactionData: transaction
        }
      });
    }
    
    return NextResponse.json({
      item: data,
      debug: { itemData }
    });
    
  } catch (error) {
    console.error('Debug items POST error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
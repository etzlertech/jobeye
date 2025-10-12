/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/jobs/[jobId]/items/route.ts
 * phase: 4
 * domain: supervisor
 * purpose: API endpoints for managing items assigned to jobs via transactions
 * spec_ref: docs/job-item-management.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: {}
 * estimated_llm_cost: { "compute": "$0.00" }
 * offline_capability: NONE
 * dependencies: {
 *   internal: ['@/lib/supabase/server'],
 *   external: ['next/server'],
 *   supabase: ['items', 'item_transactions', 'jobs']
 * }
 * exports: ['GET', 'POST']
 * voice_considerations: N/A
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/api/supervisor/jobs/items.test.ts'
 * }
 * tasks: [
 *   'List items assigned to a job via transactions',
 *   'Add item to job via check_out transaction',
 *   'Track item assignments through transaction history'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/supervisor/jobs/[jobId]/items - List items assigned to job
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    console.log('🔍 Getting items assigned to job:', jobId);

    const supabase = createServiceClient();
    
    // Get the job details first
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_number, title, status')
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // Get all items currently assigned to this job via transactions
    // We'll look for the latest transaction per item where job_id matches
    const { data: transactions, error: txError } = await supabase
      .from('item_transactions')
      .select(`
        id,
        item_id,
        transaction_type,
        quantity,
        created_at,
        notes,
        items!inner(
          id,
          name,
          item_type,
          category,
          tracking_mode,
          unit_of_measure,
          current_quantity,
          status
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    
    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }
    
    // Group by item_id to get latest status per item
    const itemsMap = new Map();
    transactions?.forEach(tx => {
      if (!itemsMap.has(tx.item_id)) {
        itemsMap.set(tx.item_id, {
          transaction_id: tx.id,
          item_id: tx.item_id,
          item_name: tx.items.name,
          item_type: tx.items.item_type,
          category: tx.items.category,
          quantity: tx.quantity,
          unit_of_measure: tx.items.unit_of_measure,
          transaction_type: tx.transaction_type,
          assigned_at: tx.created_at,
          notes: tx.notes,
          status: tx.transaction_type === 'check_in' ? 'returned' : 'assigned'
        });
      }
    });
    
    // Filter to only show currently assigned items (not returned)
    const assignedItems = Array.from(itemsMap.values())
      .filter(item => item.status === 'assigned');
    
    return NextResponse.json({
      job,
      assignedItems,
      count: assignedItems.length
    });
    
  } catch (error) {
    console.error('❌ Error in GET /api/supervisor/jobs/[jobId]/items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/supervisor/jobs/[jobId]/items - Assign item to job
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    const body = await request.json();
    
    console.log('➕ Assigning item to job:', jobId);
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const supabase = createServiceClient();
    
    // Get the job to ensure it exists and get tenant_id
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, tenant_id')
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // Validate the item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, name, tracking_mode, current_quantity')
      .eq('id', body.item_id)
      .eq('tenant_id', job.tenant_id)
      .single();
    
    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    
    // Check if quantity is available for quantity-tracked items
    if (item.tracking_mode === 'quantity' && item.current_quantity < (body.quantity || 1)) {
      return NextResponse.json({
        error: `Insufficient quantity. Available: ${item.current_quantity}, Requested: ${body.quantity || 1}`
      }, { status: 400 });
    }
    
    // Create a check_out transaction to assign item to job
    const transaction = {
      tenant_id: job.tenant_id,
      item_id: body.item_id,
      transaction_type: 'check_out',
      quantity: body.quantity || 1,
      job_id: jobId,
      notes: body.notes || `Assigned to job ${jobId}`,
      from_location_id: body.from_location_id || null,
      to_location_id: body.to_location_id || null
    };
    
    console.log('Creating transaction:', transaction);
    
    const { data: txData, error: txError } = await supabase
      .from('item_transactions')
      .insert(transaction)
      .select()
      .single();
    
    if (txError) {
      console.error('❌ Transaction error:', txError);
      return NextResponse.json({
        error: txError.message,
        code: txError.code,
        details: txError.details,
        hint: txError.hint
      }, { status: 400 });
    }
    
    // Update item quantity if quantity-tracked
    if (item.tracking_mode === 'quantity') {
      const newQuantity = item.current_quantity - transaction.quantity;
      const { error: updateError } = await supabase
        .from('items')
        .update({ current_quantity: newQuantity })
        .eq('id', item.id)
        .eq('tenant_id', job.tenant_id);
      
      if (updateError) {
        console.error('⚠️ Failed to update item quantity:', updateError);
      }
    }
    
    console.log('✅ Item assigned to job:', txData);
    
    return NextResponse.json({
      transaction: txData,
      message: `Item "${item.name}" assigned to job`
    });
    
  } catch (error) {
    console.error('❌ Error in POST /api/supervisor/jobs/[jobId]/items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
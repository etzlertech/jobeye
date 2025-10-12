/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/jobs/[jobId]/items/[itemId]/route.ts
 * phase: 4
 * domain: supervisor
 * purpose: API endpoint for removing items from jobs
 * spec_ref: docs/job-item-management.md
 * complexity_budget: 100
 * migrations_touched: []
 * state_machine: {}
 * estimated_llm_cost: { "compute": "$0.00" }
 * offline_capability: NONE
 * dependencies: {
 *   internal: ['@/lib/supabase/server'],
 *   external: ['next/server'],
 *   supabase: ['items', 'item_transactions', 'jobs']
 * }
 * exports: ['DELETE']
 * voice_considerations: N/A
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/api/supervisor/jobs/items.test.ts'
 * }
 * tasks: [
 *   'Remove item assignment from job via check_in transaction'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// DELETE /api/supervisor/jobs/[jobId]/items/[itemId] - Remove item from job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string; itemId: string } }
) {
  try {
    const { jobId, itemId } = params;
    
    console.log('🗑️ Removing item:', itemId, 'from job:', jobId);
    
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
    
    // Find the latest check_out transaction for this item and job
    const { data: lastTransaction, error: txError } = await supabase
      .from('item_transactions')
      .select('id, quantity, item_id')
      .eq('job_id', jobId)
      .eq('item_id', itemId)
      .eq('transaction_type', 'check_out')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (txError || !lastTransaction) {
      return NextResponse.json({ error: 'Item assignment not found' }, { status: 404 });
    }
    
    // Create a check_in transaction to return the item
    const returnTransaction = {
      tenant_id: job.tenant_id,
      item_id: itemId,
      transaction_type: 'check_in',
      quantity: lastTransaction.quantity,
      job_id: jobId,
      notes: `Returned from job ${jobId}`,
      from_location_id: null,
      to_location_id: null
    };
    
    const { data: txData, error: createError } = await supabase
      .from('item_transactions')
      .insert(returnTransaction)
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Transaction error:', createError);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }
    
    // Update item quantity if quantity-tracked
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('tracking_mode, current_quantity')
      .eq('id', itemId)
      .single();
    
    if (!itemError && item && item.tracking_mode === 'quantity') {
      const newQuantity = item.current_quantity + lastTransaction.quantity;
      const { error: updateError } = await supabase
        .from('items')
        .update({ current_quantity: newQuantity })
        .eq('id', itemId)
        .eq('tenant_id', job.tenant_id);
      
      if (updateError) {
        console.error('⚠️ Failed to update item quantity:', updateError);
      }
    }
    
    console.log('✅ Item removed from job:', txData);
    
    return NextResponse.json({
      transaction: txData,
      message: 'Item removed from job'
    });
    
  } catch (error) {
    console.error('❌ Error in DELETE /api/supervisor/jobs/[jobId]/items/[itemId]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
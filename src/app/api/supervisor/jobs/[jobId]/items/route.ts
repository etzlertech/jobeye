import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/supervisor/jobs/[jobId]/items - List job checklist items
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    console.log('🔍 Getting checklist items for job:', jobId);

    const supabase = createServiceClient();
    
    // Get checklist items for the job
    const { data: checklistItems, error } = await supabase
      .from('job_checklist_items')
      .select('*')
      .eq('job_id', jobId)
      .order('sequence_number', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching checklist items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Also get the job details
    const { data: job } = await supabase
      .from('jobs')
      .select('id, job_number, title, status')
      .eq('id', jobId)
      .single();
    
    return NextResponse.json({
      job,
      checklistItems: checklistItems || [],
      count: checklistItems?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Error in GET /api/supervisor/jobs/[jobId]/items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/supervisor/jobs/[jobId]/items - Add item to job checklist
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    const body = await request.json();
    
    console.log('➕ Adding item to job:', jobId);
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
    
    // Get the next sequence number
    const { data: existingItems } = await supabase
      .from('job_checklist_items')
      .select('sequence_number')
      .eq('job_id', jobId)
      .order('sequence_number', { ascending: false })
      .limit(1);
    
    const nextSequence = existingItems && existingItems.length > 0 
      ? (existingItems[0].sequence_number || 0) + 1 
      : 1;
    
    // Create the checklist item
    const checklistItem = {
      job_id: jobId,
      tenant_id: job.tenant_id,
      sequence_number: nextSequence,
      item_type: body.item_type || 'material',
      item_id: body.item_id,
      item_name: body.item_name,
      quantity: body.quantity || 1,
      container_id: body.container_id || null,
      status: 'pending',
      is_optional: body.is_optional || false,
      notes: body.notes || null
    };
    
    console.log('Creating checklist item:', checklistItem);
    
    const { data, error } = await supabase
      .from('job_checklist_items')
      .insert(checklistItem)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Insert error:', error);
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        attemptedData: checklistItem
      }, { status: 400 });
    }
    
    console.log('✅ Checklist item created:', data);
    
    return NextResponse.json({
      checklistItem: data,
      message: `Item "${body.item_name}" added to job checklist`
    });
    
  } catch (error) {
    console.error('❌ Error in POST /api/supervisor/jobs/[jobId]/items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/supervisor/jobs/[jobId]/items/[itemId] - Remove item from checklist
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const checklistItemId = pathParts[pathParts.length - 1];
    
    console.log('🗑️ Removing checklist item:', checklistItemId, 'from job:', params.jobId);
    
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('job_checklist_items')
      .delete()
      .eq('id', checklistItemId)
      .eq('job_id', params.jobId);
    
    if (error) {
      console.error('❌ Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({
      message: 'Item removed from job checklist'
    });
    
  } catch (error) {
    console.error('❌ Error in DELETE /api/supervisor/jobs/[jobId]/items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;
    const supabase = createServiceClient();
    
    // First, check if this item is currently assigned to a job
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('assigned_to_job_id')
      .eq('id', itemId)
      .single();
    
    if (itemError) {
      console.error('Error fetching item:', itemError);
      return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
    }
    
    // Also get all jobs this item was used in via transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('item_transactions')
      .select('job_id')
      .eq('item_id', itemId)
      .not('job_id', 'is', null);
    
    if (transactionsError) {
      console.error('Error fetching item transactions:', transactionsError);
      return NextResponse.json({ error: 'Failed to fetch item transactions' }, { status: 500 });
    }
    
    // Collect all unique job IDs
    const jobIds = [];
    if (item?.assigned_to_job_id) {
      jobIds.push(item.assigned_to_job_id);
    }
    if (transactions && transactions.length > 0) {
      const transactionJobIds = transactions.map(t => t.job_id);
      jobIds.push(...transactionJobIds);
    }
    
    // Get unique job IDs
    const uniqueJobIds = [...new Set(jobIds)];
    
    if (uniqueJobIds.length === 0) {
      return NextResponse.json({ jobs: [] });
    }
    
    // Fetch job details
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        job_number,
        title,
        status,
        customer_name
      `)
      .in('id', uniqueJobIds)
      .order('created_at', { ascending: false });
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      jobs: jobs || []
    });
    
  } catch (error) {
    console.error('Error in GET /api/supervisor/items/[itemId]/jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
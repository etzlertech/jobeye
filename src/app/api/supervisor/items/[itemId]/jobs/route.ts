import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;
    const supabase = createServiceClient();
    
    // Get the item first to check if it's currently assigned to a job
    const { data: item } = await supabase
      .from('items')
      .select('assigned_to_job_id')
      .eq('id', itemId)
      .single();
    
    // Also get all transactions for this item that have a job_id
    const { data: transactions } = await supabase
      .from('item_transactions')
      .select('job_id')
      .eq('item_id', itemId)
      .not('job_id', 'is', null);
    
    // Collect all unique job IDs
    const jobIds = new Set<string>();
    
    // Add currently assigned job if any
    if (item?.assigned_to_job_id) {
      jobIds.add(item.assigned_to_job_id);
    }
    
    // Add jobs from transactions
    transactions?.forEach(t => {
      if (t.job_id) jobIds.add(t.job_id);
    });
    
    if (jobIds.size === 0) {
      return NextResponse.json({ jobs: [] });
    }
    
    // Fetch job details
    const { data: jobsRaw, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        job_number,
        title,
        status,
        created_at,
        customers:customer_id (
          name
        )
      `)
      .in('id', Array.from(jobIds))
      .order('created_at', { ascending: false });
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }
    
    const jobs = (jobsRaw || []).map(job => ({
      id: job.id,
      job_number: job.job_number,
      title: job.title,
      status: job.status,
      customerName: job.customers?.name ?? null,
      created_at: job.created_at
    }));
    
    return NextResponse.json({
      jobs
    });
    
  } catch (error) {
    console.error('Error in GET /api/supervisor/items/[itemId]/jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;
    const supabase = createServiceClient();
    
    // First, get all job_items entries for this item
    const { data: jobItems, error: jobItemsError } = await supabase
      .from('job_items')
      .select('job_id')
      .eq('item_id', itemId);
    
    if (jobItemsError) {
      console.error('Error fetching job items:', jobItemsError);
      return NextResponse.json({ error: 'Failed to fetch job items' }, { status: 500 });
    }
    
    if (!jobItems || jobItems.length === 0) {
      return NextResponse.json({ jobs: [] });
    }
    
    // Get unique job IDs
    const jobIds = [...new Set(jobItems.map(ji => ji.job_id))];
    
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
      .in('id', jobIds)
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
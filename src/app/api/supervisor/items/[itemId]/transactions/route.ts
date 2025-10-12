import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;
    const supabase = createServiceClient();
    
    // Get transactions for this item
    const { data: transactions, error } = await supabase
      .from('item_transactions')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
    
    // If there are transactions with job_id, fetch the job details separately
    const jobIds = transactions
      ?.filter(t => t.job_id)
      .map(t => t.job_id)
      .filter((id, index, self) => self.indexOf(id) === index); // unique IDs
    
    let jobsMap = new Map();
    if (jobIds && jobIds.length > 0) {
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, job_number, title')
        .in('id', jobIds);
      
      if (!jobsError && jobs) {
        jobs.forEach(job => jobsMap.set(job.id, job));
      }
    }
    
    // Attach job details to transactions
    const transactionsWithJobs = transactions?.map(transaction => ({
      ...transaction,
      job: transaction.job_id ? jobsMap.get(transaction.job_id) || null : null
    })) || [];
    
    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      transactions: transactionsWithJobs
    });
    
  } catch (error) {
    console.error('Error in GET /api/supervisor/items/[itemId]/transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
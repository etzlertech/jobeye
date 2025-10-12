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
      .select(`
        *,
        job:jobs(
          id,
          job_number,
          title
        )
      `)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      transactions: transactions || []
    });
    
  } catch (error) {
    console.error('Error in GET /api/supervisor/items/[itemId]/transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
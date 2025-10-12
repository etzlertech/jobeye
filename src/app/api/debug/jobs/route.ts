import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();
    
    console.log('Debug: Request body:', JSON.stringify(body, null, 2));
    
    // Test 1: Generate job number
    const { data: countData, error: countError } = await supabase
      .from('jobs')
      .select('job_number', { count: 'exact', head: true })
      .eq('tenant_id', '00000000-0000-0000-0000-000000000000');
    
    console.log('Debug: Count query result:', { countData, countError });
    
    const count = countData?.count || 0;
    const jobNumber = `JOB-${String(count + 1).padStart(4, '0')}`;
    
    console.log('Debug: Generated job number:', jobNumber);
    
    // Test 2: Create job with minimal fields
    const jobData = {
      tenant_id: '00000000-0000-0000-0000-000000000000',
      job_number: jobNumber,
      title: body.title || 'Test Job',
      customer_id: body.customer_id,
      status: 'scheduled',
      priority: body.priority || 'normal',
      scheduled_start: body.scheduled_start || new Date().toISOString()
    };
    
    console.log('Debug: Job data to insert:', JSON.stringify(jobData, null, 2));
    
    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert(jobData)
      .select()
      .single();
    
    console.log('Debug: Insert result:', { job, insertError });
    
    if (insertError) {
      return NextResponse.json({ 
        error: insertError.message,
        details: insertError,
        jobData 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      job,
      debug: {
        jobNumber,
        count,
        jobData
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    // Get job table schema
    const { data: columns, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'jobs' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });
    
    return NextResponse.json({ 
      columns: columns || [],
      error 
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
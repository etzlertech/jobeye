import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const userId = context.userId;
    const tenantId = context.tenantId;

    if (!userId) {
      return NextResponse.json({ error: 'No user' }, { status: 400 });
    }

    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // Test 1: Just job_assignments
    const { data: test1, error: err1 } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    // Test 2: With jobs join
    const { data: test2, error: err2 } = await supabase
      .from('job_assignments')
      .select('*, jobs(*)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    // Test 3: Full join like jobs/today
    const { data: test3, error: err3 } = await supabase
      .from('job_assignments')
      .select(`
        job_id,
        assigned_at,
        jobs (
          id,
          scheduled_start,
          status,
          customers (id, name),
          properties (id, address)
        )
      `)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    return NextResponse.json({
      userId,
      tenantId,
      test1: {
        count: test1?.length || 0,
        error: err1 ? { code: err1.code, message: err1.message } : null
      },
      test2: {
        count: test2?.length || 0,
        error: err2 ? { code: err2.code, message: err2.message } : null
      },
      test3: {
        count: test3?.length || 0,
        error: err3 ? { code: err3.code, message: err3.message } : null
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      code: error.code
    }, { status: 500 });
  }
}

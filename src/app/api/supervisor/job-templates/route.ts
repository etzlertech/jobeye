import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
import { getRequestContext } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;

    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    // For now, return empty array as job_templates table may not exist yet
    // This allows the job creation page to load
    const { data: templates, error } = await supabase
      .from('job_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Job templates table may not exist yet:', error);
      return NextResponse.json({ templates: [] });
    }

    return NextResponse.json({ templates: templates || [] });

  } catch (error) {
    return handleApiError(error);
  }
}

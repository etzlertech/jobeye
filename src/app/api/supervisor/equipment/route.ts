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

    // Try to get from items table with equipment-related categories
    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('category', ['equipment', 'tools'])
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load equipment from items table:', error);
      return NextResponse.json({ equipment: [] });
    }

    // Transform items to equipment format expected by frontend
    const equipment = (items || []).map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      available: item.status === 'active',
      inUse: false
    }));

    return NextResponse.json({ equipment });

  } catch (error) {
    return handleApiError(error);
  }
}

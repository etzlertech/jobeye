import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  return NextResponse.json({
    cookies: allCookies.map(c => ({ name: c.name, hasValue: !!c.value })),
    user: user ? {
      id: user.id,
      email: user.email,
      app_metadata: user.app_metadata
    } : null,
    error: error?.message || null
  });
}

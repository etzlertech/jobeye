import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';

export async function GET(request: Request) {
  try {
    // Test basic health
    const baseHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '3.2.1',
      commit: '6107fa7-with-fallback-tenant'
    };

    // Test Supabase connection
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    baseHealth.auth = {
      connected: !authError,
      authenticated: !!user,
      userId: user?.id,
      email: user?.email,
      hasAppMetadata: !!user?.app_metadata,
      hasTenantId: !!user?.app_metadata?.tenant_id,
      appMetadata: user?.app_metadata
    };

    // Test request context resolution
    try {
      const context = await getRequestContext(request);
      baseHealth.context = {
        resolved: true,
        tenantId: context.tenantId,
        roles: context.roles,
        source: context.source
      };
    } catch (ctxError) {
      baseHealth.context = {
        resolved: false,
        error: ctxError instanceof Error ? ctxError.message : 'Unknown error'
      };
    }

    return NextResponse.json(baseHealth);
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      commit: '6107fa7-with-fallback-tenant'
    }, { status: 500 });
  }
}
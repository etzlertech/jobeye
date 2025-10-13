import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    deployment: {
      version: '3.2.1',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    },
    configuration: {
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'NOT_SET',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    authSettings: {
      needsSiteUrl: !process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === 'production',
      redirectUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://jobeye-production.up.railway.app'
    }
  };

  return NextResponse.json(config);
}
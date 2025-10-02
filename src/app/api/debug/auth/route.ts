import { NextResponse } from 'next/server';

export async function GET() {
  // Check environment variables (safely)
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET';
  const urlLength = supabaseUrl.length;
  const keyLength = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length;
  
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    supabase: {
      url_configured: hasSupabaseUrl,
      url_length: urlLength,
      url_preview: hasSupabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT_SET',
      anon_key_configured: hasSupabaseAnonKey,
      anon_key_length: keyLength
    },
    timestamp: new Date().toISOString()
  });
}
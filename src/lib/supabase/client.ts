/*
AGENT DIRECTIVE BLOCK
file: /src/lib/supabase/client.ts
phase: 1
domain: core-infrastructure
purpose: Supabase client configuration for browser and server environments
spec_ref: v4-blueprint
complexity_budget: 100
offline_capability: REQUIRED
dependencies:
  external:
    - @supabase/supabase-js
    - @supabase/auth-helpers-nextjs
  internal: []
exports:
  - supabase (browser client)
  - createServerClient
  - getSession
  - getUser
voice_considerations: N/A - Infrastructure component
test_requirements:
  coverage: 95%
  test_file: __tests__/lib/supabase/client.test.ts
tasks:
  - Create browser client singleton
  - Create server client factory
  - Add session helpers
  - Configure auth persistence
*/

import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Environment validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Browser client singleton
export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'jobeye-auth-token',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      headers: {
        'x-client-info': 'jobeye-v4',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Server client factory for Next.js App Router
export async function createServerClient() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  
  return createBrowserClient<Database>(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

// Helper to get current session
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
}

// Helper to get current user with tenant info
export async function getUser() {
  const session = await getSession();
  if (!session?.user) return null;
  
  // Get user's tenant assignment
  const { data: tenantAssignment } = await supabase
    .from('tenant_assignments')
    .select('tenant_id, role, is_primary')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single();
    
  return {
    ...session.user,
    tenantId: tenantAssignment?.tenant_id,
    role: tenantAssignment?.role,
  };
}
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/lib/supabase/client.ts
// phase: 1
// domain: core-infrastructure
// purpose: Supabase client configuration for browser and server environments
// spec_ref: v4-blueprint
// version: 2025-08-1
// complexity_budget: 100
// offline_capability: REQUIRED
//
// dependencies:
//   external:
//     - @supabase/supabase-js
//     - @supabase/ssr
//   internal:
//     - none
//
// exports:
//   - supabase (browser client)
//   - createServerClient
//   - getSession
//   - getUser
//
// voice_considerations: N/A - Infrastructure component
//
// test_requirements:
//   coverage: 95%
//   test_file: __tests__/lib/supabase/client.test.ts
//
// tasks:
//   1. Create browser client singleton
//   2. Create server client factory
//   3. Add session helpers
//   4. Configure auth persistence
// --- END DIRECTIVE BLOCK ---

import { createBrowserClient as createSupabaseBrowserClient, createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Environment validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Browser client singleton
export const supabase = createSupabaseBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    // Let @supabase/ssr handle cookies automatically
    // This ensures compatibility between client and server
    global: {
      headers: {
        'x-client-info': 'jobeye-v4'
      }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    auth: {
      // Use cookies for session storage (not localStorage)
      // This allows server-side API routes to access the session
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

// Server client factory for Next.js App Router
export async function createServerClient(): Promise<SupabaseClient<Database>> {
  const { cookies } = await import('next/headers');

  try {
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === 'production';

    return createSupabaseServerClient<Database>(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                // In production, ensure cookies work cross-origin with SameSite=None; Secure
                const cookieOptions = isProduction
                  ? {
                      ...options,
                      sameSite: 'none' as const,
                      secure: true,
                    }
                  : options;

                cookieStore.set({ name, value, ...cookieOptions });
              } catch {
                // Ignore errors when headers are immutable (e.g., in API routes)
              }
            });
          }
        }
      }
    );
  } catch (error) {
    // Fallback for environments without Next.js cookies helper (tests, scripts)
    return createSupabaseServerClient<Database>(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => undefined
        }
      }
    );
  }
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

  const assignment = tenantAssignment as { tenant_id?: string; role?: string } | null;

  return {
    ...session.user,
    tenantId: assignment?.tenant_id ?? null,
    role: assignment?.role ?? null
  };
}

// Aliases for legacy imports
export const createClient = () => supabase;
export const createSupabaseClient = () => supabase;

// Export browser client factory for consistency with server client
export const createBrowserClient = () => supabase;

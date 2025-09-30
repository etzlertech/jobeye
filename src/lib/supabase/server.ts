/*
AGENT DIRECTIVE BLOCK
file: /src/lib/supabase/server.ts
phase: 1
domain: core-infrastructure
purpose: Supabase server-side client for API routes and server components
spec_ref: v4-blueprint
complexity_budget: 80
offline_capability: NONE
dependencies:
  external:
    - @supabase/supabase-js
    - @supabase/ssr
  internal: []
exports:
  - createClient
voice_considerations: N/A - Infrastructure component
test_requirements:
  coverage: 95%
  test_file: __tests__/lib/supabase/server.test.ts
tasks:
  - Create server client factory for API routes
  - Support cookie-based auth
  - Add service role client option
*/

import { createServerClient as createSSRClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { cookies } from 'next/headers';

// Environment validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Creates a Supabase client for use in API routes and server components
 * Uses cookie-based authentication from Next.js
 * In test environments where cookies() is unavailable, creates a basic client
 */
export async function createClient() {
  try {
    const cookieStore = await cookies();

    return createSSRClient<Database>(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Handle case where cookies cannot be set (e.g., middleware)
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Handle case where cookies cannot be removed
            }
          },
        },
      }
    );
  } catch (error) {
    // In test environment, cookies() throws - return a basic client
    return createSupabaseClient<Database>(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
}

/**
 * Creates a Supabase client with service role key for admin operations
 * WARNING: Use with caution - bypasses RLS policies
 */
export function createServiceRoleClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  return createSupabaseClient<Database>(
    supabaseUrl!,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
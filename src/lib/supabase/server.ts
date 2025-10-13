// --- AGENT DIRECTIVE BLOCK ---
// file: /src/lib/supabase/server.ts
// phase: 1
// domain: core-infrastructure
// purpose: Create Supabase clients for server-side workflows with cookie support
// spec_ref: v4-blueprint
// version: 2025-08-1
// complexity_budget: 120 LoC
// offline_capability: N/A
//
// dependencies:
//   external:
//     - @supabase/ssr
//     - @supabase/supabase-js
//     - next/headers
//   internal:
//     - /src/types/database
//
// exports:
//   - createClient
//   - createServiceClient
//   - createServerClient
//
// voice_considerations: N/A - infrastructure helper
//
// test_requirements:
//   coverage: 90%
//   test_file: __tests__/lib/supabase/server.test.ts
//
// tasks:
//   1. Provide server-side Supabase client with cookie persistence
//   2. Expose service-role client factory
//   3. Maintain compatibility with legacy imports
// --- END DIRECTIVE BLOCK ---

import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing Supabase environment variable NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing Supabase environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const resolvedSupabaseUrl = supabaseUrl as string;
const resolvedSupabaseAnonKey = supabaseAnonKey as string;

/**
 * Create a Supabase client for server-side use with cookie support.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  try {
    const cookieStore = await cookies();

    return createSupabaseServerClient<Database>(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cookieList) => {
          cookieList.forEach(({ name, value, options }) => {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {
              // Ignore errors when headers are immutable (e.g., in API routes)
            }
          });
        }
      }
    });
  } catch (error) {
    // Fallback for tests or environments without Next.js cookies helper
    return createSupabaseServerClient<Database>(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
      cookies: {
        getAll: () => [],
        setAll: () => undefined
      }
    });
  }
}

/**
 * Create a Supabase client with service role key for admin operations.
 */
export function createServiceClient(): SupabaseClient<Database> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createSupabaseClient<Database>(resolvedSupabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Alias retained for legacy imports expecting createServerClient name.
 */
export const createServerClient = createClient;

/**
 * Alias for legacy imports expecting createServerSupabaseClient name.
 */
export const createServerSupabaseClient = createClient;

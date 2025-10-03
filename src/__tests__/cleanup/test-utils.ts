/**
 * @file Test utilities for cleanup feature tests
 */

import { createClient } from '@supabase/supabase-js';

export function createTestClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for testing');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function cleanupTestData(client: any, tables: string[]) {
  for (const table of tables) {
    await client.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

export const mockRequest = (body?: any) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: body ? JSON.stringify(body) : undefined,
});

export const mockGetRequest = (url: string) => ({
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  url,
});
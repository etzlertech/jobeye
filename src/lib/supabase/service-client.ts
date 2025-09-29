import { createClient } from '@supabase/supabase-js';
import { config } from '@/core/config/environment';

export function createServiceSupabaseClient() {
  if (!config.supabase.url) {
    throw new Error('Supabase URL missing in configuration');
  }

  if (!config.supabase.serviceKey) {
    throw new Error('Supabase service role key missing in configuration');
  }

  return createClient(config.supabase.url, config.supabase.serviceKey);
}

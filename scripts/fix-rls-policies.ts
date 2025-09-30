#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function fixRLSPolicies() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Fixing RLS policies for scheduling tables...\n');

  const statements = [
    'DROP POLICY IF EXISTS day_plans_tenant_access ON public.day_plans',
    'DROP POLICY IF EXISTS schedule_events_tenant_access ON public.schedule_events',
    `CREATE POLICY day_plans_tenant_access ON public.day_plans
      USING (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'))
      WITH CHECK (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'))`,
    `CREATE POLICY schedule_events_tenant_access ON public.schedule_events
      USING (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'))
      WITH CHECK (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'))`,
  ];

  for (const stmt of statements) {
    console.log(`→ ${stmt.substring(0, 80)}${stmt.length > 80 ? '...' : ''}`);

    const { error } = await client.rpc('exec_sql', { sql: stmt }).select();

    if (error) {
      console.error('  ❌ Error:', error.message);
    } else {
      console.log('  ✅ Success\n');
    }
  }

  console.log('✅ RLS policies fixed!\n');
  console.log('Users now need app_metadata.company_id in their JWT claims');
}

fixRLSPolicies().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
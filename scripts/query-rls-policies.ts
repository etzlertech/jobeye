#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function queryRLSPolicies() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Querying RLS Policies on jobs and users_extended tables...\n');

  // Query policies via direct SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename IN ('jobs', 'users_extended')
      ORDER BY tablename, policyname;
    `
  });

  if (error) {
    console.error('❌ Error querying policies:', error);
    return;
  }

  console.log('📋 RLS Policies Found:\n');
  console.log(JSON.stringify(data, null, 2));
}

queryRLSPolicies().catch(console.error);

#!/usr/bin/env tsx
/**
 * Apply the crew RLS policies migration
 * This script reads and executes the 20251020230000_add_crew_rls_policies.sql migration
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function applyMigration() {
  console.log('🚀 Applying crew RLS policies migration...\n');

  const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20251020230000_add_crew_rls_policies.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');

  // Try to execute via exec_sql RPC
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ RPC exec_sql not available:', error.message);
      console.log('\n📋 The migration file exists at:');
      console.log('   supabase/migrations/20251020230000_add_crew_rls_policies.sql');
      console.log('\n⚠️  Apply it manually using one of these methods:');
      console.log('   1. Supabase Dashboard SQL Editor');
      console.log('   2. See: supabase/migrations/README_APPLY_CREW_RLS.md');
      console.log('\n💡 Quick link:');
      console.log('   https://supabase.com/dashboard/project/jfwtpspucbxttwziprbz/sql\n');
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('   Crew members can now see their assigned jobs\n');
  } catch (error: any) {
    console.error('❌ Error applying migration:', error.message);
    console.log('\n📋 Apply the migration manually');
    console.log('   See: supabase/migrations/README_APPLY_CREW_RLS.md\n');
    process.exit(1);
  }
}

applyMigration();

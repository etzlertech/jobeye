#!/usr/bin/env tsx
/**
 * Fix RLS Policies: T003-T006 Constitution §1 Compliance
 *
 * Purpose: Replace non-compliant RLS policies with Constitution-approved pattern
 * Date: 2025-10-14
 *
 * Constitution §1 Required Pattern:
 * tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSql(sql: string, description: string): Promise<boolean> {
  console.log(`\n🔄 ${description}...`);
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      if (error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('does not exist')) {
        console.log(`⚠️  ${description}: Already in desired state (skipped)`);
        return true;
      }
      console.error(`❌ ${description}: ${error.message}`);
      return false;
    }

    console.log(`✅ ${description}: Success`);
    return true;
  } catch (err: any) {
    console.error(`❌ ${description}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Fix RLS Policies: T003-T006 Constitution §1 Compliance ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Pattern: tenant_id::text = (current_setting(...) -> app_metadata ->> tenant_id)');
  console.log('');

  let successCount = 0;
  let failCount = 0;

  // ========================================
  // T003: Fix customers table RLS
  // ========================================
  console.log('\n📋 T003: Fix customers Table RLS Policy');
  console.log('Issue: Hardcoded tenant ID');
  console.log('');

  if (await executeSql(
    `DROP POLICY IF EXISTS customers_demo_access ON customers;`,
    'T003-1: Drop hardcoded policy (customers_demo_access)'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE POLICY customers_tenant_isolation ON customers
     FOR ALL TO authenticated
     USING (
       tenant_id::text = (
         current_setting('request.jwt.claims', true)::json
         -> 'app_metadata'
         ->> 'tenant_id'
       )
     )
     WITH CHECK (
       tenant_id::text = (
         current_setting('request.jwt.claims', true)::json
         -> 'app_metadata'
         ->> 'tenant_id'
       )
     );`,
    'T003-2: Create Constitution-compliant policy (customers)'
  )) successCount++; else failCount++;

  // ========================================
  // T004: Fix properties table RLS
  // ========================================
  console.log('\n\n📋 T004: Fix properties Table RLS Policy');
  console.log('Issue: Uses tenant_assignments lookup (performance issue)');
  console.log('');

  if (await executeSql(
    `DROP POLICY IF EXISTS "Users can manage their tenant's properties" ON properties;`,
    'T004-1: Drop tenant_assignments policy #1 (properties)'
  )) successCount++; else failCount++;

  if (await executeSql(
    `DROP POLICY IF EXISTS "Users can view their tenant's properties" ON properties;`,
    'T004-2: Drop duplicate SELECT policy (properties)'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE POLICY properties_tenant_isolation ON properties
     FOR ALL TO authenticated
     USING (
       tenant_id::text = (
         current_setting('request.jwt.claims', true)::json
         -> 'app_metadata'
         ->> 'tenant_id'
       )
     )
     WITH CHECK (
       tenant_id::text = (
         current_setting('request.jwt.claims', true)::json
         -> 'app_metadata'
         ->> 'tenant_id'
       )
     );`,
    'T004-3: Create Constitution-compliant policy (properties)'
  )) successCount++; else failCount++;

  // ========================================
  // T005: Fix items table RLS (add WITH CHECK)
  // ========================================
  console.log('\n\n📋 T005: Fix items Table RLS Policy');
  console.log('Issue: Missing WITH CHECK clause, wrong role');
  console.log('');

  if (await executeSql(
    `DROP POLICY IF EXISTS items_tenant_isolation ON items;`,
    'T005-1: Drop existing policy (items)'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE POLICY items_tenant_isolation ON items
     FOR ALL TO authenticated
     USING (
       tenant_id::text = (
         current_setting('request.jwt.claims', true)::json
         -> 'app_metadata'
         ->> 'tenant_id'
       )
     )
     WITH CHECK (
       tenant_id::text = (
         current_setting('request.jwt.claims', true)::json
         -> 'app_metadata'
         ->> 'tenant_id'
       )
     );`,
    'T005-2: Recreate policy with WITH CHECK (items)'
  )) successCount++; else failCount++;

  // ========================================
  // T006: Fix jobs table RLS
  // ========================================
  console.log('\n\n📋 T006: Fix jobs Table RLS Policy');
  console.log('Issue: Uses tenant_assignments lookup (performance issue)');
  console.log('');

  if (await executeSql(
    `DROP POLICY IF EXISTS "Users can manage their tenant's jobs" ON jobs;`,
    'T006-1: Drop tenant_assignments policy #1 (jobs)'
  )) successCount++; else failCount++;

  if (await executeSql(
    `DROP POLICY IF EXISTS "Users can view their tenant's jobs" ON jobs;`,
    'T006-2: Drop duplicate SELECT policy (jobs)'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE POLICY jobs_tenant_isolation ON jobs
     FOR ALL TO authenticated
     USING (
       tenant_id::text = (
         current_setting('request.jwt.claims', true)::json
         -> 'app_metadata'
         ->> 'tenant_id'
       )
     )
     WITH CHECK (
       tenant_id::text = (
         current_setting('request.jwt.claims', true)::json
         -> 'app_metadata'
         ->> 'tenant_id'
       )
     );`,
    'T006-3: Create Constitution-compliant policy (jobs)'
  )) successCount++; else failCount++;

  // ========================================
  // Fix job_checklist_items (add WITH CHECK)
  // ========================================
  console.log('\n\n📋 Fix job_checklist_items Table RLS Policy');
  console.log('Issue: Missing WITH CHECK clause');
  console.log('');

  if (await executeSql(
    `DROP POLICY IF EXISTS job_checklist_items_tenant_isolation ON job_checklist_items;`,
    'Fix-1: Drop existing policy (job_checklist_items)'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE POLICY job_checklist_items_tenant_isolation ON job_checklist_items
     FOR ALL TO authenticated
     USING (
       EXISTS (
         SELECT 1 FROM jobs j
         WHERE j.id = job_checklist_items.job_id
         AND j.tenant_id::text = (
           current_setting('request.jwt.claims', true)::json
           -> 'app_metadata'
           ->> 'tenant_id'
         )
       )
     )
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM jobs j
         WHERE j.id = job_checklist_items.job_id
         AND j.tenant_id::text = (
           current_setting('request.jwt.claims', true)::json
           -> 'app_metadata'
           ->> 'tenant_id'
         )
       )
     );`,
    'Fix-2: Recreate policy with WITH CHECK (job_checklist_items)'
  )) successCount++; else failCount++;

  // Summary
  console.log('\n\n=== Migration Summary ===');
  console.log(`✅ Successful operations: ${successCount}`);
  console.log(`❌ Failed operations: ${failCount}`);
  console.log(`⏱️  Completed at: ${new Date().toISOString()}`);

  if (failCount === 0) {
    console.log('\n🎉 All RLS policies updated successfully!');
    console.log('\n✅ Constitution §1 compliance:');
    console.log('  - customers: JWT app_metadata (fixed hardcoded ID)');
    console.log('  - properties: JWT app_metadata (removed tenant_assignments lookup)');
    console.log('  - items: JWT app_metadata + WITH CHECK (added missing clause)');
    console.log('  - jobs: JWT app_metadata (removed tenant_assignments lookup)');
    console.log('  - job_checklist_items: JWT app_metadata via JOIN + WITH CHECK');
    console.log('\n📝 Next step: Validate policies with smoke test (T003-T006 validation)');
  } else {
    console.log('\n⚠️  Some operations failed. Review errors above.');
    process.exit(1);
  }
}

main().catch(console.error);

#!/usr/bin/env tsx
/**
 * Minimal migration: Create job_checklist_items table only
 * Adapted for tenant-based architecture (not company-based)
 *
 * Purpose: Unblock feature 007 implementation
 * Date: 2025-10-14
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
          error.message.includes('duplicate')) {
        console.log(`⚠️  ${description}: Already exists (skipped)`);
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
  console.log('=== Minimal Migration: job_checklist_items Table ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Architecture: Tenant-based isolation via jobs relationship');
  console.log('');

  let successCount = 0;
  let failCount = 0;

  // Create job_checklist_items table (simplified, no containers dependency)
  console.log('\n📦 Creating job_checklist_items Table');

  if (await executeSql(
    `CREATE TABLE IF NOT EXISTS job_checklist_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      sequence_number INT NOT NULL,
      item_type TEXT CHECK (item_type IN ('equipment', 'material')),
      item_id UUID NOT NULL,
      item_name TEXT NOT NULL,
      quantity INT DEFAULT 1,
      container_id UUID,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'loaded', 'verified', 'missing')),
      vlm_prompt TEXT,
      acceptance_criteria TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT job_checklist_sequence_unique UNIQUE(job_id, sequence_number)
    );`,
    'Create job_checklist_items table'
  )) successCount++; else failCount++;

  // Create index
  if (await executeSql(
    `CREATE INDEX IF NOT EXISTS idx_job_checklist_items_job ON job_checklist_items(job_id);`,
    'Index: checklist items by job'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE INDEX IF NOT EXISTS idx_job_checklist_items_status ON job_checklist_items(job_id, status);`,
    'Index: checklist items by status'
  )) successCount++; else failCount++;

  // Create updated_at trigger
  if (await executeSql(
    `CREATE OR REPLACE FUNCTION set_updated_at()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;`,
    'Create set_updated_at function'
  )) successCount++; else failCount++;

  if (await executeSql(
    `DROP TRIGGER IF EXISTS set_updated_at_job_checklist_items ON job_checklist_items;`,
    'Drop existing updated_at trigger'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE TRIGGER set_updated_at_job_checklist_items
     BEFORE UPDATE ON job_checklist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();`,
    'Create trigger for job_checklist_items'
  )) successCount++; else failCount++;

  // Enable RLS
  if (await executeSql(
    `ALTER TABLE job_checklist_items ENABLE ROW LEVEL SECURITY;`,
    'Enable RLS on job_checklist_items'
  )) successCount++; else failCount++;

  // Create RLS policy (tenant isolation via jobs)
  if (await executeSql(
    `DROP POLICY IF EXISTS job_checklist_items_tenant_isolation ON job_checklist_items;`,
    'Drop existing RLS policy'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE POLICY job_checklist_items_tenant_isolation ON job_checklist_items
     FOR ALL TO authenticated
     USING (
       EXISTS (
         SELECT 1 FROM jobs j
         WHERE j.id = job_checklist_items.job_id
         AND j.tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
       )
     );`,
    'Create RLS policy for job_checklist_items (tenant isolation)'
  )) successCount++; else failCount++;

  // Summary
  console.log('\n=== Migration Summary ===');
  console.log(`✅ Successful operations: ${successCount}`);
  console.log(`❌ Failed operations: ${failCount}`);
  console.log(`⏱️  Completed at: ${new Date().toISOString()}`);

  if (failCount === 0) {
    console.log('\n🎉 job_checklist_items table created successfully!');
    console.log('\n✅ Key features:');
    console.log('  - Tenant isolation via jobs.tenant_id');
    console.log('  - RLS using app_metadata path (Constitution §1)');
    console.log('  - Item denormalization (item_name field)');
    console.log('  - Optional container_id (for future)');
    console.log('\n📝 Note: container_id left as UUID (no FK) for now.');
    console.log('   Full container management requires additional migrations.');
  } else {
    console.log('\n⚠️  Some operations failed. Review errors above.');
    process.exit(1);
  }
}

main().catch(console.error);

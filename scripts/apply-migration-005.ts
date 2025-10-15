#!/usr/bin/env tsx
/**
 * Apply migration 005: Create job_checklist_items table and related structures
 * Constitution §8.1 compliant: Single-statement, idempotent operations
 *
 * Purpose: Align live database with code expectations
 * Date: 2025-10-14
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

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
      // Check if error is benign (already exists)
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
  console.log('=== Applying Migration 005: job_checklist_items and related tables ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('');

  let successCount = 0;
  let failCount = 0;

  // Step 1: Create enum types
  console.log('\n📦 Step 1: Create Enum Types');

  if (await executeSql(
    `CREATE TYPE container_type AS ENUM ('truck', 'van', 'trailer', 'storage_bin', 'ground');`,
    'Create container_type enum'
  )) successCount++; else failCount++;

  if (await executeSql(
    `CREATE TYPE container_color AS ENUM ('red', 'black', 'white', 'blue', 'green', 'yellow', 'gray', 'orange', 'silver', 'other');`,
    'Create container_color enum'
  )) successCount++; else failCount++;

  // Step 2: Create containers table
  console.log('\n📦 Step 2: Create containers Table');

  if (await executeSql(
    `CREATE TABLE IF NOT EXISTS containers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      container_type container_type NOT NULL,
      identifier VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      color container_color,
      capacity_info JSONB,
      primary_image_url TEXT,
      additional_image_urls TEXT[],
      is_default BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT container_identifier_unique UNIQUE(company_id, identifier),
      CONSTRAINT container_identifier_format CHECK (identifier ~ '^[A-Z0-9-]+$')
    );`,
    'Create containers table'
  )) successCount++; else failCount++;

  // Step 3: Create inventory_images table
  console.log('\n📦 Step 3: Create inventory_images Table');

  if (await executeSql(
    `CREATE TABLE IF NOT EXISTS inventory_images (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK (item_type IN ('equipment', 'material')),
      item_id UUID NOT NULL,
      image_url TEXT NOT NULL,
      is_primary BOOLEAN DEFAULT false,
      angle TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    'Create inventory_images table'
  )) successCount++; else failCount++;

  // Step 4: Create job_checklist_items table ⭐ CRITICAL
  console.log('\n📦 Step 4: Create job_checklist_items Table ⭐');

  if (await executeSql(
    `CREATE TABLE IF NOT EXISTS job_checklist_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      sequence_number INT NOT NULL,
      item_type TEXT NOT NULL CHECK (item_type IN ('equipment', 'material')),
      item_id UUID NOT NULL,
      item_name TEXT NOT NULL,
      quantity INT DEFAULT 1,
      container_id UUID REFERENCES containers(id),
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'loaded', 'verified', 'missing')),
      vlm_prompt TEXT,
      acceptance_criteria TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT job_checklist_sequence_unique UNIQUE(job_id, sequence_number)
    );`,
    'Create job_checklist_items table'
  )) successCount++; else failCount++;

  // Step 5: Create load_verifications table
  console.log('\n📦 Step 5: Create load_verifications Table');

  if (await executeSql(
    `CREATE TABLE IF NOT EXISTS load_verifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      media_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      detected_containers JSONB DEFAULT '[]'::jsonb,
      detected_items JSONB DEFAULT '[]'::jsonb,
      verified_checklist_items UUID[],
      missing_items UUID[],
      unexpected_items JSONB,
      tokens_used INT,
      cost_usd NUMERIC(18,6),
      processing_time_ms INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    'Create load_verifications table'
  )) successCount++; else failCount++;

  // Step 6: Add column to jobs table
  console.log('\n📦 Step 6: Alter jobs Table');

  if (await executeSql(
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS default_container_id UUID REFERENCES containers(id);`,
    'Add default_container_id to jobs'
  )) successCount++; else failCount++;

  // Step 7: Create indexes
  console.log('\n📦 Step 7: Create Indexes');

  const indexes = [
    { sql: `CREATE INDEX IF NOT EXISTS idx_containers_company_active ON containers(company_id, is_active);`, desc: 'Index: containers by company' },
    { sql: `CREATE INDEX IF NOT EXISTS idx_containers_default ON containers(company_id, is_default) WHERE is_default = true;`, desc: 'Index: default containers' },
    { sql: `CREATE INDEX IF NOT EXISTS idx_inventory_images_item ON inventory_images(item_type, item_id);`, desc: 'Index: inventory images by item' },
    { sql: `CREATE INDEX IF NOT EXISTS idx_job_checklist_items_job ON job_checklist_items(job_id);`, desc: 'Index: checklist items by job' },
    { sql: `CREATE INDEX IF NOT EXISTS idx_job_checklist_items_status ON job_checklist_items(job_id, status);`, desc: 'Index: checklist items by status' },
    { sql: `CREATE INDEX IF NOT EXISTS idx_load_verifications_job ON load_verifications(job_id);`, desc: 'Index: load verifications by job' },
  ];

  for (const { sql, desc } of indexes) {
    if (await executeSql(sql, desc)) successCount++; else failCount++;
  }

  // Step 8: Create function and triggers
  console.log('\n📦 Step 8: Create Triggers');

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
    `DROP TRIGGER IF EXISTS set_updated_at_containers ON containers;
     CREATE TRIGGER set_updated_at_containers
     BEFORE UPDATE ON containers FOR EACH ROW EXECUTE FUNCTION set_updated_at();`,
    'Create trigger for containers'
  )) successCount++; else failCount++;

  if (await executeSql(
    `DROP TRIGGER IF EXISTS set_updated_at_job_checklist_items ON job_checklist_items;
     CREATE TRIGGER set_updated_at_job_checklist_items
     BEFORE UPDATE ON job_checklist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();`,
    'Create trigger for job_checklist_items'
  )) successCount++; else failCount++;

  // Step 9: Enable RLS
  console.log('\n📦 Step 9: Enable Row Level Security');

  const rlsTables = ['containers', 'inventory_images', 'job_checklist_items', 'load_verifications'];
  for (const table of rlsTables) {
    if (await executeSql(
      `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
      `Enable RLS on ${table}`
    )) successCount++; else failCount++;
  }

  // Step 10: Create RLS policies
  console.log('\n📦 Step 10: Create RLS Policies');

  if (await executeSql(
    `DROP POLICY IF EXISTS containers_company_isolation ON containers;
     CREATE POLICY containers_company_isolation ON containers
     FOR ALL TO authenticated
     USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
     WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));`,
    'RLS policy for containers'
  )) successCount++; else failCount++;

  if (await executeSql(
    `DROP POLICY IF EXISTS inventory_images_company_isolation ON inventory_images;
     CREATE POLICY inventory_images_company_isolation ON inventory_images
     FOR ALL TO authenticated
     USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
     WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));`,
    'RLS policy for inventory_images'
  )) successCount++; else failCount++;

  if (await executeSql(
    `DROP POLICY IF EXISTS job_checklist_items_company_isolation ON job_checklist_items;
     CREATE POLICY job_checklist_items_company_isolation ON job_checklist_items
     FOR ALL TO authenticated
     USING (
       EXISTS (
         SELECT 1 FROM jobs j
         JOIN users u ON u.id = auth.uid()
         WHERE j.id = job_checklist_items.job_id
         AND j.company_id = u.company_id
       )
     );`,
    'RLS policy for job_checklist_items'
  )) successCount++; else failCount++;

  if (await executeSql(
    `DROP POLICY IF EXISTS load_verifications_company_isolation ON load_verifications;
     CREATE POLICY load_verifications_company_isolation ON load_verifications
     FOR ALL TO authenticated
     USING (
       EXISTS (
         SELECT 1 FROM jobs j
         JOIN users u ON u.id = auth.uid()
         WHERE j.id = load_verifications.job_id
         AND j.company_id = u.company_id
       )
     );`,
    'RLS policy for load_verifications'
  )) successCount++; else failCount++;

  // Summary
  console.log('\n=== Migration Summary ===');
  console.log(`✅ Successful operations: ${successCount}`);
  console.log(`❌ Failed operations: ${failCount}`);
  console.log(`⏱️  Completed at: ${new Date().toISOString()}`);

  if (failCount === 0) {
    console.log('\n🎉 Migration applied successfully!');
    console.log('\nNext step: Verify job_checklist_items table exists:');
    console.log('  GET /rest/v1/job_checklist_items?limit=1');
  } else {
    console.log('\n⚠️  Some operations failed. Review errors above.');
    process.exit(1);
  }
}

main().catch(console.error);

#!/usr/bin/env npx tsx
/**
 * @file /scripts/migrations/enhance-workflow-tasks.ts
 * @purpose Enhance workflow_tasks table with is_required, is_deleted, template_id columns
 *          Create task_templates and task_template_items tables
 *          Fix RLS policies to use correct JWT path
 * @phase 3.1 - Database Setup & Migration (T001-T006)
 * @constitution Idempotent migrations with IF NOT EXISTS patterns
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

interface MigrationResult {
  step: string;
  success: boolean;
  error?: string;
}

async function executeSql(client: any, sql: string, description: string): Promise<MigrationResult> {
  console.log(`\n🔄 ${description}...`);

  try {
    const { data, error } = await client.rpc('exec_sql', { sql });

    if (error) {
      console.error(`  ❌ Failed: ${error.message}`);
      return {
        step: description,
        success: false,
        error: error.message
      };
    }

    console.log(`  ✅ Success`);
    return {
      step: description,
      success: true
    };
  } catch (err: any) {
    console.error(`  ❌ Exception: ${err.message}`);
    return {
      step: description,
      success: false,
      error: err.message
    };
  }
}

async function checkCurrentSchema(client: any) {
  console.log('\n📊 Checking current workflow_tasks schema...\n');

  try {
    // Get current columns
    const { data: columns, error } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'workflow_tasks'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      console.warn(`⚠️  Could not query schema: ${error.message}`);
      return;
    }

    if (columns && columns.length > 0) {
      console.log(`✅ workflow_tasks exists with ${columns.length} columns:`);
      const columnNames = columns.map((c: any) => c.column_name);

      // Check for columns we need to add
      const hasIsRequired = columnNames.includes('is_required');
      const hasIsDeleted = columnNames.includes('is_deleted');
      const hasTemplateId = columnNames.includes('template_id');

      console.log(`  - is_required: ${hasIsRequired ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`  - is_deleted: ${hasIsDeleted ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`  - template_id: ${hasTemplateId ? '✅ EXISTS' : '❌ MISSING'}`);

      if (hasIsRequired && hasIsDeleted && hasTemplateId) {
        console.log('\n⚠️  All columns already exist - migration may be a no-op');
      }
    }
  } catch (err) {
    console.warn(`⚠️  Schema check failed: ${err}`);
  }
}

async function enhanceWorkflowTasks() {
  console.log('🚀 Starting workflow_tasks enhancement migration\n');
  console.log('='  * 60);

  const client = createClient(supabaseUrl, supabaseServiceKey);
  const results: MigrationResult[] = [];

  // Check current state
  await checkCurrentSchema(client);

  console.log('\n' + '=' * 60);
  console.log('📝 STEP 1: Add columns to workflow_tasks');
  console.log('=' * 60);

  // T001: Add columns to workflow_tasks
  const addColumnsResult = await executeSql(
    client,
    `
      -- Add is_required column
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'workflow_tasks'
          AND column_name = 'is_required'
        ) THEN
          ALTER TABLE workflow_tasks
          ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT true;
        END IF;
      END $$;

      -- Add is_deleted column
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'workflow_tasks'
          AND column_name = 'is_deleted'
        ) THEN
          ALTER TABLE workflow_tasks
          ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$;

      -- Add template_id column (nullable FK, will be added after task_templates created)
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'workflow_tasks'
          AND column_name = 'template_id'
        ) THEN
          ALTER TABLE workflow_tasks
          ADD COLUMN template_id UUID;
        END IF;
      END $$;
    `,
    'Add is_required, is_deleted, template_id columns'
  );
  results.push(addColumnsResult);

  console.log('\n' + '=' * 60);
  console.log('📝 STEP 2: Fix workflow_tasks RLS policy');
  console.log('=' * 60);

  // T002: Fix RLS policy
  const fixRlsResult = await executeSql(
    client,
    `
      -- Drop existing tenant isolation policy if it exists
      DROP POLICY IF EXISTS workflow_tasks_tenant_isolation ON workflow_tasks;
      DROP POLICY IF EXISTS tenant_isolation ON workflow_tasks;

      -- Create correct tenant isolation policy using JWT app_metadata path
      CREATE POLICY workflow_tasks_tenant_isolation ON workflow_tasks
        FOR ALL USING (
          tenant_id::text = (
            current_setting('request.jwt.claims', true)::json
            -> 'app_metadata' ->> 'tenant_id'
          )
        );
    `,
    'Fix RLS policy to use JWT app_metadata path'
  );
  results.push(fixRlsResult);

  console.log('\n' + '=' * 60);
  console.log('📝 STEP 3: Create task_templates table');
  console.log('=' * 60);

  // T003: Create task_templates table
  const createTemplatesResult = await executeSql(
    client,
    `
      CREATE TABLE IF NOT EXISTS task_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        job_type VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT task_templates_name_tenant_unique UNIQUE(tenant_id, name)
      );

      -- Create indexes for task_templates
      CREATE INDEX IF NOT EXISTS idx_task_templates_tenant_active
        ON task_templates(tenant_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_task_templates_job_type
        ON task_templates(job_type) WHERE job_type IS NOT NULL;

      -- Enable RLS
      ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

      -- Drop existing policy if any
      DROP POLICY IF EXISTS task_templates_tenant_isolation ON task_templates;

      -- Create tenant isolation policy
      CREATE POLICY task_templates_tenant_isolation ON task_templates
        FOR ALL USING (
          tenant_id::text = (
            current_setting('request.jwt.claims', true)::json
            -> 'app_metadata' ->> 'tenant_id'
          )
        );
    `,
    'Create task_templates table with RLS'
  );
  results.push(createTemplatesResult);

  console.log('\n' + '=' * 60);
  console.log('📝 STEP 4: Create task_template_items table');
  console.log('=' * 60);

  // T004: Create task_template_items table
  const createTemplateItemsResult = await executeSql(
    client,
    `
      CREATE TABLE IF NOT EXISTS task_template_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
        task_order INTEGER NOT NULL DEFAULT 0,
        task_description TEXT NOT NULL,
        is_required BOOLEAN NOT NULL DEFAULT true,
        requires_photo_verification BOOLEAN NOT NULL DEFAULT false,
        requires_supervisor_approval BOOLEAN NOT NULL DEFAULT false,
        acceptance_criteria TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT task_template_items_order_unique UNIQUE(template_id, task_order)
      );

      -- Create index
      CREATE INDEX IF NOT EXISTS idx_task_template_items_template_order
        ON task_template_items(template_id, task_order);

      -- Enable RLS
      ALTER TABLE task_template_items ENABLE ROW LEVEL SECURITY;

      -- Drop existing policy if any
      DROP POLICY IF EXISTS task_template_items_tenant_isolation ON task_template_items;

      -- Create tenant isolation policy via template
      CREATE POLICY task_template_items_tenant_isolation ON task_template_items
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM task_templates
            WHERE task_templates.id = task_template_items.template_id
            AND task_templates.tenant_id::text = (
              current_setting('request.jwt.claims', true)::json
              -> 'app_metadata' ->> 'tenant_id'
            )
          )
        );
    `,
    'Create task_template_items table with RLS'
  );
  results.push(createTemplateItemsResult);

  console.log('\n' + '=' * 60);
  console.log('📝 STEP 5: Add FK constraint and performance indexes');
  console.log('=' * 60);

  // T005: Add FK constraint and indexes
  const addIndexesResult = await executeSql(
    client,
    `
      -- Add FK constraint from workflow_tasks to task_templates
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workflow_tasks_template_id_fkey'
          AND table_name = 'workflow_tasks'
        ) THEN
          ALTER TABLE workflow_tasks
          ADD CONSTRAINT workflow_tasks_template_id_fkey
          FOREIGN KEY (template_id) REFERENCES task_templates(id);
        END IF;
      END $$;

      -- Create performance indexes
      CREATE INDEX IF NOT EXISTS idx_workflow_tasks_job_order
        ON workflow_tasks(job_id, task_order);

      CREATE INDEX IF NOT EXISTS idx_workflow_tasks_required
        ON workflow_tasks(job_id, is_required)
        WHERE is_deleted = false;

      CREATE INDEX IF NOT EXISTS idx_workflow_tasks_template
        ON workflow_tasks(template_id)
        WHERE template_id IS NOT NULL;
    `,
    'Add FK constraint and performance indexes'
  );
  results.push(addIndexesResult);

  console.log('\n' + '=' * 60);
  console.log('📊 MIGRATION SUMMARY');
  console.log('=' * 60 + '\n');

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.step}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n${successCount}/${results.length} steps completed successfully`);

  if (failureCount > 0) {
    console.error(`\n❌ Migration completed with ${failureCount} errors`);
    console.error('   Please review errors above and fix manually if needed');
    process.exit(1);
  }

  console.log('\n✅ Migration completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Run: npm run generate:types');
  console.log('   2. Verify: workflow_tasks has 24 columns');
  console.log('   3. Verify: task_templates and task_template_items exist');
  console.log('   4. Run: npm run test:rls (when available)');
}

// Execute migration
if (require.main === module) {
  enhanceWorkflowTasks().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}

export { enhanceWorkflowTasks };

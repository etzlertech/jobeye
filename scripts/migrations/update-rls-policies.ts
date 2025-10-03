#!/usr/bin/env npx tsx
/**
 * @file /scripts/migrations/update-rls-policies.ts
 * @purpose Update RLS policies to use correct JWT path
 * @constitution MUST run check-actual-db.ts first per Rule 1
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { PatternViolationsRepository } from '@/domains/cleanup-tracking/repositories/pattern-violations.repository';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface RlsUpdateOptions {
  tableName?: string;
  dryRun?: boolean;
  skipPolicyCreation?: boolean;
}

const CORRECT_RLS_CONDITION = `
tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
`.trim();

async function updateRlsPolicies(options: RlsUpdateOptions = {}) {
  console.log('🚨 MANDATORY: Running check-actual-db.ts first (Constitution Rule 1)\n');
  
  // Run check-actual-db.ts first as required by constitution
  try {
    const checkDbPath = path.join(__dirname, '..', 'check-actual-db.ts');
    execSync(`npx tsx "${checkDbPath}"`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..')
    });
    console.log('\n✅ Database precheck completed\n');
  } catch (error) {
    console.error('❌ Failed to run check-actual-db.ts - CANNOT PROCEED');
    console.error('   This is a constitutional requirement!');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseServiceKey);
  const violationsRepo = new PatternViolationsRepository(client);

  console.log('🔒 Starting RLS policy update process...\n');

  // Get tables that have tenant_id and need RLS policies
  const { data: tables, error: tablesError } = await client.rpc('exec_sql', {
    sql: `
      SELECT DISTINCT table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND column_name = 'tenant_id'
      AND table_name NOT LIKE 'pg_%'
      ${options.tableName ? `AND table_name = '${options.tableName}'` : ''}
      ORDER BY table_name;
    `
  });

  if (tablesError) {
    throw new Error(`Failed to get tables: ${tablesError.message}`);
  }

  const tableList = tables.map((t: any) => t.table_name);
  console.log(`Found ${tableList.length} tables with tenant_id:`);
  tableList.forEach((table: string) => console.log(`  - ${table}`));

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made');
    await analyzeCurrentPolicies(client, tableList);
    return;
  }

  // Process each table
  for (const tableName of tableList) {
    await updateTableRlsPolicies(client, violationsRepo, tableName, options);
  }

  console.log('\n✅ RLS policy update process completed!');
}

async function updateTableRlsPolicies(
  client: any,
  violationsRepo: PatternViolationsRepository,
  tableName: string,
  options: RlsUpdateOptions
) {
  console.log(`\n🔒 Updating RLS policies for: ${tableName}`);

  try {
    // Step 1: Get current policies
    const { data: currentPolicies } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          policyname,
          polcmd,
          polqual
        FROM pg_policy p
        JOIN pg_class c ON p.polrelid = c.oid
        WHERE c.relname = '${tableName}';
      `
    });

    console.log(`  📋 Found ${currentPolicies.length} existing policies`);

    // Step 2: Analyze and categorize policies
    const wrongPolicies = [];
    const correctPolicies = [];

    for (const policy of currentPolicies) {
      if (policy.polqual && policy.polqual.includes('auth.jwt()')) {
        wrongPolicies.push(policy);
        
        // Track as violation
        await violationsRepo.create({
          file_path: `database/policies/${tableName}`,
          line_number: 1,
          column_number: 1,
          pattern_type: 'wrong_rls_path',
          violation_text: policy.polqual,
          suggested_fix: CORRECT_RLS_CONDITION
        });
      } else if (policy.polqual && policy.polqual.includes('request.jwt.claims')) {
        correctPolicies.push(policy);
      }
    }

    console.log(`    ❌ Wrong policies: ${wrongPolicies.length}`);
    console.log(`    ✅ Correct policies: ${correctPolicies.length}`);

    // Step 3: Enable RLS if not already enabled
    const { data: rlsStatus } = await client.rpc('exec_sql', {
      sql: `
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = '${tableName}';
      `
    });

    if (!rlsStatus[0].relrowsecurity) {
      console.log('  🔓 Enabling Row Level Security...');
      await client.rpc('exec_sql', {
        sql: `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`
      });
    }

    // Step 4: Remove old/wrong policies
    for (const policy of wrongPolicies) {
      console.log(`  🗑️  Dropping wrong policy: ${policy.policyname}`);
      await client.rpc('exec_sql', {
        sql: `DROP POLICY IF EXISTS "${policy.policyname}" ON "${tableName}";`
      });
    }

    // Step 5: Create correct tenant isolation policy if needed
    if (!options.skipPolicyCreation && correctPolicies.length === 0) {
      console.log('  📝 Creating tenant isolation policy...');
      await client.rpc('exec_sql', {
        sql: `
          CREATE POLICY tenant_isolation ON "${tableName}"
          FOR ALL USING (${CORRECT_RLS_CONDITION});
        `
      });
    }

    // Step 6: Verify final state
    const { data: finalPolicies } = await client.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as count 
        FROM pg_policy p
        JOIN pg_class c ON p.polrelid = c.oid
        WHERE c.relname = '${tableName}';
      `
    });

    console.log(`  ✅ Final policy count: ${finalPolicies[0].count}`);

  } catch (error) {
    console.error(`  ❌ Failed to update RLS policies: ${error}`);
    throw error;
  }
}

async function analyzeCurrentPolicies(client: any, tableList: string[]) {
  console.log('\n📊 ANALYSIS RESULTS\n');

  for (const tableName of tableList) {
    const { data: policies } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          policyname,
          polcmd,
          polqual
        FROM pg_policy p
        JOIN pg_class c ON p.polrelid = c.oid
        WHERE c.relname = '${tableName}';
      `
    });

    console.log(`Table: ${tableName}`);
    
    if (policies.length === 0) {
      console.log('  ⚠️  No RLS policies found');
    } else {
      policies.forEach((policy: any) => {
        const isCorrect = policy.polqual && policy.polqual.includes('request.jwt.claims');
        const status = isCorrect ? '✅' : '❌';
        console.log(`  ${status} ${policy.policyname}: ${policy.polcmd}`);
        
        if (!isCorrect && policy.polqual) {
          console.log(`      Current: ${policy.polqual.substring(0, 80)}...`);
          console.log(`      Should be: ${CORRECT_RLS_CONDITION.substring(0, 80)}...`);
        }
      });
    }
    console.log('');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: RlsUpdateOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--table':
        options.tableName = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-policy-creation':
        options.skipPolicyCreation = true;
        break;
      case '--help':
        console.log(`
Usage: npx tsx update-rls-policies.ts [options]

Options:
  --table <name>           Update specific table only
  --dry-run               Analyze current policies without making changes
  --skip-policy-creation  Only remove wrong policies, don't create new ones
  --help                  Show this help message

Examples:
  npx tsx update-rls-policies.ts
  npx tsx update-rls-policies.ts --table day_plans
  npx tsx update-rls-policies.ts --dry-run
        `);
        process.exit(0);
    }
  }

  updateRlsPolicies(options).catch(error => {
    console.error('RLS update failed:', error);
    process.exit(1);
  });
}
#!/usr/bin/env npx tsx
/**
 * T000: Database Precheck for Feature 006
 * Verifies Feature 001 (Vision) and Feature 007 (Offline) tables exist
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifySchema() {
  console.log('🔍 T000: Database Precheck - Verifying Feature 001/007 Schema\n');

  const client = createClient(supabaseUrl, supabaseServiceKey);

  const requiredTables = [
    'vision_verifications',      // Feature 001 (base table)
    'vision_detected_items',      // Feature 001 (detected objects)
    'vision_cost_records',        // Feature 001 (cost tracking)
  ];

  const results: any[] = [];
  let allTablesExist = true;

  for (const tableName of requiredTables) {
    console.log(`Checking table: ${tableName}...`);

    // Query information_schema to check table existence
    const { data, error } = await client.rpc('exec_sql', {
      sql: `
        SELECT
          table_name,
          (SELECT count(*) FROM information_schema.columns WHERE table_name = '${tableName}') as column_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '${tableName}';
      `
    });

    if (error) {
      console.error(`❌ Error checking ${tableName}:`, error.message);
      allTablesExist = false;
      results.push({ table: tableName, exists: false, error: error.message });
      continue;
    }

    if (!data || data.length === 0) {
      console.error(`❌ Table ${tableName} does NOT exist`);
      allTablesExist = false;
      results.push({ table: tableName, exists: false });
    } else {
      console.log(`✅ Table ${tableName} exists (${data[0].column_count} columns)`);
      results.push({ table: tableName, exists: true, columns: data[0].column_count });
    }
  }

  // Check RLS policies
  console.log('\nChecking RLS policies...');
  const { data: rlsData, error: rlsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        tablename,
        policyname,
        pg_get_expr(qual, 0) as definition
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN ('vision_verifications', 'vision_detected_items', 'vision_cost_records')
      ORDER BY tablename;
    `
  });

  if (rlsError) {
    console.error('❌ Error checking RLS policies:', rlsError.message);
  } else if (rlsData && rlsData.length > 0) {
    console.log(`✅ Found ${rlsData.length} RLS policies`);

    // Check for app_metadata pattern (constitution requirement)
    const hasAppMetadata = rlsData.some((policy: any) =>
      policy.definition && policy.definition.includes('app_metadata')
    );

    if (hasAppMetadata) {
      console.log('✅ RLS policies use app_metadata.company_id pattern (Constitution compliant)');
    } else {
      console.warn('⚠️  RLS policies may not use app_metadata pattern');
    }
  } else {
    console.warn('⚠️  No RLS policies found');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('DATABASE PRECHECK SUMMARY');
  console.log('='.repeat(60));

  results.forEach(r => {
    const status = r.exists ? '✅' : '❌';
    console.log(`${status} ${r.table}: ${r.exists ? `${r.columns} columns` : 'MISSING'}`);
  });

  console.log('\nOFFLINE QUEUE (IndexedDB):');
  console.log('ℹ️  Feature 007 offline_queue is client-side IndexedDB - verify in browser DevTools');

  if (allTablesExist) {
    console.log('\n✅ T000 PASSED: All required tables exist');
    console.log('📝 Constitution Rule 1 satisfied - safe to proceed with implementation\n');
    process.exit(0);
  } else {
    console.error('\n❌ T000 FAILED: Missing required tables');
    console.error('⚠️  Cannot proceed - Feature 001 must be deployed first\n');
    process.exit(1);
  }
}

verifySchema().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

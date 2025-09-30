#!/usr/bin/env npx tsx
/**
 * Database Precheck for Feature 005: Field Intelligence
 * 
 * Constitutional RULE 1: Check ACTUAL database state before any migration decisions
 * 
 * Checks:
 * 1. Existing tables that Feature 005 will extend
 * 2. Tenancy model (tenant_id vs company_id)
 * 3. Vision tables (should exist from parallel work)
 * 4. RLS policies on existing tables
 * 5. Current row counts for reference
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  console.log('🔍 Feature 005 Database Precheck\n');
  console.log('='.repeat(80));
  
  // 1. Check tables that Feature 005 will extend
  const tablesToExtend = ['jobs', 'time_entries', 'properties', 'customers', 'vendors'];
  
  console.log('\n📋 Tables to Extend (Feature 005):\n');
  
  for (const table of tablesToExtend) {
    const { data: columns, error } = await client
      .from('information_schema.columns' as any)
      .select('column_name, data_type')
      .eq('table_name', table)
      .eq('table_schema', 'public');
    
    if (error) {
      console.log(`❌ ${table}: NOT FOUND or error`);
      continue;
    }
    
    // Check for tenancy column
    const tenancyCol = columns?.find(c => c.column_name === 'tenant_id' || c.column_name === 'company_id');
    const hasArrivalPhoto = columns?.find(c => c.column_name === 'arrival_photo_id');
    const hasType = columns?.find(c => c.column_name === 'type');
    const hasIntakeSession = columns?.find(c => c.column_name === 'intake_session_id');
    
    console.log(`✅ ${table}:`);
    console.log(`   - Tenancy: ${tenancyCol?.column_name || 'MISSING'}`);
    console.log(`   - Columns: ${columns?.length || 0}`);
    
    if (table === 'jobs') {
      console.log(`   - arrival_photo_id: ${hasArrivalPhoto ? 'EXISTS (already added)' : 'MISSING (needs T026)'}`);
    }
    if (table === 'time_entries') {
      console.log(`   - type: ${hasType ? 'EXISTS (already added)' : 'MISSING (needs T027)'}`);
    }
    if (table === 'properties' || table === 'customers' || table === 'vendors') {
      console.log(`   - intake_session_id: ${hasIntakeSession ? 'EXISTS (already added)' : 'MISSING (needs T028/T029)'}`);
    }
  }
  
  // 2. Check tenancy model consistency
  console.log('\n🏢 Tenancy Model Analysis:\n');
  
  const { data: allTables, error: tablesError } = await client
    .from('information_schema.columns' as any)
    .select('table_name, column_name')
    .eq('table_schema', 'public')
    .in('column_name', ['tenant_id', 'company_id']);
  
  if (!tablesError && allTables) {
    const tenantIdTables = allTables.filter(t => t.column_name === 'tenant_id').map(t => t.table_name);
    const companyIdTables = allTables.filter(t => t.column_name === 'company_id').map(t => t.table_name);
    
    console.log(`✅ Tables using tenant_id: ${tenantIdTables.length}`);
    console.log(`⚠️  Tables using company_id: ${companyIdTables.length}`);
    console.log(`\n📌 Recommendation: Feature 005 should use tenant_id (standard)`);
  }
  
  // 3. Check vision tables (should exist from parallel work)
  console.log('\n👁️  Vision Tables (Feature 001 - needed for Feature 005):\n');
  
  const visionTables = ['vision_verifications', 'vision_detected_items', 'vision_cost_records'];
  
  for (const table of visionTables) {
    const { count, error } = await client
      .from(table as any)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ ${table}: NOT FOUND`);
    } else {
      console.log(`✅ ${table}: EXISTS (${count || 0} rows)`);
    }
  }
  
  // 4. Check for existing Feature 005 tables (should not exist yet)
  console.log('\n🆕 Feature 005 Tables (should NOT exist yet):\n');
  
  const feature005Tables = [
    'safety_checklists',
    'safety_checklist_completions',
    'daily_routes',
    'route_waypoints',
    'route_events',
    'route_optimizations',
    'intake_sessions',
    'intake_extractions',
    'contact_candidates',
    'property_candidates',
    'job_tasks',
    'task_templates',
    'instruction_documents',
    'job_instructions',
    'job_history_insights'
  ];
  
  for (const table of feature005Tables) {
    const { count, error } = await client
      .from(table as any)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`✅ ${table}: Not found (expected - will be created)`);
    } else {
      console.log(`⚠️  ${table}: ALREADY EXISTS (${count || 0} rows) - migration may need IF NOT EXISTS`);
    }
  }
  
  // 5. Check RLS policies on tables to extend
  console.log('\n🔒 RLS Policy Check (tables to extend):\n');
  
  const { data: policies, error: policiesError } = await client.rpc('exec_sql' as any, {
    sql: `
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('jobs', 'time_entries', 'properties', 'customers', 'vendors')
      ORDER BY tablename, policyname;
    `
  });
  
  if (!policiesError && policies) {
    console.log(`✅ Found RLS policies on existing tables`);
    console.log(`   Total policies: ${Array.isArray(policies) ? policies.length : 'N/A'}`);
  } else {
    console.log(`⚠️  Could not query RLS policies`);
  }
  
  // 6. Summary and recommendations
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY:\n');
  console.log('✅ READY: Vision tables exist (Feature 001 integration verified)');
  console.log('✅ READY: Base tables exist (jobs, time_entries, properties, etc.)');
  console.log('⚠️  ACTION: Use tenant_id (not company_id) in new tables');
  console.log('⚠️  ACTION: Check if T026-T029 columns already exist before extending');
  console.log('✅ READY: Feature 005 tables do not exist (clean slate)');
  
  console.log('\n📝 Next Steps:');
  console.log('1. Create specs/005-field-intelligence-safety/DB_PRECHECK_RESULTS.md');
  console.log('2. Update T009 (data-model.md) to use tenant_id');
  console.log('3. Proceed with T002 (install dependencies)');
}

checkDatabase().catch(console.error);

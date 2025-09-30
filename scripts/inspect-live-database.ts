#!/usr/bin/env npx tsx
/**
 * Live Database Inspector
 * Uses direct Supabase queries to inspect schema
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function inspectDatabase() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Inspecting Live Database via Direct Queries...\n');

  const results: any = {
    tables: [],
    tenancyAnalysis: {},
    missingTenancy: [],
    foreignKeys: {},
    rlsStatus: {},
    tableSizes: {}
  };

  // Known tables from codebase analysis
  const knownTables = [
    'tenants', 'companies', 'users_extended',
    'customers', 'properties', 'equipment', 'containers',
    'jobs', 'job_templates', 'job_phases', 'job_tasks',
    'kits', 'kit_items', 'kit_variants',
    'inventory_items', 'inventory_transactions', 'container_assignments',
    'material_catalog', 'purchase_receipts', 'training_data',
    'irrigation_systems', 'irrigation_zones',
    'voice_sessions', 'voice_transcripts', 'voice_commands',
    'vision_verifications', 'vision_detected_items', 'vision_cost_records',
    'media_assets', 'offline_queue'
  ];

  console.log('📊 Checking tables...\n');

  for (const tableName of knownTables) {
    try {
      // Try to query table structure
      const { data, error, count } = await client
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`  ❌ ${tableName}: ${error.message}`);
        continue;
      }

      console.log(`  ✅ ${tableName}: ${count || 0} rows`);

      results.tables.push(tableName);
      results.tableSizes[tableName] = count || 0;

      // Check for tenancy columns
      let hasTenantId = false;
      let hasCompanyId = false;

      try {
        await client.from(tableName).select('tenant_id').limit(0);
        hasTenantId = true;
      } catch (e) {}

      try {
        await client.from(tableName).select('company_id').limit(0);
        hasCompanyId = true;
      } catch (e) {}

      if (hasTenantId || hasCompanyId) {
        results.tenancyAnalysis[tableName] = {
          tenant_id: hasTenantId,
          company_id: hasCompanyId
        };
      } else if (!['tenants', 'users_extended'].includes(tableName)) {
        results.missingTenancy.push(tableName);
      }

    } catch (err: any) {
      console.log(`  ⚠️  ${tableName}: ${err.message}`);
    }
  }

  // Check for key foreign key relationships
  console.log('\n🔗 Checking key relationships...\n');

  const relationshipChecks = [
    { table: 'jobs', fk: 'tenant_id', references: 'tenants' },
    { table: 'containers', fk: 'tenant_id', references: 'tenants' },
    { table: 'kits', fk: 'tenant_id', references: 'tenants' },
    { table: 'vision_verifications', fk: 'tenant_id', references: 'tenants' },
    { table: 'vision_detected_items', fk: 'verification_id', references: 'vision_verifications' },
    { table: 'vision_cost_records', fk: 'verification_id', references: 'vision_verifications' },
  ];

  for (const check of relationshipChecks) {
    try {
      const { data, error } = await client
        .from(check.table)
        .select(check.fk)
        .limit(1);

      if (!error && data) {
        console.log(`  ✅ ${check.table}.${check.fk} → ${check.references}`);
        if (!results.foreignKeys[check.table]) {
          results.foreignKeys[check.table] = [];
        }
        results.foreignKeys[check.table].push({
          column: check.fk,
          references: check.references
        });
      }
    } catch (e) {
      console.log(`  ⚠️  ${check.table}.${check.fk} → ${check.references}: Cannot verify`);
    }
  }

  // Write results
  fs.writeFileSync(
    'live-database-inspection.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n\n📊 SUMMARY\n');
  console.log(`✅ Tables Found: ${results.tables.length}`);
  console.log(`🔑 Tables with tenant_id: ${Object.values(results.tenancyAnalysis).filter((t: any) => t.tenant_id).length}`);
  console.log(`🏢 Tables with company_id: ${Object.values(results.tenancyAnalysis).filter((t: any) => t.company_id).length}`);
  console.log(`⚠️  Tables missing tenancy: ${results.missingTenancy.length}`);
  console.log(`\n✅ Inspection saved to live-database-inspection.json\n`);

  return results;
}

inspectDatabase().catch(console.error);
#!/usr/bin/env npx tsx
/**
 * Comprehensive Test Suite for All Changes
 * Validates database migrations, repository code, and schema consistency
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
  results.push({ name, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️ ';
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details)}`);
  }
}

async function testDatabaseMigrations() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n🔍 Testing Database Migrations...\n');

  // Test 1: kit_items uses tenant_id
  try {
    const { data, error } = await client
      .from('kit_items')
      .select('id, tenant_id')
      .limit(1);

    if (error) {
      logTest('kit_items.tenant_id', 'FAIL', error.message);
    } else {
      logTest('kit_items.tenant_id', 'PASS', `Column exists, ${data?.length || 0} rows verified`);
    }
  } catch (e: any) {
    logTest('kit_items.tenant_id', 'FAIL', e.message);
  }

  // Test 2: kit_items does NOT have company_id
  try {
    const { error } = await client
      .from('kit_items')
      .select('company_id')
      .limit(1);

    if (error && error.message.includes('company_id')) {
      logTest('kit_items.company_id removed', 'PASS', 'Column successfully removed');
    } else {
      logTest('kit_items.company_id removed', 'FAIL', 'Column still exists!');
    }
  } catch (e) {
    logTest('kit_items.company_id removed', 'PASS', 'Column does not exist (as expected)');
  }

  // Test 3: customers does NOT have company_id
  try {
    const { error } = await client
      .from('customers')
      .select('company_id')
      .limit(1);

    if (error && error.message.includes('company_id')) {
      logTest('customers.company_id removed', 'PASS', 'Column successfully removed');
    } else {
      logTest('customers.company_id removed', 'FAIL', 'Column still exists!');
    }
  } catch (e) {
    logTest('customers.company_id removed', 'PASS', 'Column does not exist (as expected)');
  }

  // Test 4: containers uses tenant_id
  try {
    const { data, error } = await client
      .from('containers')
      .select('id, tenant_id')
      .limit(1);

    if (!error) {
      logTest('containers.tenant_id', 'PASS', 'Column accessible');
    } else {
      logTest('containers.tenant_id', 'FAIL', error.message);
    }
  } catch (e: any) {
    logTest('containers.tenant_id', 'FAIL', e.message);
  }

  // Test 5: inventory_items uses tenant_id
  try {
    const { data, error } = await client
      .from('inventory_items')
      .select('id, tenant_id')
      .limit(1);

    if (!error) {
      logTest('inventory_items.tenant_id', 'PASS', 'Column accessible');
    } else {
      logTest('inventory_items.tenant_id', 'FAIL', error.message);
    }
  } catch (e: any) {
    logTest('inventory_items.tenant_id', 'FAIL', e.message);
  }

  // Test 6: vision_cost_records uses tenant_id
  try {
    const { data, error } = await client
      .from('vision_cost_records')
      .select('id, tenant_id')
      .limit(1);

    if (!error) {
      logTest('vision_cost_records.tenant_id', 'PASS', 'Column accessible');
    } else {
      logTest('vision_cost_records.tenant_id', 'FAIL', error.message);
    }
  } catch (e: any) {
    logTest('vision_cost_records.tenant_id', 'FAIL', e.message);
  }

  // Test 7: kits uses tenant_id
  try {
    const { data, error } = await client
      .from('kits')
      .select('id, tenant_id')
      .limit(1);

    if (!error) {
      logTest('kits.tenant_id', 'PASS', 'Column accessible');
    } else {
      logTest('kits.tenant_id', 'FAIL', error.message);
    }
  } catch (e: any) {
    logTest('kits.tenant_id', 'FAIL', e.message);
  }

  // Test 8: vision_detected_items exists (from earlier migration)
  try {
    const { error } = await client
      .from('vision_detected_items')
      .select('id')
      .limit(0);

    if (!error) {
      logTest('vision_detected_items table', 'PASS', 'Table exists');
    } else {
      logTest('vision_detected_items table', 'FAIL', error.message);
    }
  } catch (e: any) {
    logTest('vision_detected_items table', 'FAIL', e.message);
  }
}

async function testRepositoryFiles() {
  console.log('\n📁 Testing Repository Files...\n');

  const reposToCheck = [
    'src/domains/repos/scheduling-kits/kit-repository.ts',
    'src/domains/repos/scheduling-kits/kit-variant-repository.ts',
    'src/domains/repos/scheduling-kits/kit-assignment-repository.ts',
    'src/domains/repos/scheduling-kits/kit-override-log-repository.ts',
  ];

  for (const repo of reposToCheck) {
    if (fs.existsSync(repo)) {
      const content = fs.readFileSync(repo, 'utf-8');

      // Check for company_id in queries
      const hasCompanyIdInQueries = /\.eq\(['"]company_id['"]/.test(content);
      if (hasCompanyIdInQueries) {
        logTest(`${repo} - No company_id queries`, 'FAIL', 'Found .eq(company_id in queries');
      } else {
        logTest(`${repo} - No company_id queries`, 'PASS', 'No company_id in queries');
      }

      // Check for tenant_id usage
      const hasTenantId = content.includes('tenant_id');
      if (hasTenantId) {
        logTest(`${repo} - Uses tenant_id`, 'PASS', 'tenant_id found in code');
      } else {
        logTest(`${repo} - Uses tenant_id`, 'SKIP', 'No tenant_id usage (may be OK)');
      }
    } else {
      logTest(`${repo} - File exists`, 'FAIL', 'File not found');
    }
  }

  // Check equipment/container-repository.ts
  const containerRepo = 'src/domains/equipment/repositories/container-repository.ts';
  if (fs.existsSync(containerRepo)) {
    const content = fs.readFileSync(containerRepo, 'utf-8');

    const hasCompanyIdInQueries = /\.eq\(['"]company_id['"]/.test(content);
    if (hasCompanyIdInQueries) {
      logTest(`${containerRepo} - No company_id queries`, 'FAIL', 'Found .eq(company_id in queries');
    } else {
      logTest(`${containerRepo} - No company_id queries`, 'PASS', 'No company_id in queries');
    }

    const hasTenantId = /\.eq\(['"]tenant_id['"]/.test(content);
    if (hasTenantId) {
      logTest(`${containerRepo} - Uses tenant_id`, 'PASS', 'Uses tenant_id in queries');
    } else {
      logTest(`${containerRepo} - Uses tenant_id`, 'FAIL', 'No tenant_id in queries');
    }
  }
}

async function testSchemaConsistency() {
  console.log('\n🔍 Testing Schema Consistency...\n');

  const client = createClient(supabaseUrl, supabaseServiceKey);

  const tablesToCheck = [
    'jobs', 'containers', 'kits', 'kit_items', 'kit_variants',
    'inventory_items', 'vision_verifications', 'vision_cost_records',
    'properties', 'equipment'
  ];

  let totalTenantId = 0;
  let totalCompanyId = 0;

  for (const table of tablesToCheck) {
    let hasTenantId = false;
    let hasCompanyId = false;

    // Use actual data query (limit 1, not 0) to properly detect column existence
    try {
      const { error } = await client.from(table).select('tenant_id').limit(1);
      hasTenantId = !error;
      if (hasTenantId) totalTenantId++;
    } catch (e) {}

    try {
      const { error } = await client.from(table).select('company_id').limit(1);
      hasCompanyId = !error;
      if (hasCompanyId) totalCompanyId++;
    } catch (e) {}

    if (hasTenantId && !hasCompanyId) {
      logTest(`${table} tenancy`, 'PASS', 'Uses tenant_id only');
    } else if (!hasTenantId && hasCompanyId) {
      logTest(`${table} tenancy`, 'FAIL', 'Still uses company_id!');
    } else if (hasTenantId && hasCompanyId) {
      logTest(`${table} tenancy`, 'FAIL', 'Has BOTH tenant_id and company_id!');
    } else {
      logTest(`${table} tenancy`, 'SKIP', 'No tenancy columns (may be root table)');
    }
  }

  console.log(`\n📊 Summary: ${totalTenantId} tables with tenant_id, ${totalCompanyId} tables with company_id\n`);
}

async function generateReport() {
  console.log('\n\n📊 TEST REPORT\n');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`\nSuccess Rate: ${((passed / (results.length - skipped)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:\n');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  }

  // Write detailed report
  fs.writeFileSync(
    'TEST_RESULTS_2025-09-30.json',
    JSON.stringify({ results, summary: { passed, failed, skipped } }, null, 2)
  );

  console.log('\n✅ Detailed results saved to TEST_RESULTS_2025-09-30.json\n');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!\n');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Review results above\n');
    process.exit(1);
  }
}

async function main() {
  console.log('🧪 Starting Comprehensive Test Suite...\n');
  console.log('Testing all database migrations and code changes\n');

  await testDatabaseMigrations();
  await testRepositoryFiles();
  await testSchemaConsistency();
  await generateReport();
}

main().catch(console.error);
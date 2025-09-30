#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function analyzeDatabase() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  const existingTables = [
    'tenants', 'companies', 'users_extended', 'customers', 'properties', 
    'equipment', 'materials', 'job_templates', 'jobs', 'voice_sessions',
    'media_assets', 'kits', 'kit_variants', 'kit_assignments',
    'vision_verifications', 'inventory_items', 'containers', 
    'inventory_transactions', 'offline_queue', 'material_requests', 
    'customer_feedback', 'maintenance_tickets', 'invoices', 'travel_logs', 
    'audit_logs', 'job_reschedules'
  ];

  console.log('🔍 Analyzing database structure...\n');

  // Check for tables with company_id vs tenant_id
  const tenancyReport: any = {
    hasCompanyId: [],
    hasTenantId: [],
    hasBoth: [],
    hasNeither: []
  };

  for (const table of existingTables) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .limit(0);

    if (!error && data !== null) {
      // Try to detect columns by attempting inserts (will fail but show us column names)
      const testInsert = await client
        .from(table)
        .insert({})
        .select();

      const errorMsg = testInsert.error?.message || '';
      
      const hasCompanyId = errorMsg.includes('company_id') || errorMsg.includes('"company_id"');
      const hasTenantId = errorMsg.includes('tenant_id') || errorMsg.includes('"tenant_id"');

      if (hasCompanyId && hasTenantId) {
        tenancyReport.hasBoth.push(table);
      } else if (hasCompanyId) {
        tenancyReport.hasCompanyId.push(table);
      } else if (hasTenantId) {
        tenancyReport.hasTenantId.push(table);
      } else {
        tenancyReport.hasNeither.push(table);
      }
    }
  }

  console.log('📊 TENANCY COLUMN ANALYSIS\n');
  console.log('='.repeat(60));
  console.log('\nTables with BOTH company_id AND tenant_id:');
  tenancyReport.hasBoth.forEach((t: string) => console.log(`  - ${t}`));
  
  console.log('\nTables with company_id ONLY:');
  tenancyReport.hasCompanyId.forEach((t: string) => console.log(`  - ${t}`));
  
  console.log('\nTables with tenant_id ONLY:');
  tenancyReport.hasTenantId.forEach((t: string) => console.log(`  - ${t}`));
  
  console.log('\nTables with NEITHER:');
  tenancyReport.hasNeither.forEach((t: string) => console.log(`  - ${t}`));

  // Check for duplicate/redundant tables
  console.log('\n\n📦 CONTAINER/EQUIPMENT ANALYSIS\n');
  console.log('='.repeat(60));
  
  const { count: equipmentCount } = await client
    .from('equipment')
    .select('*', { count: 'exact', head: true });
  
  const { count: containersCount } = await client
    .from('containers')
    .select('*', { count: 'exact', head: true });

  console.log(`Equipment table: ${equipmentCount} rows`);
  console.log(`Containers table: ${containersCount} rows`);
  console.log('⚠️  Note: These may overlap in functionality');

  // Check inventory items
  const { count: inventoryCount } = await client
    .from('inventory_items')
    .select('*', { count: 'exact', head: true });

  console.log(`Inventory Items table: ${inventoryCount} rows`);
  console.log('⚠️  May overlap with equipment tracking');

  console.log('\n\n✅ Analysis complete');
}

analyzeDatabase().catch(console.error);

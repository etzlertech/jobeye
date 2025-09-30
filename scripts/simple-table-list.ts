#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function listTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  // Try direct table query
  const { data, error } = await client
    .from('jobs')
    .select('count')
    .limit(0);

  if (error) {
    console.log('Jobs table check:', error.message);
  } else {
    console.log('✅ Jobs table accessible');
  }

  // Try customers
  const { data: customers, error: custError } = await client
    .from('customers')
    .select('count')
    .limit(0);

  if (custError) {
    console.log('Customers table check:', custError.message);
  } else {
    console.log('✅ Customers table accessible');
  }

  // List some key tables to verify
  const tablesToCheck = [
    'tenants', 'companies', 'users_extended', 'properties', 
    'equipment', 'materials', 'job_templates', 'voice_sessions',
    'media_assets', 'kits', 'kit_variants', 'kit_assignments',
    'vision_verifications', 'vision_detected_items', 'vision_cost_records',
    'inventory_items', 'containers', 'inventory_transactions',
    'offline_queue', 'material_requests', 'customer_feedback',
    'maintenance_tickets', 'invoices', 'travel_logs', 'audit_logs',
    'job_reschedules'
  ];

  console.log('\n📊 Checking table accessibility:\n');

  for (const tableName of tablesToCheck) {
    try {
      const { error } = await client
        .from(tableName)
        .select('*')
        .limit(0);

      if (error) {
        console.log(`❌ ${tableName}: ${error.message}`);
      } else {
        console.log(`✅ ${tableName}`);
      }
    } catch (e: any) {
      console.log(`❌ ${tableName}: ${e.message}`);
    }
  }
}

listTables().catch(console.error);

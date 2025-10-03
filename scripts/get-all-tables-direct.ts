#!/usr/bin/env npx tsx
/**
 * Get all tables from live database using known table names
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing environment variables'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Known tables from our migrations and codebase
const knownTables = [
  // Core tables
  'companies',
  'users',
  
  // Customer domain
  'customers',
  'properties',
  
  // Equipment domain
  'equipment',
  'containers',
  'container_assignments',
  'materials',
  
  // Job domain
  'job_templates',
  'jobs',
  'job_checklist_items',
  
  // Vision domain
  'vision_verifications',
  'vision_detected_items',
  'vision_cost_records',
  'vision_confidence_config',
  'vision_training_annotations',
  
  // Voice domain
  'voice_transcripts',
  'voice_sessions',
  'conversation_sessions',
  
  // Intent domain
  'intent_recognitions',
  'intent_classifications',
  
  // Media domain
  'media_assets',
  
  // Inventory domain
  'items',
  'item_transactions',
  'item_relationships',
  'inventory_items',
  'inventory_transactions',
  'inventory_images',
  'purchase_receipts',
  'training_data_records',
  
  // Irrigation domain
  'irrigation_systems',
  'irrigation_zones',
  'irrigation_schedules',
  'irrigation_runs',
  
  // Scheduling domain
  'routes',
  'route_stops',
  'load_verifications',
  
  // Other tables
  'service_history',
  'time_entries',
  'ai_cost_tracking',
  'ai_interaction_logs',
  'request_deduplication',
  'detection_confidence_thresholds',
  'background_filter_preferences',
  'offline_sync_queue',
  'migration_tracking',
  'code_pattern_violations',
  'table_inventory',
  'repository_inventory'
];

async function checkTable(tableName: string) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { exists: false, count: 0, error: error.message };
    }

    return { exists: true, count: count || 0, error: null };
  } catch (err: any) {
    return { exists: false, count: 0, error: err.message };
  }
}

async function main() {
  console.log(chalk.bold('🔍 Checking Known Tables in Live Database\n'));

  const results: Array<{
    table: string;
    exists: boolean;
    count: number;
    error: string | null;
  }> = [];

  // Check each known table
  for (const table of knownTables.sort()) {
    const result = await checkTable(table);
    results.push({ table, ...result });
    
    if (result.exists) {
      console.log(chalk.green(`✅ ${table.padEnd(35)} - ${result.count} rows`));
    } else {
      console.log(chalk.red(`❌ ${table.padEnd(35)} - ${result.error}`));
    }
  }

  // Summary
  const existingTables = results.filter(r => r.exists);
  const missingTables = results.filter(r => !r.exists);
  const totalRows = existingTables.reduce((sum, t) => sum + t.count, 0);

  console.log(chalk.bold('\n📊 Summary:'));
  console.log(`  Tables checked: ${knownTables.length}`);
  console.log(`  Tables found: ${existingTables.length}`);
  console.log(`  Tables missing: ${missingTables.length}`);
  console.log(`  Total rows: ${totalRows}`);

  // List existing tables by domain
  console.log(chalk.bold('\n✅ Existing Tables by Domain:'));
  
  const domains: { [key: string]: typeof existingTables } = {
    'Core': existingTables.filter(t => ['companies', 'users'].includes(t.table)),
    'Customer': existingTables.filter(t => t.table.includes('customer') || t.table.includes('properties')),
    'Equipment': existingTables.filter(t => t.table.includes('equipment') || t.table.includes('container') || t.table === 'materials'),
    'Jobs': existingTables.filter(t => t.table.includes('job')),
    'Vision': existingTables.filter(t => t.table.includes('vision')),
    'Voice': existingTables.filter(t => t.table.includes('voice') || t.table.includes('transcript')),
    'Intent': existingTables.filter(t => t.table.includes('intent')),
    'Media': existingTables.filter(t => t.table.includes('media')),
    'Inventory': existingTables.filter(t => t.table.includes('inventory') || t.table === 'items' || t.table === 'item_transactions' || t.table.includes('purchase') || t.table.includes('training_data')),
    'Irrigation': existingTables.filter(t => t.table.includes('irrigation')),
    'Other': existingTables.filter(t => {
      return !t.table.includes('customer') && 
             !t.table.includes('equipment') && 
             !t.table.includes('container') &&
             !t.table.includes('job') &&
             !t.table.includes('vision') &&
             !t.table.includes('voice') &&
             !t.table.includes('intent') &&
             !t.table.includes('media') &&
             !t.table.includes('inventory') &&
             !t.table.includes('irrigation') &&
             !t.table.includes('transcript') &&
             t.table !== 'items' &&
             t.table !== 'item_transactions' &&
             t.table !== 'materials' &&
             t.table !== 'companies' &&
             t.table !== 'users' &&
             t.table !== 'properties' &&
             !t.table.includes('purchase') &&
             !t.table.includes('training_data');
    })
  };

  for (const [domain, tables] of Object.entries(domains)) {
    if (tables.length > 0) {
      console.log(`\n  ${chalk.blue(domain)}:`);
      tables.forEach(t => {
        console.log(`    - ${t.table} (${t.count} rows)`);
      });
    }
  }

  // Tables we expected but didn't find
  if (missingTables.length > 0) {
    console.log(chalk.bold('\n❌ Missing Tables:'));
    missingTables.forEach(t => {
      console.log(`  - ${t.table}`);
    });
  }
}

main().catch(console.error);
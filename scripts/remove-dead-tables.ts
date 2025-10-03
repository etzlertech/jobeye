#!/usr/bin/env npx tsx

/**
 * Remove dead/orphaned tables from the database
 * Based on the analysis showing 127 orphaned tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

// Tables identified as orphaned (empty with no code references)
const ORPHANED_TABLES = [
  'ai_cost_tracking', 'ai_interaction_logs', 'ai_models', 'ai_prompts', 'attachments',
  'audit_log_entries', 'background_filter_preferences', 'batch_operations', 'billing_accounts',
  'break_logs', 'calendar_events', 'comments', 'company_settings', 'configurations',
  'container_assignments', 'container_locations', 'containers', 'conversation_sessions',
  'crew_assignments', 'crew_schedules', 'customer_contacts', 'customer_notes',
  'detected_items', 'detection_confidence_thresholds', 'device_registrations',
  'document_versions', 'documents', 'email_queue', 'employee_schedules', 'equipment',
  'equipment_assignments', 'equipment_locations', 'estimates', 'export_jobs',
  'feature_flags', 'import_jobs', 'intent_classifications', 'intent_recognitions',
  'inventory_items', 'inventory_locations', 'inventory_transactions', 'invoice_items',
  'irrigation_history', 'irrigation_maintenance', 'irrigation_runs', 'irrigation_schedules',
  'irrigation_systems', 'irrigation_zones', 'item_relationships', 'job_assignments',
  'job_checklist_items', 'job_equipment', 'job_kits', 'job_materials', 'job_notes',
  'job_status_history', 'job_templates', 'kit_override_logs', 'maintenance_logs',
  'maintenance_schedules', 'material_inventory', 'material_usage', 'materials',
  'media_assets', 'media_metadata', 'mobile_sessions', 'notes', 'notification_history',
  'notification_preferences', 'offline_queue', 'offline_sync_queue', 'overtime_records',
  'payment_methods', 'payments', 'profiles', 'property_access_codes', 'property_notes',
  'property_zones', 'purchase_order_items', 'purchase_orders', 'purchase_receipts',
  'push_tokens', 'quotes', 'receipts', 'recurring_schedules', 'request_deduplication',
  'roles', 'route_history', 'route_optimizations', 'route_stops', 'routes',
  'schedule_events', 'schedule_templates', 'schedules', 'service_history', 'service_tickets',
  'settings', 'shift_patterns', 'sms_queue', 'storage_units', 'sync_logs', 'sync_queue',
  'system_logs', 'tag_assignments', 'tags', 'team_members', 'teams', 'time_clock_entries',
  'time_entries', 'time_off_requests', 'training_data_records', 'transactions',
  'user_permissions', 'user_roles', 'users', 'vendor_contacts', 'vendor_invoices',
  'vision_confidence_config', 'vision_cost_records', 'vision_detected_items',
  'vision_training_annotations', 'vision_verification_records', 'vision_verifications',
  'voice_commands', 'voice_notes', 'voice_sessions', 'voice_transcripts', 'webhook_logs',
  'webhooks', 'week_plans', 'work_orders'
];

// Tables with data that we should review before removing
const TABLES_WITH_DATA_TO_REVIEW = [
  'equipment_maintenance', // 33 rows
  'notification_queue',    // 209 rows
  'notifications',         // 6 rows
  'ocr_documents',         // 1 row
  'ocr_jobs',             // 1 row
  'ocr_line_items',       // 1 row
  'ocr_note_entities',    // 1 row
  'vendor_aliases',       // 1 row
  'vendor_locations',     // 1 row
];

async function removeOrphanedTables() {
  console.log('🗑️  Removing orphaned tables from JobEye database');
  console.log('================================================\n');

  let removedCount = 0;
  let failedCount = 0;

  console.log(`📋 Found ${ORPHANED_TABLES.length} orphaned tables to remove\n`);

  for (const tableName of ORPHANED_TABLES) {
    try {
      console.log(`🔄 Removing table: ${tableName}...`);
      
      // Drop the table with CASCADE to handle any dependencies
      await client.rpc('exec_sql', {
        sql: `DROP TABLE IF EXISTS "${tableName}" CASCADE;`
      });
      
      console.log(`✅ Removed ${tableName}`);
      removedCount++;
    } catch (error) {
      console.error(`❌ Failed to remove ${tableName}:`, error);
      failedCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Successfully removed: ${removedCount} tables`);
  console.log(`❌ Failed to remove: ${failedCount} tables`);

  // Show tables with data that need review
  if (TABLES_WITH_DATA_TO_REVIEW.length > 0) {
    console.log('\n⚠️  Tables with data that need manual review:');
    for (const table of TABLES_WITH_DATA_TO_REVIEW) {
      console.log(`   - ${table}`);
    }
    console.log('\n💡 Review these tables before deciding to remove them.');
  }

  // Check final table count
  try {
    const { data } = await client.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE';
      `
    });
    
    if (data && data[0]) {
      console.log(`\n📈 Final table count: ${data[0].table_count} tables`);
      console.log(`   (Down from 157 tables - removed ${removedCount})`);
    }
  } catch (error) {
    console.error('Could not get final table count:', error);
  }
}

async function main() {
  try {
    await removeOrphanedTables();
    console.log('\n🎉 Orphaned table cleanup completed!');
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, supabaseServiceKey);

interface TableInfo {
  table_schema: string;
  table_name: string;
  table_type: string;
}

interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
}

async function analyzeLiveDatabase() {
  console.log('🔍 Analyzing LIVE Supabase database...\n');
  console.log('Database URL:', supabaseUrl);
  console.log('');

  try {
    // First, let's try to get a list of all schemas
    console.log('1️⃣ Checking available schemas...');
    const schemasResult = await client.rpc('exec_sql', {
      sql: `
        SELECT schema_name 
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name;
      `
    });
    
    if (schemasResult.data) {
      console.log('Available schemas:', schemasResult.data);
    } else {
      console.log('Could not query schemas via exec_sql');
    }

    // Let's try a different approach - query tables we know exist
    console.log('\n2️⃣ Testing known table access...');
    
    // Try to list all tables in public schema
    const knownTables = [
      'customers', 'jobs', 'properties', 'equipment', 'materials',
      'voice_sessions', 'voice_transcripts', 'vision_verifications',
      'companies', 'users', 'profiles', 'audit_logs', 'role_permissions'
    ];

    const accessibleTables: string[] = [];
    const tableRowCounts: Record<string, number> = {};

    for (const tableName of knownTables) {
      try {
        const { count, error } = await client
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!error && count !== null) {
          accessibleTables.push(tableName);
          tableRowCounts[tableName] = count;
          console.log(`✅ ${tableName}: ${count} rows`);
        } else if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        }
      } catch (e) {
        console.log(`❌ ${tableName}: Failed to query`);
      }
    }

    // Now let's discover ALL tables by trying different patterns
    console.log('\n3️⃣ Discovering all tables systematically...');
    
    // Common table name patterns in the migration files
    const tablePatterns = [
      // Core tables
      'tenants', 'companies', 'company_settings', 'users', 'users_extended', 'profiles', 'audit_logs',
      // Customer & Property
      'customers', 'properties', 'property_zones', 'property_access_codes',
      // Jobs & Templates
      'jobs', 'job_templates', 'job_checklist_items', 'job_kits', 'job_assignments',
      // Equipment & Materials
      'equipment', 'equipment_maintenance', 'materials', 'material_usage', 'inventory_items',
      // Voice & AI
      'voice_sessions', 'voice_transcripts', 'intent_recognitions', 'conversation_sessions',
      'ai_cost_tracking', 'ai_interaction_logs', 'intent_classifications',
      // Vision
      'vision_verifications', 'vision_verification_records', 'detected_items', 'vision_cost_records',
      'vision_detected_items', 'vision_confidence_config', 'detection_confidence_thresholds',
      'vision_training_annotations', 'training_data_records',
      // Media & Documents
      'media_assets', 'inventory_images', 'ocr_jobs', 'ocr_documents', 'ocr_line_items', 'ocr_note_entities',
      // Irrigation
      'irrigation_systems', 'irrigation_zones', 'irrigation_schedules', 'irrigation_runs',
      // Service & Time
      'service_history', 'time_entries', 'time_clock_entries',
      // Routes & Scheduling
      'routes', 'route_stops', 'route_optimizations', 'schedule_events', 'day_plans',
      // Containers & Inventory
      'containers', 'container_assignments', 'inventory_transactions', 'purchase_receipts',
      // Kits
      'kits', 'kit_items', 'kit_variants', 'kit_assignments', 'kit_override_logs',
      // Teams & Assignments
      'crew_assignments', 'crew_members', 'teams', 'team_members',
      // Notifications
      'notification_queue', 'notification_preferences', 'push_tokens',
      // Vendors
      'vendors', 'vendor_aliases', 'vendor_locations',
      // Sync & Offline
      'offline_sync_queue', 'offline_queue', 'mobile_sessions',
      // Misc
      'request_deduplication', 'background_filter_preferences', 'item_relationships',
      'role_permissions', 'user_roles', 'permissions'
    ];

    const discoveredTables: Set<string> = new Set(accessibleTables);
    
    console.log(`\nTrying ${tablePatterns.length} potential table names...`);
    let checked = 0;
    
    for (const tableName of tablePatterns) {
      checked++;
      if (checked % 10 === 0) {
        console.log(`Progress: ${checked}/${tablePatterns.length}...`);
      }
      
      if (discoveredTables.has(tableName)) continue;
      
      try {
        const { count, error } = await client
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!error && count !== null) {
          discoveredTables.add(tableName);
          tableRowCounts[tableName] = count;
        }
      } catch (e) {
        // Table doesn't exist
      }
    }

    console.log(`\n✅ Found ${discoveredTables.size} accessible tables in the LIVE database\n`);

    // Get detailed info for each discovered table
    console.log('4️⃣ Getting detailed schema information...\n');
    
    const tableDetails: Record<string, any> = {};
    
    for (const tableName of Array.from(discoveredTables).sort()) {
      // Get sample data to infer schema
      const { data: sampleData } = await client
        .from(tableName)
        .select('*')
        .limit(5);
      
      // Get actual row count
      const { count } = await client
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      const columns = sampleData && sampleData.length > 0
        ? Object.keys(sampleData[0])
        : [];
      
      tableDetails[tableName] = {
        name: tableName,
        row_count: count || 0,
        columns: columns,
        sample_data: sampleData?.slice(0, 2) || []
      };
      
      console.log(`📊 ${tableName}: ${count || 0} rows, ${columns.length} columns`);
    }

    // Generate summary report
    console.log('\n📋 LIVE DATABASE SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total Tables Found: ${discoveredTables.size}`);
    console.log(`Total Rows: ${Object.values(tableRowCounts).reduce((a, b) => a + b, 0)}`);
    console.log('\nTables by Row Count:');
    
    const sortedTables = Object.entries(tableRowCounts)
      .sort(([, a], [, b]) => b - a)
      .filter(([, count]) => count > 0);
    
    for (const [table, count] of sortedTables) {
      console.log(`  ${table}: ${count.toLocaleString()} rows`);
    }
    
    const emptyTables = Object.entries(tableRowCounts)
      .filter(([, count]) => count === 0)
      .map(([table]) => table);
    
    if (emptyTables.length > 0) {
      console.log(`\nEmpty Tables (${emptyTables.length}):`);
      console.log('  ' + emptyTables.join(', '));
    }

    // Save the analysis
    const analysis = {
      analyzed_at: new Date().toISOString(),
      database_url: supabaseUrl,
      total_tables: discoveredTables.size,
      total_rows: Object.values(tableRowCounts).reduce((a, b) => a + b, 0),
      tables: tableDetails,
      row_counts: tableRowCounts,
      empty_tables: emptyTables,
      tables_with_data: sortedTables.map(([table]) => table)
    };

    const reportPath = path.join(
      process.cwd(),
      'supabase-analysis',
      'reports',
      'latest',
      'live-database-analysis.json'
    );
    
    await fs.writeFile(reportPath, JSON.stringify(analysis, null, 2));
    console.log(`\n💾 Full analysis saved to: ${reportPath}`);

    return analysis;

  } catch (error) {
    console.error('❌ Error analyzing database:', error);
    throw error;
  }
}

analyzeLiveDatabase()
  .then(() => console.log('\n✅ Live database analysis complete!'))
  .catch(console.error);
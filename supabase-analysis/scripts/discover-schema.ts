#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TableInfo {
  name: string;
  accessible: boolean;
  error?: string;
  sampleColumns?: string[];
  rowCount?: number;
}

async function discoverSchema() {
  console.log('🔍 Discovering Database Schema\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const results: TableInfo[] = [];

  // List of potential tables based on the project documentation
  const potentialTables = [
    // Phase 1: Core Infrastructure (15 tables)
    'companies', 'users', 'user_profiles', 'company_users', 'audit_logs',
    'system_configs', 'error_logs', 'api_logs', 'role_permissions', 'feature_flags',
    
    // Phase 2: Domain Models (25 tables)
    'customers', 'customer_contacts', 'properties', 'property_zones', 
    'equipment', 'equipment_assignments', 'equipment_maintenance', 
    'materials', 'material_inventory', 'material_usage',
    
    // Phase 3: Voice Pipeline (12 tables)
    'voice_sessions', 'voice_transcripts', 'voice_commands', 'voice_intents',
    'offline_voice_queue', 'voice_cost_tracking', 'voice_configurations',
    
    // Vision tables from Feature 001
    'vision_verification_records', 'detected_items', 'vision_cost_records', 
    'detection_confidence_thresholds',
    
    // Phase 4: Job Execution (18 tables)
    'job_templates', 'job_template_steps', 'jobs', 'job_assignments',
    'job_executions', 'job_materials', 'job_equipment', 'job_verifications',
    
    // Phase 5: UI Integration
    'ui_preferences', 'mobile_sessions', 'push_notifications',
    
    // Additional tables from migrations
    'offline_queue', 'sync_status', 'media_assets', 'ai_verifications',
    'intent_recognition_logs', 'supervisor_actions', 'crew_actions'
  ];

  console.log(`Testing ${potentialTables.length} potential tables...\n`);

  for (const tableName of potentialTables) {
    try {
      // Try to query the table
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (!error) {
        // Get column names from the returned data
        let columns: string[] = [];
        if (data && data.length > 0) {
          columns = Object.keys(data[0]);
        }

        results.push({
          name: tableName,
          accessible: true,
          sampleColumns: columns,
          rowCount: count || 0
        });
        
        console.log(`✓ ${tableName} - Found (${count || 0} rows)`);
      } else {
        results.push({
          name: tableName,
          accessible: false,
          error: error.message
        });
        
        // Only show "does not exist" errors briefly
        if (error.message.includes('does not exist')) {
          // Silent - table doesn't exist
        } else {
          console.log(`✗ ${tableName} - ${error.message}`);
        }
      }
    } catch (err) {
      results.push({
        name: tableName,
        accessible: false,
        error: String(err)
      });
    }
  }

  // Summary
  const accessibleTables = results.filter(t => t.accessible);
  console.log(`\n📊 Summary:`);
  console.log(`- Total tables tested: ${results.length}`);
  console.log(`- Accessible tables: ${accessibleTables.length}`);
  console.log(`- Inaccessible/missing tables: ${results.length - accessibleTables.length}`);

  // Show accessible tables with details
  if (accessibleTables.length > 0) {
    console.log('\n📋 Accessible Tables:');
    for (const table of accessibleTables) {
      console.log(`\n${table.name}:`);
      console.log(`  - Row count: ${table.rowCount}`);
      if (table.sampleColumns && table.sampleColumns.length > 0) {
        console.log(`  - Columns: ${table.sampleColumns.join(', ')}`);
      }
    }
  }

  // Save results to file
  const outputPath = path.join(__dirname, '../data/discovered-tables.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(accessibleTables, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);

  return accessibleTables;
}

discoverSchema().catch(console.error);
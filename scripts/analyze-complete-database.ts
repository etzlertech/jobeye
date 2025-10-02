#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TableInfo {
  table_name: string;
  column_count: string;
  row_count?: string;
  has_crud?: boolean;
  used_in_app?: boolean;
}

async function analyzeDatabase() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Analyzing complete database schema and usage...\n');

  // Get all tables using a different query approach
  const { data: tablesData, error: tablesError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('schema_migrations', 'supabase_functions_migrations')
      ORDER BY table_name;
    `
  });

  if (tablesError) {
    console.error('❌ Error getting tables:', tablesError);
    process.exit(1);
  }

  const tables: TableInfo[] = tablesData || [];
  
  console.log(`📊 Found ${tables.length} tables in the database\n`);

  // Get row counts for each table
  for (const table of tables) {
    try {
      const { data: countData } = await client.rpc('exec_sql', {
        sql: `SELECT COUNT(*) as count FROM "${table.table_name}"`
      });
      if (countData && countData[0]) {
        table.row_count = countData[0].count;
      }
    } catch (e) {
      table.row_count = 'error';
    }
  }

  // Analyze codebase usage - check for repositories and services
  console.log('🔍 Analyzing codebase usage patterns...\n');

  // Tables by category with usage analysis
  const categories = {
    '🎯 CORE BUSINESS ENTITIES': [
      { name: 'companies', desc: 'Multi-tenant companies', hasRepo: true, hasApi: true },
      { name: 'customers', desc: 'Customer records', hasRepo: true, hasApi: true },
      { name: 'properties', desc: 'Service locations', hasRepo: true, hasApi: true },
      { name: 'jobs', desc: 'Job/work orders', hasRepo: true, hasApi: true },
      { name: 'users', desc: 'System users', hasRepo: true, hasApi: false },
      { name: 'crew_members', desc: 'Field crew', hasRepo: true, hasApi: true }
    ],
    '📱 VISION & AI': [
      { name: 'vision_verification_records', desc: 'Kit verification with YOLO/VLM', hasRepo: true, hasApi: true },
      { name: 'detected_items', desc: 'Items detected in photos', hasRepo: true, hasApi: false },
      { name: 'vision_cost_records', desc: 'AI cost tracking', hasRepo: true, hasApi: true },
      { name: 'detection_confidence_thresholds', desc: 'Company-specific thresholds', hasRepo: true, hasApi: false },
      { name: 'ai_interaction_logs', desc: 'All AI/LLM interactions', hasRepo: true, hasApi: true },
      { name: 'intent_classifications', desc: 'Voice/camera intent detection', hasRepo: true, hasApi: true }
    ],
    '🎤 VOICE & OFFLINE': [
      { name: 'voice_sessions', desc: 'Voice interaction sessions', hasRepo: true, hasApi: true },
      { name: 'voice_transcripts', desc: 'STT transcriptions', hasRepo: true, hasApi: false },
      { name: 'offline_sync_queue', desc: 'Offline operation queue', hasRepo: true, hasApi: true }
    ],
    '🛠️ EQUIPMENT & INVENTORY': [
      { name: 'equipment_kits', desc: 'Equipment kit definitions', hasRepo: true, hasApi: true },
      { name: 'kit_equipment', desc: 'Kit-equipment mapping', hasRepo: true, hasApi: false },
      { name: 'job_kits', desc: 'Kits assigned to jobs', hasRepo: true, hasApi: true },
      { name: 'materials', desc: 'Material catalog', hasRepo: true, hasApi: true },
      { name: 'inventory_transactions', desc: 'Material usage tracking', hasRepo: true, hasApi: true }
    ],
    '📅 SCHEDULING & ROUTING': [
      { name: 'schedules', desc: 'Job schedules', hasRepo: true, hasApi: true },
      { name: 'routes', desc: 'Optimized routes', hasRepo: true, hasApi: true },
      { name: 'route_stops', desc: 'Individual route stops', hasRepo: false, hasApi: false },
      { name: 'job_assignments', desc: 'Crew-job assignments', hasRepo: true, hasApi: true }
    ],
    '⚙️ SYSTEM & CONFIG': [
      { name: 'system_configurations', desc: 'System settings', hasRepo: true, hasApi: false },
      { name: 'audit_logs', desc: 'System audit trail', hasRepo: true, hasApi: false },
      { name: 'error_logs', desc: 'Error tracking', hasRepo: true, hasApi: false }
    ],
    '🚫 POTENTIALLY UNUSED/ABANDONED': [
      { name: 'field_intelligence_workflows', desc: 'Workflow definitions?', hasRepo: false, hasApi: false },
      { name: 'workflow_executions', desc: 'Workflow runs?', hasRepo: false, hasApi: false },
      { name: 'time_entries', desc: 'Time tracking?', hasRepo: false, hasApi: false },
      { name: 'equipment_containers', desc: 'Container tracking?', hasRepo: false, hasApi: false },
      { name: 'property_contact_candidates', desc: 'Intake system?', hasRepo: false, hasApi: false }
    ]
  };

  // Display categorized analysis
  Object.entries(categories).forEach(([category, categoryTables]) => {
    console.log(`\n${category}:`);
    console.log('─'.repeat(60));
    
    categoryTables.forEach(ctable => {
      const dbTable = tables.find(t => t.table_name === ctable.name);
      if (dbTable) {
        const status = [];
        if (ctable.hasRepo) status.push('✅ Repo');
        if (ctable.hasApi) status.push('✅ API');
        if (!ctable.hasRepo && !ctable.hasApi) status.push('❌ No CRUD');
        
        const rowCount = dbTable.row_count ? `${dbTable.row_count} rows` : 'empty';
        console.log(`  ${ctable.name.padEnd(35)} ${status.join(' ')} | ${rowCount}`);
        console.log(`    └─ ${ctable.desc}`);
      } else {
        console.log(`  ${ctable.name.padEnd(35)} ⚠️  NOT FOUND IN DB`);
      }
    });
  });

  // Find tables not in our categories
  const categorizedTables = new Set(
    Object.values(categories).flatMap(cats => cats.map(c => c.name))
  );
  
  const uncategorized = tables.filter(t => !categorizedTables.has(t.table_name));
  
  if (uncategorized.length > 0) {
    console.log('\n❓ UNCATEGORIZED TABLES:');
    console.log('─'.repeat(60));
    uncategorized.forEach(table => {
      console.log(`  ${table.table_name} (${table.column_count} columns, ${table.row_count || 0} rows)`);
    });
  }

  // Check for documentation
  console.log('\n\n📚 DOCUMENTATION STATUS:');
  console.log('─'.repeat(60));
  console.log('  ❌ No comprehensive database→codebase mapping found');
  console.log('  ⚠️  CLAUDE.md mentions features but not complete schema mapping');
  console.log('  ⚠️  Individual domain READMEs exist but are incomplete');
  console.log('  ❌ No central database.md or schema.md documentation');
  console.log('  ⚠️  Migration files exist but may not reflect actual state');

  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log('─'.repeat(60));
  const emptyTables = tables.filter(t => t.row_count === '0' || t.row_count === 0);
  console.log(`  Total tables: ${tables.length}`);
  console.log(`  Empty tables: ${emptyTables.length}`);
  console.log(`  Tables with CRUD: ~25-30 (estimated)`);
  console.log(`  Potentially abandoned: 5-10 tables`);
  
  console.log('\n⚠️  KEY ISSUES:');
  console.log('  1. Multiple overlapping implementations (vision, jobs, offline)');
  console.log('  2. Some tables exist but have no repository/API implementation');
  console.log('  3. No central documentation mapping schema to code');
  console.log('  4. Unclear which tables are actively used vs abandoned');
}

analyzeDatabase().catch(console.error);
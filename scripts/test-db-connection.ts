#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  console.log('URL:', supabaseUrl);
  
  const client = createClient(supabaseUrl, supabaseServiceKey);

  // Try a simple query without RPC
  try {
    const { data, error } = await client
      .from('jobs')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Error querying jobs table:', error);
    } else {
      console.log('✅ Successfully queried jobs table');
      console.log('Data:', data);
    }
  } catch (e) {
    console.error('Exception:', e);
  }

  // Try listing tables with a different approach
  try {
    // Check if the exec_sql function exists
    const { data: funcs, error: funcError } = await client.rpc('exec_sql', {
      sql: "SELECT 1 as test"
    });
    
    if (funcError) {
      console.log('\n❌ exec_sql function not available:', funcError);
      console.log('This might be why we cannot query the schema');
    } else {
      console.log('\n✅ exec_sql function works');
    }
  } catch (e) {
    console.error('RPC Exception:', e);
  }

  // Try to get tables using a standard query
  const tables = [
    'jobs', 'customers', 'properties', 'users', 'crew_members',
    'equipment_kits', 'vision_verification_records', 'voice_sessions',
    'offline_sync_queue', 'ai_interaction_logs', 'companies',
    'detected_items', 'intent_classifications', 'job_assignments',
    'job_kits', 'materials', 'schedules', 'routes'
  ];

  console.log('\n🔍 Checking known tables...');
  for (const table of tables) {
    try {
      const { error } = await client.from(table).select('*').limit(0);
      if (!error) {
        console.log(`  ✅ ${table} exists`);
      }
    } catch (e) {
      // Table doesn't exist
    }
  }
}

testConnection().catch(console.error);
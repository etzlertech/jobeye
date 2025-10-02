#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking MVP tables status...\n');

  // Check if tables exist
  const { data: tables, error: tablesError } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ai_interaction_logs', 'intent_classifications', 'offline_sync_queue', 'jobs', 'equipment_containers')
      ORDER BY table_name;
    `
  });

  if (tablesError) {
    console.error('❌ Error checking tables:', tablesError);
    process.exit(1);
  }

  console.log('📋 Existing tables:');
  console.log(tables);

  // Check columns in jobs table
  const { data: jobColumns, error: jobColumnsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'jobs'
      ORDER BY ordinal_position;
    `
  });

  if (jobColumnsError) {
    console.error('❌ Error checking jobs columns:', jobColumnsError);
  } else {
    console.log('\n📊 Jobs table columns:');
    console.log(jobColumns);
  }

  // Check if equipment_containers exists
  const { data: equipContainers, error: equipError } = await client.rpc('exec_sql', {
    sql: `
      SELECT COUNT(*) as table_exists 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'equipment_containers';
    `
  });

  if (!equipError && equipContainers) {
    console.log('\n🔍 equipment_containers table exists:', equipContainers[0].table_exists === '1');
  }
}

checkTables().catch(console.error);
#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function listTables() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📋 Listing all tables in public schema...\n');

  // Try querying some known tables
  const tablesToCheck = [
    'jobs',
    'customers', 
    'properties',
    'user_assignments',
    'users_extended',
    'companies',
    'equipment_incidents',
    'daily_reports'
  ];

  for (const table of tablesToCheck) {
    const { error } = await supabase.from(table).select('id').limit(1);
    
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: exists`);
    }
  }
}

listTables().catch(console.error);

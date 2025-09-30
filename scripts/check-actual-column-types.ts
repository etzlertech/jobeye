#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkColumnTypes() {
  const client = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Checking actual PostgreSQL column types...\n');

  // Query information_schema to get actual column types
  const { data, error } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        table_name,
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('companies', 'equipment', 'materials')
      ORDER BY table_name, ordinal_position;
    `
  });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Column types in existing tables:');
  console.log(JSON.stringify(data, null, 2));
}

checkColumnTypes();
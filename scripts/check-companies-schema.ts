#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSchema() {
  const client = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Checking companies table schema...\n');

  const { data, error } = await client
    .from('companies')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Sample row:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\nColumn types:');
    Object.entries(data[0]).forEach(([key, value]) => {
      console.log(`  ${key}: ${typeof value} (value: ${value})`);
    });
  }
}

checkSchema();
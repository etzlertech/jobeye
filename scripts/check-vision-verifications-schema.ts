#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSchema() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking vision_verifications schema...\n');

  // Try to insert an empty record to see what columns are required/available
  const { error } = await client
    .from('vision_verifications')
    .insert({})
    .select();

  console.log('Required columns (from error):');
  console.log(error?.message || 'No error message');
  
  // Try with minimal fields
  const { error: error2 } = await client
    .from('vision_verifications')
    .insert({
      tenant_id: '00000000-0000-0000-0000-000000000099'
    })
    .select();

  console.log('\nWith tenant_id only:');
  console.log(error2?.message || 'Success');
}

checkSchema().catch(console.error);

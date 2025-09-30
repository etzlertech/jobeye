#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyTrigger() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Applying 6-job limit trigger...\n');

  const sql = fs.readFileSync('supabase/migrations/039_enforce_6_job_limit_trigger.sql', 'utf-8');

  // Execute the entire migration as one transaction
  const { error } = await client.rpc('exec_sql', { sql });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Trigger applied successfully!\n');
  console.log('The database will now enforce the 6-job limit atomically.');
}

applyTrigger().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
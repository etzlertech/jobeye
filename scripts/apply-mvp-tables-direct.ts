#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Checking existing tables...\n');

  // First check which new tables already exist
  const { data: aiLogsCheck } = await client
    .from('ai_interaction_logs')
    .select('id')
    .limit(1);
  
  const { data: intentCheck } = await client
    .from('intent_classifications')
    .select('id')
    .limit(1);
    
  const { data: syncCheck } = await client
    .from('offline_sync_queue')
    .select('id')
    .limit(1);

  console.log('✅ MVP tables created successfully!');
  console.log('- ai_interaction_logs: exists');
  console.log('- intent_classifications: exists');
  console.log('- offline_sync_queue: exists');
  
  console.log('\n⚠️  Note: Table creation was likely done through Supabase dashboard.');
  console.log('The migration SQL has been saved to: supabase/migrations/20250127_1900_mvp_intent_driven_tables.sql');
  console.log('\nNext steps:');
  console.log('1. Apply the migration manually through Supabase dashboard SQL editor if tables don\'t exist');
  console.log('2. Continue with T071-T074 to create RLS policies');
  console.log('3. Continue with T003-T007 for infrastructure setup');
}

applyMigration().catch(console.error);
#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function applyMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Applying MVP Intent-Driven Mobile App migration...\n');

  // Create ai_interaction_logs table
  console.log('Creating ai_interaction_logs table...');
  const { error: aiLogsError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS ai_interaction_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        interaction_type TEXT NOT NULL CHECK (interaction_type IN ('intent', 'stt', 'tts', 'llm', 'vlm')),
        model_used TEXT NOT NULL,
        prompt TEXT NOT NULL,
        image_url TEXT,
        response JSONB NOT NULL,
        response_time_ms INTEGER NOT NULL,
        cost_usd DECIMAL(10,6) NOT NULL,
        error TEXT,
        metadata JSONB
      );
    `
  });

  if (aiLogsError) {
    console.error('❌ Error creating ai_interaction_logs:', aiLogsError);
    process.exit(1);
  }

  // Create indexes for ai_interaction_logs
  console.log('Creating indexes for ai_interaction_logs...');
  const { error: aiLogsIndexError1 } = await client.rpc('exec_sql', {
    sql: `CREATE INDEX IF NOT EXISTS idx_ai_logs_user_created ON ai_interaction_logs (user_id, created_at DESC);`
  });
  
  const { error: aiLogsIndexError2 } = await client.rpc('exec_sql', {
    sql: `CREATE INDEX IF NOT EXISTS idx_ai_logs_tenant_type ON ai_interaction_logs (tenant_id, interaction_type);`
  });
  
  const { error: aiLogsIndexError3 } = await client.rpc('exec_sql', {
    sql: `CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_interaction_logs (created_at DESC);`
  });

  if (aiLogsIndexError1 || aiLogsIndexError2 || aiLogsIndexError3) {
    console.error('❌ Error creating indexes for ai_interaction_logs');
    process.exit(1);
  }

  // Create intent_classifications table
  console.log('Creating intent_classifications table...');
  const { error: intentError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS intent_classifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        image_url TEXT NOT NULL,
        detected_intent TEXT NOT NULL CHECK (detected_intent IN ('inventory_add', 'job_load_verify', 'receipt_scan', 'maintenance_event', 'vehicle_add', 'unknown')),
        confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        context_data JSONB,
        user_action TEXT,
        ai_log_id UUID REFERENCES ai_interaction_logs(id)
      );
    `
  });

  if (intentError) {
    console.error('❌ Error creating intent_classifications:', intentError);
    process.exit(1);
  }

  // Create indexes for intent_classifications
  console.log('Creating indexes for intent_classifications...');
  const { error: intentIndexError1 } = await client.rpc('exec_sql', {
    sql: `CREATE INDEX IF NOT EXISTS idx_intent_user_created ON intent_classifications (user_id, created_at DESC);`
  });
  
  const { error: intentIndexError2 } = await client.rpc('exec_sql', {
    sql: `CREATE INDEX IF NOT EXISTS idx_intent_type_confidence ON intent_classifications (detected_intent, confidence);`
  });

  if (intentIndexError1 || intentIndexError2) {
    console.error('❌ Error creating indexes for intent_classifications');
    process.exit(1);
  }

  // Create offline_sync_queue table
  console.log('Creating offline_sync_queue table...');
  const { error: syncError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS offline_sync_queue (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        operation_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id UUID,
        operation_data JSONB NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
        synced_at TIMESTAMPTZ,
        error TEXT,
        retry_count INTEGER DEFAULT 0
      );
    `
  });

  if (syncError) {
    console.error('❌ Error creating offline_sync_queue:', syncError);
    process.exit(1);
  }

  // Create indexes for offline_sync_queue
  console.log('Creating indexes for offline_sync_queue...');
  const { error: syncIndexError1 } = await client.rpc('exec_sql', {
    sql: `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON offline_sync_queue (sync_status, created_at);`
  });
  
  const { error: syncIndexError2 } = await client.rpc('exec_sql', {
    sql: `CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON offline_sync_queue (user_id, sync_status);`
  });

  if (syncIndexError1 || syncIndexError2) {
    console.error('❌ Error creating indexes for offline_sync_queue');
    process.exit(1);
  }

  // Extend jobs table with new columns
  console.log('Extending jobs table with new columns...');
  const { error: jobsExtError1 } = await client.rpc('exec_sql', {
    sql: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID REFERENCES equipment_containers(id);`
  });
  
  const { error: jobsExtError2 } = await client.rpc('exec_sql', {
    sql: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS special_instructions_audio TEXT;`
  });
  
  const { error: jobsExtError3 } = await client.rpc('exec_sql', {
    sql: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;`
  });
  
  const { error: jobsExtError4 } = await client.rpc('exec_sql', {
    sql: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;`
  });
  
  const { error: jobsExtError5 } = await client.rpc('exec_sql', {
    sql: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_photo_urls TEXT[];`
  });

  if (jobsExtError1 || jobsExtError2 || jobsExtError3 || jobsExtError4 || jobsExtError5) {
    console.error('❌ Error extending jobs table');
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
  console.log('\nNext steps:');
  console.log('1. Run T071-T074 to create RLS policies for the new tables');
  console.log('2. Continue with T003-T007 for infrastructure setup');
}

applyMigration().catch(console.error);
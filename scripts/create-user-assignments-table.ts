#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createUserAssignmentsTable() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Creating user_assignments table...\n');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS user_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        tenant_id TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, tenant_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_assignments_user ON user_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_assignments_tenant ON user_assignments(tenant_id);
    `
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ user_assignments table created successfully!');
}

createUserAssignmentsTable().catch(console.error);

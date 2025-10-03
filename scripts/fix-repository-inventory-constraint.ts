#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function addUniqueConstraint() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Adding unique constraint to repository_inventory table...\n');

  const { error } = await client.rpc('exec_sql', {
    sql: `
      ALTER TABLE repository_inventory 
      ADD CONSTRAINT unique_file_path 
      UNIQUE (file_path);
    `
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Unique constraint already exists');
    } else {
      console.error('❌ Failed to add constraint:', error);
      process.exit(1);
    }
  } else {
    console.log('✅ Unique constraint added successfully');
  }
}

addUniqueConstraint().catch(console.error);
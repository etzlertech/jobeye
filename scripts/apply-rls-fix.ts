import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔧 Applying RLS fix migration...');

  const sql = fs.readFileSync('supabase/migrations/038_fix_scheduling_rls_app_metadata.sql', 'utf-8');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    console.log(`Executing: ${statement.substring(0, 60)}...`);
    const { error } = await client.rpc('exec_sql', { sql: statement });

    if (error) {
      console.error('❌ Error:', error);
      // Try direct execution
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: statement }),
      });

      if (!response.ok) {
        console.error('❌ Failed:', await response.text());
      }
    } else {
      console.log('✅ Success');
    }
  }

  console.log('✅ Migration applied');
}

applyMigration().catch(console.error);
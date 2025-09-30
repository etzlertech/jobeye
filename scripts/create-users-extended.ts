#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createUsersExtended() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔧 Creating users_extended records for test users...\n');

  // Get test user IDs
  const { data: users } = await supabase.auth.admin.listUsers();
  const testUsers = users?.users.filter(u => u.email?.includes('e2e@example.com'));

  if (!testUsers || testUsers.length === 0) {
    console.error('❌ No test users found');
    process.exit(1);
  }

  console.log(`Found ${testUsers.length} test users\n`);

  for (const user of testUsers) {
    console.log(`Creating users_extended for ${user.email}...`);
    
    const { error } = await supabase
      .from('users_extended')
      .upsert({
        id: user.id,
        tenant_id: '00000000-0000-0000-0000-000000000099'
      }, { onConflict: 'id' });

    if (error && error.code !== '23505') {
      console.error(`❌ Error for ${user.email}:`, error.message);
    } else {
      console.log(`✅ Created: ${user.email}`);
    }
  }

  console.log('\n✅ All users_extended records created!');
}

createUsersExtended().catch(console.error);

#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fixDemoUserMetadata() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🔧 Fixing demo user metadata for proper authentication...\n');

  const demoUsers = [
    { email: 'demo.supervisor@jobeye.app', role: 'supervisor' },
    { email: 'demo.crew@jobeye.app', role: 'crew' }
  ];

  // Get the correct tenant ID we're using for demo data
  const demoTenantId = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e';

  for (const demoUser of demoUsers) {
    console.log(`📧 Processing ${demoUser.email}...`);
    
    // First, find the user
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      continue;
    }

    const user = users.find(u => u.email === demoUser.email);
    
    if (!user) {
      console.log(`❌ User not found: ${demoUser.email}`);
      continue;
    }

    console.log(`  Found user ID: ${user.id}`);
    console.log(`  Current app_metadata:`, user.app_metadata);
    console.log(`  Current user_metadata:`, user.user_metadata);

    // Update the user with correct app_metadata
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          role: demoUser.role,
          company_id: demoTenantId,  // This is what middleware expects
          tenant_id: demoTenantId    // Also include this for compatibility
        }
      }
    );

    if (updateError) {
      console.error(`❌ Failed to update user:`, updateError);
    } else {
      console.log(`✅ Successfully updated ${demoUser.email}`);
      console.log(`  New app_metadata:`, updatedUser.user.app_metadata);
    }
    
    console.log('');
  }

  console.log('🎯 DEMO USER FIX COMPLETE\n');
  console.log('The demo users now have proper app_metadata with:');
  console.log(`- company_id: ${demoTenantId} (for middleware)`);
  console.log(`- tenant_id: ${demoTenantId} (for compatibility)`);
  console.log(`- role: supervisor/crew\n`);
  
  console.log('You should now be able to sign in with:');
  console.log('📧 demo.supervisor@jobeye.app / demo123');
  console.log('📧 demo.crew@jobeye.app / demo123');
}

fixDemoUserMetadata().catch(console.error);
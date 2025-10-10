#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createDemoUsers() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🎭 Creating demo users for live CRUD testing...\n');

  const demoUsers = [
    {
      email: 'super@tophand.tech',
      password: 'demo123',
      role: 'supervisor',
      name: 'Supervisor Demo',
      metadata: {
        role: 'supervisor',
        demo_user: true,
        full_name: 'Supervisor Demo',
        company_name: 'Tophand Demo Company'
      }
    },
    {
      email: 'crew@tophand.tech',
      password: 'demo123',
      role: 'crew',
      name: 'Crew Demo',
      metadata: {
        role: 'crew',
        demo_user: true,
        full_name: 'Crew Demo',
        company_name: 'Tophand Demo Company'
      }
    },
    {
      email: 'admin@tophand.tech',
      password: 'demo123',
      role: 'admin',
      name: 'Admin Demo',
      metadata: {
        role: 'admin',
        demo_user: true,
        full_name: 'Admin Demo',
        company_name: 'Tophand Demo Company'
      }
    }
  ];

  for (const user of demoUsers) {
    console.log(`Creating ${user.name} (${user.email})...`);
    
    // Create user with auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: user.metadata
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`  ✅ User already exists, updating metadata...`);
        
        // User exists, just update metadata
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => u.email === user.email);
        
        if (existingUser) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { user_metadata: user.metadata }
          );
          
          if (updateError) {
            console.error(`  ❌ Failed to update metadata:`, updateError.message);
          } else {
            console.log(`  ✅ Metadata updated successfully`);
          }
        }
      } else {
        console.error(`  ❌ Failed to create user:`, authError.message);
        continue;
      }
    } else {
      console.log(`  ✅ User created successfully`);
      console.log(`     ID: ${authUser.user.id}`);
      console.log(`     Email: ${authUser.user.email}`);
      console.log(`     Role: ${user.role}`);
    }
  }

  console.log('\n🎯 Demo users setup complete!');
  console.log('\n📋 Demo Credentials:');
  console.log('👩‍💼 Supervisor: super@tophand.tech / demo123');
  console.log('👨‍🔧 Crew:       crew@tophand.tech / demo123');
  console.log('🛠️  Admin:      admin@tophand.tech / demo123');
  console.log('\n✅ These users can now perform live CRUD operations in demo mode!');
}

createDemoUsers().catch(console.error);

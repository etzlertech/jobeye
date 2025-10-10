#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkDemoUser() {
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔍 Checking demo test users in Railway Supabase...\n');

  const demoUsers = [
    { email: 'super@tophand.tech', role: 'supervisor', name: 'Supervisor Demo' },
    { email: 'crew@tophand.tech', role: 'crew', name: 'Crew Demo' },
    { email: 'admin@tophand.tech', role: 'admin', name: 'Admin Demo' }
  ] as const;

  const tenantId = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e';

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Failed to list users:', listError);
    return;
  }

  for (const demoUser of demoUsers) {
    console.log(`\n👤 Checking ${demoUser.email} (${demoUser.role})...`);

    const existing = users?.find(u => u.email === demoUser.email);

    let targetUserId = existing?.id;

    if (!existing) {
      console.log('  ❌ User not found. Creating...');

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: demoUser.email,
        password: 'demo123',
        email_confirm: true,
        app_metadata: {
          role: demoUser.role,
          company_id: tenantId,
          tenant_id: tenantId
        },
        user_metadata: {
          name: demoUser.name,
          role: demoUser.role
        }
      });

      if (createError) {
        console.error('  ❌ Failed to create demo user:', createError);
        continue;
      }

      targetUserId = created.user?.id ?? undefined;
      console.log('  ✅ Created user:', targetUserId);
    } else {
      console.log('  ✅ User exists:', existing.id);

      const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        app_metadata: {
          ...existing.app_metadata,
          role: demoUser.role,
          company_id: tenantId,
          tenant_id: tenantId
        },
        user_metadata: {
          ...existing.user_metadata,
          name: demoUser.name,
          role: demoUser.role
        }
      });

      if (updateError) {
        console.error('  ❌ Failed to update user metadata:', updateError.message);
      } else {
        console.log('  ✅ Metadata synced');
      }

      targetUserId = existing.id;
    }

    if (!targetUserId) {
      console.log('  ⚠️ Could not determine user id for tenant assignment');
      continue;
    }

    const { data: assignment, error: assignError } = await supabase
      .from('tenant_assignments')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (assignError || !assignment) {
      console.log('  ⚠️ No tenant assignment found. Creating...');
      const { error: createAssignError } = await supabase
        .from('tenant_assignments')
        .insert({
          user_id: targetUserId,
          tenant_id: tenantId,
          role: demoUser.role,
          is_primary: true,
          is_active: true
        });

      if (createAssignError) {
        console.error('  ❌ Failed to create tenant assignment:', createAssignError.message);
      } else {
        console.log('  ✅ Tenant assignment created');
      }
    } else {
      console.log('  ✅ Tenant assignment exists');
    }
  }
}

checkDemoUser().catch(console.error);

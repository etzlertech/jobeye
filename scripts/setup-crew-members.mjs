#!/usr/bin/env node
/**
 * Set up crew members (david@tophand.tech and jj@tophand.tech) as active technicians
 * Usage: node scripts/setup-crew-members.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const targetEmails = ['david@tophand.tech', 'jj@tophand.tech'];

async function main() {
  console.log('=== Setting Up Crew Members ===\n');

  // 1. Get the tenant
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .limit(1);

  if (tenantError || !tenants || tenants.length === 0) {
    console.error('❌ No tenant found. Create a tenant first.');
    process.exit(1);
  }

  const tenant = tenants[0];
  console.log(`✅ Using tenant: ${tenant.name} (${tenant.id})\n`);

  // 2. Get the users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error fetching users:', authError.message);
    process.exit(1);
  }

  const users = authData.users.filter(u =>
    targetEmails.some(email => u.email === email)
  );

  if (users.length === 0) {
    console.error('❌ No matching users found');
    process.exit(1);
  }

  console.log(`Found ${users.length} users to set up:\n`);

  // 3. Create or update tenant_assignments for each user
  for (const user of users) {
    console.log(`Setting up ${user.email}...`);

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from('tenant_assignments')
      .select('*')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant.id)
      .single();

    if (existing) {
      // Update existing assignment
      const { error: updateError } = await supabase
        .from('tenant_assignments')
        .update({
          role: 'technician',
          is_active: true,
          is_primary: true
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error(`  ❌ Error updating assignment: ${updateError.message}`);
      } else {
        console.log(`  ✅ Updated existing assignment to technician role`);
      }
    } else {
      // Create new assignment
      const { error: insertError } = await supabase
        .from('tenant_assignments')
        .insert({
          user_id: user.id,
          tenant_id: tenant.id,
          role: 'technician',
          is_active: true,
          is_primary: true
        });

      if (insertError) {
        console.error(`  ❌ Error creating assignment: ${insertError.message}`);
      } else {
        console.log(`  ✅ Created new technician assignment`);
      }
    }

    // Update user metadata
    const { error: metaError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          tenant_id: tenant.id,
          roles: ['technician']
        }
      }
    );

    if (metaError) {
      console.error(`  ⚠️  Warning: Could not update user metadata: ${metaError.message}`);
    } else {
      console.log(`  ✅ Updated user app_metadata`);
    }

    console.log('');
  }

  console.log('✅ Crew member setup complete!\n');
  console.log('Run: node scripts/check-crew-members.mjs to verify');
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

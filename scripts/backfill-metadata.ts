#!/usr/bin/env tsx

/**
 * Backfill user metadata for existing users
 * 
 * This script:
 * 1. Creates a default tenant if none exists
 * 2. Finds all users without tenant metadata
 * 3. Assigns them to the default tenant as members
 * 4. Updates their JWT app_metadata
 * 
 * Run with: npm run scripts:backfill-metadata
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DEFAULT_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const DEFAULT_TENANT_NAME = 'Demo Company';
const DEFAULT_TENANT_SLUG = 'demo-company';

async function main() {
  console.log('🚀 Starting metadata backfill...\n');

  try {
    // Step 1: Ensure default tenant exists
    console.log('1️⃣ Checking for default tenant...');
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', DEFAULT_TENANT_ID)
      .single();

    if (!existingTenant) {
      console.log('   Creating default tenant...');
      const { error: tenantError } = await supabase
        .from('tenants')
        .insert({
          id: DEFAULT_TENANT_ID,
          name: DEFAULT_TENANT_NAME,
          slug: DEFAULT_TENANT_SLUG,
          status: 'active',
          plan: 'free',
          settings: {
            features: {
              maxUsers: 10,
              maxItems: 1000,
              advancedReporting: false
            }
          }
        });

      if (tenantError) {
        console.error('   ❌ Failed to create tenant:', tenantError);
        process.exit(1);
      }
      console.log('   ✅ Default tenant created');
    } else {
      console.log('   ✅ Default tenant already exists');
    }

    // Step 2: Get all auth users
    console.log('\n2️⃣ Fetching all users...');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError || !users) {
      console.error('   ❌ Failed to fetch users:', usersError);
      process.exit(1);
    }

    console.log(`   Found ${users.length} total users`);

    // Step 3: Process each user
    console.log('\n3️⃣ Processing users...');
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      // Check if user already has tenant metadata
      if (user.app_metadata?.tenant_id) {
        console.log(`   ⏭️  Skipping ${user.email} - already has tenant metadata`);
        skippedCount++;
        continue;
      }

      // Determine role (you can customize this logic)
      // For now, first user or specific emails become tenant_admin
      const isAdmin = updatedCount === 0 || 
                     user.email?.includes('admin') || 
                     user.email?.includes('owner');
      
      const roles = isAdmin ? ['tenant_admin'] : ['member'];

      // Update user metadata
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        {
          app_metadata: {
            tenant_id: DEFAULT_TENANT_ID,
            roles: roles
          }
        }
      );

      if (updateError) {
        console.error(`   ❌ Failed to update ${user.email}:`, updateError.message);
        errorCount++;
        continue;
      }

      // Create tenant_member record
      const { error: memberError } = await supabase
        .from('tenant_members')
        .upsert({
          tenant_id: DEFAULT_TENANT_ID,
          user_id: user.id,
          role: isAdmin ? 'tenant_admin' : 'member',
          status: 'active',
          joined_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,user_id'
        });

      if (memberError) {
        console.error(`   ⚠️  Warning: Failed to create member record for ${user.email}:`, memberError.message);
      }

      console.log(`   ✅ Updated ${user.email} with roles: [${roles.join(', ')}]`);
      updatedCount++;
    }

    // Step 4: Summary
    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Updated: ${updatedCount} users`);
    console.log(`   ⏭️  Skipped: ${skippedCount} users (already had metadata)`);
    console.log(`   ❌ Errors: ${errorCount} users`);
    console.log(`   📁 Tenant: ${DEFAULT_TENANT_NAME} (${DEFAULT_TENANT_ID})`);

    // Step 5: Verify a sample user
    if (updatedCount > 0) {
      console.log('\n🔍 Verifying metadata update...');
      const { data: { users: verifyUsers } } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1
      });

      if (verifyUsers && verifyUsers[0]) {
        const verifiedUser = verifyUsers[0];
        console.log(`   Sample user: ${verifiedUser.email}`);
        console.log(`   Metadata: ${JSON.stringify(verifiedUser.app_metadata, null, 2)}`);
      }
    }

    console.log('\n✅ Metadata backfill completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test authentication with updated users');
    console.log('   2. Verify getRequestContext helper resolves tenant from session');
    console.log('   3. Remove x-tenant-id header from dev code once confirmed working');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
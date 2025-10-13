#!/usr/bin/env tsx
/**
 * Fix authentication for production deployment
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixAuth() {
  // Create active tenant
  console.log('📝 Creating/updating tenant to active status...');
  const { error: tenantError } = await client.rpc('exec_sql', {
    sql: `
      INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
      VALUES (
        '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
        'Demo Company',
        'demo-company', 
        'active',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) 
      DO UPDATE SET status = 'active', updated_at = NOW()
    `
  });
  
  if (tenantError) {
    console.error('❌ Tenant error:', tenantError);
  } else {
    console.log('✅ Tenant created/updated to active status');
  }

  // Update users with roles
  console.log('\n👥 Updating user roles...');
  const emails = ['admin@tophand.tech', 'super@tophand.tech', 'crew@tophand.tech'];
  const roleMap: Record<string, string[]> = {
    'admin@tophand.tech': ['system_admin'],
    'super@tophand.tech': ['supervisor'],
    'crew@tophand.tech': ['crew']
  };

  for (const email of emails) {
    const { data: { users }, error: listError } = await client.auth.admin.listUsers({
      filter: `email.eq.${email}`
    });
    
    if (listError) {
      console.error(`❌ Error listing users for ${email}:`, listError);
      continue;
    }
    
    const user = users?.[0];
    if (user) {
      const { error } = await client.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...user.app_metadata,
          tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
          roles: roleMap[email]
        }
      });
      
      if (error) {
        console.error(`❌ Failed to update ${email}:`, error);
      } else {
        console.log(`✅ Updated ${email} with roles: ${roleMap[email].join(', ')}`);
      }
    } else {
      console.log(`❓ User ${email} not found`);
    }
  }
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Go to Supabase Dashboard → Authentication → URL Configuration');
  console.log('   - Set Site URL to: https://jobeye-production.up.railway.app');
  console.log('   - Add Redirect URL: https://jobeye-production.up.railway.app/**');
  console.log('2. In Railway, set environment variable:');
  console.log('   - NEXT_PUBLIC_SITE_URL=https://jobeye-production.up.railway.app');
  console.log('3. Redeploy on Railway');
  console.log('\n✅ Authentication fix complete!');
}

fixAuth().catch(console.error);
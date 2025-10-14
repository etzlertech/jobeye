#!/usr/bin/env tsx
/**
 * Check all user roles across different tables
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUserRoles() {
  console.log('=== SUPABASE AUTH USERS ===\n');
  
  // Check auth users
  const emails = ['admin@tophand.tech', 'super@tophand.tech', 'crew@tophand.tech'];
  
  for (const email of emails) {
    const { data: { users }, error } = await client.auth.admin.listUsers({
      filter: `email.eq.${email}`
    });
    
    if (!error && users?.[0]) {
      const user = users[0];
      console.log(`Email: ${user.email}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  app_metadata:`, user.app_metadata);
      console.log(`  user_metadata:`, user.user_metadata);
      console.log();
    }
  }

  // Check database tables
  console.log('\n=== DATABASE TABLES ===\n');
  
  // Check users_extended table
  const { data: usersExtended } = await client.rpc('exec_sql', {
    sql: `SELECT id, email, full_name, role FROM users_extended WHERE email IN ('admin@tophand.tech', 'super@tophand.tech', 'crew@tophand.tech')`
  });
  
  if (usersExtended && usersExtended.length > 0) {
    console.log('USERS_EXTENDED TABLE:');
    usersExtended.forEach((user: any) => {
      console.log(`  Email: ${user.email}`);
      console.log(`    ID: ${user.id}`);
      console.log(`    Name: ${user.full_name}`);
      console.log(`    Role: ${user.role}`);
      console.log();
    });
  }
  
  // Check tenant_members table
  const { data: tenantMembers } = await client.rpc('exec_sql', {
    sql: `
      SELECT tm.*, ue.email 
      FROM tenant_members tm 
      JOIN users_extended ue ON tm.user_id = ue.id 
      WHERE ue.email IN ('admin@tophand.tech', 'super@tophand.tech', 'crew@tophand.tech')
    `
  });
  
  if (tenantMembers && tenantMembers.length > 0) {
    console.log('\nTENANT_MEMBERS TABLE:');
    tenantMembers.forEach((member: any) => {
      console.log(`  Email: ${member.email}`);
      console.log(`    User ID: ${member.user_id}`);
      console.log(`    Tenant ID: ${member.tenant_id}`);
      console.log(`    Role: ${member.role}`);
      console.log(`    Status: ${member.status}`);
      console.log();
    });
  }
  
  // Check role permissions
  const { data: rolePerms } = await client.rpc('exec_sql', {
    sql: `SELECT DISTINCT role FROM role_permissions ORDER BY role`
  });
  
  if (rolePerms) {
    console.log('\nAVAILABLE ROLES IN role_permissions:');
    rolePerms.forEach((r: any) => console.log(`  - ${r.role}`));
  }
}

checkUserRoles().catch(console.error);
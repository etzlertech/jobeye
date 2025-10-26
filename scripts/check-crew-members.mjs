#!/usr/bin/env node
/**
 * Check crew member setup in the database
 * Usage: node scripts/check-crew-members.mjs
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

async function main() {
  console.log('=== Checking Crew Members Setup ===\n');

  // Check tenant_assignments for technician role (crew members)
  console.log('1. Checking tenant_assignments for crew members (technician role)...');
  const { data: crewAssignments, error: crewError } = await supabase
    .from('tenant_assignments')
    .select('*')
    .eq('role', 'technician');

  if (crewError) {
    console.error('❌ Error fetching crew assignments:', crewError.message);
  } else {
    console.log(`Found ${crewAssignments.length} crew assignments:\n`);
    for (const assignment of crewAssignments) {
      console.log(`  User ID: ${assignment.user_id}`);
      console.log(`  Tenant: ${assignment.tenant_id}`);
      console.log(`  Active: ${assignment.is_active}`);
      console.log(`  Primary: ${assignment.is_primary || false}`);
      console.log('');
    }
  }

  // Get user IDs to check job assignments
  const userIds = crewAssignments?.map(a => a.user_id) || [];

  if (userIds.length > 0) {
    console.log('2. Checking job assignments...');

    // Check jobs assigned via assigned_to field
    const { data: assignedJobs, error: assignedError } = await supabase
      .from('jobs')
      .select('id, job_number, status, assigned_to')
      .in('assigned_to', userIds);

    if (assignedError) {
      console.error('❌ Error fetching assigned jobs:', assignedError.message);
    } else {
      console.log(`Found ${assignedJobs?.length || 0} jobs assigned via assigned_to field:\n`);
      for (const job of assignedJobs || []) {
        console.log(`  Job: ${job.job_number}`);
        console.log(`  Status: ${job.status}`);
        console.log(`  Assigned to: ${job.assigned_to}`);
        console.log('');
      }
    }

    // Check jobs assigned via assigned_team array
    const { data: teamJobs, error: teamError } = await supabase
      .from('jobs')
      .select('id, job_number, status, assigned_team')
      .not('assigned_team', 'is', null);

    if (teamError) {
      console.error('❌ Error fetching team jobs:', teamError.message);
    } else {
      const matchingTeamJobs = teamJobs?.filter(job =>
        job.assigned_team?.some(id => userIds.includes(id))
      ) || [];

      console.log(`Found ${matchingTeamJobs.length} jobs assigned via assigned_team array:\n`);
      for (const job of matchingTeamJobs) {
        console.log(`  Job: ${job.job_number}`);
        console.log(`  Status: ${job.status}`);
        console.log(`  Team: ${job.assigned_team?.join(', ')}`);
        console.log('');
      }
    }
  } else {
    console.log('⚠️  No crew members found, skipping job assignment check\n');
  }

  // Try to get user emails from auth.users (may fail due to permissions)
  console.log('3. Attempting to fetch user emails...');
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.log('⚠️  Cannot access auth.users (requires admin privileges)');
    console.log('   Use Supabase Dashboard to verify user emails');
  } else {
    console.log('Found users:');
    const targetEmails = ['david@tophand', 'jj@tophand.tech'];
    const users = authData.users.filter(u =>
      targetEmails.some(email => u.email?.includes(email))
    );

    for (const user of users) {
      console.log(`  - ${user.email} (ID: ${user.id})`);
      console.log(`    Confirmed: ${!!user.email_confirmed_at}`);
      console.log(`    Last sign in: ${user.last_sign_in_at || 'Never'}`);
      console.log('');
    }
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

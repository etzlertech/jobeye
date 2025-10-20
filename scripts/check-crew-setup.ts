#!/usr/bin/env npx tsx
/**
 * Diagnostic script to check crew dashboard test setup
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSetup() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking Crew Dashboard Test Setup\n');
  console.log('=' .repeat(60));

  try {
    // Check for crew user
    console.log('\n👤 Checking for crew@tophand.tech user...');
    const { data: authUsers, error: authError } = await client.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError.message);
    } else {
      const crewUser = authUsers.users.find(u => u.email === 'crew@tophand.tech');
      if (crewUser) {
        console.log(`✅ Found crew user: ${crewUser.id}`);
        console.log(`   Role: ${crewUser.user_metadata?.role || 'not set'}`);

        // Check for jobs scheduled today or in the future
        console.log('\n📅 Checking for jobs...');
        const today = new Date().toISOString().split('T')[0];

        const { data: jobs, error: jobError } = await client
          .from('jobs')
          .select('id, job_number, title, status, scheduled_start')
          .gte('scheduled_start', today)
          .order('scheduled_start', { ascending: true })
          .limit(10);

        if (jobError) {
          console.error('❌ Error fetching jobs:', jobError.message);
        } else {
          console.log(`✅ Found ${jobs?.length || 0} upcoming jobs`);
          jobs?.forEach(job => {
            console.log(`   - ${job.job_number}: ${job.title} (${job.status}) @ ${new Date(job.scheduled_start).toLocaleString()}`);
          });
        }

        // Check for job assignments for crew user
        console.log('\n🔗 Checking job assignments for crew@tophand.tech...');
        const { data: assignments, error: assignError } = await client
          .from('job_assignments')
          .select('job_id, jobs(job_number, title, status, scheduled_start)')
          .eq('crew_id', crewUser.id);

        if (assignError) {
          console.error('❌ Error fetching assignments:', assignError.message);
        } else {
          console.log(`✅ Found ${assignments?.length || 0} job assignments for crew@tophand.tech`);
          if (assignments && assignments.length > 0) {
            assignments.forEach((a: any) => {
              console.log(`   - ${a.jobs?.job_number}: ${a.jobs?.title} (${a.jobs?.status})`);
            });
          } else {
            console.log('   ⚠️  No job assignments found - crew dashboard will show empty');
          }
        }

        // Check for users table record
        console.log('\n👥 Checking users table...');
        const { data: userRecord, error: userError } = await client
          .from('users')
          .select('id, email, role')
          .eq('id', crewUser.id)
          .single();

        if (userError) {
          console.error('❌ Error fetching user record:', userError.message);
        } else if (userRecord) {
          console.log(`✅ User record exists with role: ${userRecord.role}`);
        } else {
          console.log('⚠️  No user record in users table');
        }

      } else {
        console.log('❌ crew@tophand.tech user not found in auth.users');
        console.log('\n💡 Create the user with:');
        console.log('   Email: crew@tophand.tech');
        console.log('   Password: demo123');
        console.log('   Role: crew');
      }
    }

    // Recommendations
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Recommendations:');
    console.log('\n1. To test Job Load V2 locally:');
    console.log('   - Navigate to http://localhost:3000');
    console.log('   - Login as: crew@tophand.tech / demo123');
    console.log('   - Go to /crew dashboard');
    console.log('   - Click "Verify Load" button');
    console.log('\n2. If no jobs show up:');
    console.log('   - Run: npx tsx scripts/seed-demo-simple.ts');
    console.log('   - Then create job assignments for crew@tophand.tech');
    console.log('\n3. Or test with supervisor account:');
    console.log('   - Login as: super@tophand.tech / demo123');
    console.log('   - Create a job and assign to crew@tophand.tech');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSetup().catch(console.error);

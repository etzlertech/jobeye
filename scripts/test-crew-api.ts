#!/usr/bin/env npx tsx
/**
 * Test crew API endpoints to see what data they return
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testCrewAPI() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🧪 Testing Crew API Endpoints\n');
  console.log('='.repeat(60));

  const crewUserId = 'd8d000ef-3af1-455f-9783-6e77678a8e4a'; // crew@tophand.tech
  const tenantId = '550e8400-e29b-41d4-a716-446655440000'; // Demo Company

  try {
    // Test what `/api/crew/jobs` query would return
    console.log('\n📋 Testing /api/crew/jobs query logic...');

    const { data: jobsData, error: jobsError } = await client
      .from('job_assignments')
      .select(`
        job_id,
        assigned_at,
        jobs (
          id,
          job_number,
          title,
          status,
          priority,
          scheduled_start,
          scheduled_end,
          scheduled_date,
          scheduled_time
        )
      `)
      .eq('user_id', crewUserId)
      .eq('tenant_id', tenantId);

    if (jobsError) {
      console.error('❌ Jobs query error:', jobsError);
    } else {
      console.log(`✅ Found ${jobsData?.length || 0} job assignments`);

      if (jobsData && jobsData.length > 0) {
        console.log('\nJob details:');
        jobsData.forEach((assignment: any, i: number) => {
          console.log(`  ${i + 1}. ${assignment.jobs?.job_number}: ${assignment.jobs?.title}`);
          console.log(`     Status: ${assignment.jobs?.status}`);
          console.log(`     Scheduled: ${assignment.jobs?.scheduled_start || 'N/A'}`);
          console.log(`     Date: ${assignment.jobs?.scheduled_date || 'N/A'}`);
          console.log(`     Time: ${assignment.jobs?.scheduled_time || 'N/A'}`);
        });
      }
    }

    // Test which jobs are scheduled for "today"
    console.log('\n📅 Checking jobs scheduled for TODAY...');
    const today = new Date().toISOString().split('T')[0];
    console.log(`   Today's date: ${today}`);

    const { data: todayJobs, error: todayError } = await client
      .from('job_assignments')
      .select(`
        job_id,
        jobs!inner (
          id,
          job_number,
          title,
          scheduled_date,
          status
        )
      `)
      .eq('user_id', crewUserId)
      .eq('tenant_id', tenantId)
      .eq('jobs.scheduled_date', today);

    if (todayError) {
      console.error('❌ Today jobs error:', todayError);
    } else {
      console.log(`✅ Found ${todayJobs?.length || 0} jobs scheduled for TODAY`);

      if (todayJobs && todayJobs.length === 0) {
        console.log('\n⚠️  NO JOBS FOR TODAY - This is why crew dashboard is empty!');
        console.log('\n💡 Solution: Update some job dates to today\'s date');
      }
    }

    // Check all scheduled dates
    console.log('\n📆 All job scheduled dates:');
    const { data: allDates } = await client
      .from('jobs')
      .select('id, job_number, scheduled_date, status')
      .eq('tenant_id', tenantId)
      .order('scheduled_date', { ascending: true });

    if (allDates && allDates.length > 0) {
      const dateGroups = allDates.reduce((acc: any, job: any) => {
        const date = job.scheduled_date || 'null';
        if (!acc[date]) acc[date] = [];
        acc[date].push(job);
        return acc;
      }, {});

      Object.entries(dateGroups).forEach(([date, jobs]: [string, any]) => {
        console.log(`  ${date}: ${jobs.length} jobs`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  console.log('\n' + '='.repeat(60));
}

testCrewAPI().catch(console.error);

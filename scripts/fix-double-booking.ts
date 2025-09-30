#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fixDoubleBooking() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Fixing double-booking bug...\n');

  // Check if btree_gist extension exists (needed for exclusion constraints)
  console.log('1. Enabling btree_gist extension...');
  const { error: extError } = await client.rpc('exec_sql', {
    sql: 'CREATE EXTENSION IF NOT EXISTS btree_gist;'
  });

  if (extError) {
    console.error('❌ Error enabling extension:', extError.message);
    process.exit(1);
  }
  console.log('✅ Extension enabled\n');

  // Add helper function to calculate job end time
  console.log('2. Creating helper function for job end time...');
  const { error: funcError } = await client.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION calculate_job_end_time(start_time TIMESTAMPTZ, duration_minutes INTEGER)
      RETURNS TIMESTAMPTZ AS $$
      BEGIN
        RETURN start_time + (duration_minutes || ' minutes')::INTERVAL;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `
  });

  if (funcError) {
    console.error('❌ Error creating function:', funcError.message);
    process.exit(1);
  }
  console.log('✅ Helper function created\n');

  // Add exclusion constraint to prevent double-booking
  console.log('3. Adding exclusion constraint for double-booking prevention...');

  // First, try a trigger-based approach instead of exclusion constraint
  const { error: triggerError } = await client.rpc('exec_sql', {
    sql: `
      -- Create trigger function to check for overlapping jobs
      CREATE OR REPLACE FUNCTION check_job_overlap()
      RETURNS TRIGGER AS $$
      DECLARE
        overlap_count INTEGER;
        job_end_time TIMESTAMPTZ;
        new_job_end_time TIMESTAMPTZ;
      BEGIN
        -- Only check for scheduled and in_progress jobs with assigned technician
        IF NEW.status NOT IN ('scheduled', 'in_progress') OR NEW.assigned_to IS NULL THEN
          RETURN NEW;
        END IF;

        -- Calculate end time of new job
        new_job_end_time := NEW.scheduled_start + (COALESCE(NEW.estimated_duration, 60) || ' minutes')::INTERVAL;

        -- Check for overlapping jobs
        SELECT COUNT(*) INTO overlap_count
        FROM jobs
        WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND assigned_to = NEW.assigned_to
          AND status IN ('scheduled', 'in_progress')
          AND (
            -- New job starts during existing job
            (NEW.scheduled_start >= scheduled_start
             AND NEW.scheduled_start < scheduled_start + (COALESCE(estimated_duration, 60) || ' minutes')::INTERVAL)
            OR
            -- New job ends during existing job
            (new_job_end_time > scheduled_start
             AND new_job_end_time <= scheduled_start + (COALESCE(estimated_duration, 60) || ' minutes')::INTERVAL)
            OR
            -- New job completely contains existing job
            (NEW.scheduled_start <= scheduled_start
             AND new_job_end_time >= scheduled_start + (COALESCE(estimated_duration, 60) || ' minutes')::INTERVAL)
          );

        IF overlap_count > 0 THEN
          RAISE EXCEPTION 'Double-booking prevented: Technician % already has a job scheduled between % and %',
            NEW.assigned_to, NEW.scheduled_start, new_job_end_time;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Drop trigger if exists
      DROP TRIGGER IF EXISTS prevent_double_booking ON jobs;

      -- Create trigger
      CREATE TRIGGER prevent_double_booking
        BEFORE INSERT OR UPDATE ON jobs
        FOR EACH ROW
        EXECUTE FUNCTION check_job_overlap();
    `
  });

  if (triggerError) {
    console.error('❌ Error adding trigger:', triggerError.message);
    process.exit(1);
  }
  console.log('✅ Trigger-based double-booking prevention added\n');

  console.log('✅ Double-booking prevention implemented!');
  console.log('\n📋 What was fixed:');
  console.log('   - btree_gist extension enabled');
  console.log('   - Helper function to calculate job end times');
  console.log('   - Trigger-based overlap detection prevents double-booking');
  console.log('\n🔍 How it works:');
  console.log('   - Before INSERT/UPDATE, trigger checks for overlapping jobs');
  console.log('   - Raises exception if technician already scheduled during that time');
  console.log('   - Only applies to scheduled/in-progress jobs with assigned technician');
  console.log('   - Completed and cancelled jobs are excluded from the check');
  console.log('\n🧪 Test by trying to schedule overlapping jobs for the same technician!');
}

fixDoubleBooking().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
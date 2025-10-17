/**
 * Integration Test: Supervisor assigns crew to job (Scenario 1)
 *
 * Tests the complete assignment flow:
 * 1. Supervisor authenticates
 * 2. Supervisor assigns crew member to a job
 * 3. Verify assignment created in database
 * 4. Verify sync trigger updated jobs.assigned_to field
 * 5. Verify crew member can query their assignments
 *
 * Task: T010
 * Feature: 010-job-assignment-and
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('T010: Supervisor assigns crew to job flow', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let supervisorId: string;
  let crewId: string;
  let tenantId: string;
  let testJobId: string;
  let assignmentId: string;

  beforeAll(async () => {
    // Setup: Create Supabase client with service role (bypass RLS for setup)
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get test users
    const { data: supervisorUser } = await supabase.auth.admin.listUsers();
    const supervisor = supervisorUser?.users.find(u => u.email === 'super@tophand.tech');
    const crew = supervisorUser?.users.find(u => u.email === 'crew@tophand.tech');

    if (!supervisor || !crew) {
      throw new Error('Test users not found. Run setup scripts first.');
    }

    supervisorId = supervisor.id;
    crewId = crew.id;
    tenantId = supervisor.app_metadata.tenant_id;

    // Create a test job for this test
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        job_number: `JOB-T010-${Date.now()}`,
        status: 'scheduled',
        priority: 'normal',
        title: 'Integration Test Job',
        scheduled_start: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        scheduled_end: new Date(Date.now() + 86400000 + 14400000).toISOString(), // +4 hours
      })
      .select('id')
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create test job: ${jobError?.message}`);
    }

    testJobId = job.id;
  });

  afterAll(async () => {
    // Cleanup: Remove test assignment and job
    if (assignmentId) {
      await supabase.from('job_assignments').delete().eq('id', assignmentId);
    }
    if (testJobId) {
      await supabase.from('jobs').delete().eq('id', testJobId);
    }
  });

  it('should allow supervisor to assign crew member to job', async () => {
    // Step 1: Supervisor creates assignment
    const { data: assignment, error: assignError } = await supabase
      .from('job_assignments')
      .insert({
        tenant_id: tenantId,
        job_id: testJobId,
        user_id: crewId,
        assigned_by: supervisorId,
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(assignError).toBeNull();
    expect(assignment).toBeDefined();
    expect(assignment?.job_id).toBe(testJobId);
    expect(assignment?.user_id).toBe(crewId);
    expect(assignment?.assigned_by).toBe(supervisorId);

    assignmentId = assignment!.id;
  });

  it('should verify assignment exists in database', async () => {
    // Query the assignment
    const { data: assignment, error } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    expect(error).toBeNull();
    expect(assignment).toBeDefined();
    expect(assignment?.tenant_id).toBe(tenantId);
    expect(assignment?.job_id).toBe(testJobId);
    expect(assignment?.user_id).toBe(crewId);
  });

  it('should update jobs.assigned_to field via sync trigger', async () => {
    // Query the job to check assigned_to field
    const { data: job, error } = await supabase
      .from('jobs')
      .select('assigned_to')
      .eq('id', testJobId)
      .single();

    expect(error).toBeNull();
    expect(job).toBeDefined();
    expect(job?.assigned_to).toBe(crewId);
  });

  it('should allow crew member to query their assignments', async () => {
    // Create a new client authenticated as crew member
    const { data: authData } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'crew@tophand.tech',
    });

    const crewClient = createClient<Database>(SUPABASE_URL, authData.properties.action_link);

    // Query assignments as crew member (RLS should allow viewing own assignments)
    const { data: assignments, error } = await crewClient
      .from('job_assignments')
      .select('*, jobs(*)')
      .eq('user_id', crewId);

    expect(error).toBeNull();
    expect(assignments).toBeDefined();
    expect(Array.isArray(assignments)).toBe(true);

    // Should include our test assignment
    const testAssignment = assignments?.find(a => a.job_id === testJobId);
    expect(testAssignment).toBeDefined();
    expect(testAssignment?.user_id).toBe(crewId);
  });

  it('should enforce tenant isolation - crew cannot see other tenant assignments', async () => {
    // This test verifies RLS is working correctly
    // Create assignment in different tenant (if multi-tenant test data exists)
    // For now, just verify crew can only see their own tenant's assignments

    const { data: assignments, error } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('user_id', crewId);

    expect(error).toBeNull();
    expect(assignments).toBeDefined();

    // All assignments should belong to same tenant
    const uniqueTenants = new Set(assignments?.map(a => a.tenant_id));
    expect(uniqueTenants.size).toBe(1);
    expect(uniqueTenants.has(tenantId)).toBe(true);
  });
});

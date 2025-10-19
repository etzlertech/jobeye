/**
 * Integration Test: Multiple crew assigned to same job (Scenario 5)
 *
 * Tests multi-crew assignment scenarios:
 * 1. Assign 2+ crew members to the same job
 * 2. Verify both crew see the job in their dashboard
 * 3. Verify concurrent item updates don't conflict
 * 4. Verify job_assignments table has multiple rows for same job_id
 *
 * Task: T012
 * Feature: 010-job-assignment-and
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('T012: Multiple crew assigned to same job', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let crew1Id: string;
  let crew2Id: string;
  let tenantId: string;
  let testJobId: string;
  let assignment1Id: string;
  let assignment2Id: string;
  let crew2UserId: string;

  beforeAll(async () => {
    // Setup
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get first crew user
    const { data: users } = await supabase.auth.admin.listUsers();
    const crew1 = users?.users.find(u => u.email === 'crew@tophand.tech');

    if (!crew1) {
      throw new Error('Crew test user not found');
    }

    crew1Id = crew1.id;
    tenantId = crew1.app_metadata.tenant_id;

    // Create second crew user for testing
    const { data: crew2, error: createError } = await supabase.auth.admin.createUser({
      email: `crew2-${Date.now()}@tophand.tech`,
      password: 'test123',
      email_confirm: true,
      app_metadata: {
        tenant_id: tenantId,
        role: 'technician',
        roles: ['technician', 'crew']
      }
    });

    if (createError || !crew2) {
      throw new Error(`Failed to create crew2: ${createError?.message}`);
    }

    crew2Id = crew2.user.id;
    crew2UserId = crew2.user.id;

    // Create crew2 in users_extended
    await supabase
      .from('users_extended')
      .insert({
        id: crew2Id,
        tenant_id: tenantId,
        role: 'technician',
        display_name: 'Crew Member 2',
        is_active: true
      });

    // Get or create a test customer first
    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    const customerId = customers?.[0]?.id;

    if (!customerId) {
      throw new Error('No customers found for tenant. Create test customer first.');
    }

    // Create a test job (schedule far in future to avoid double-booking)
    const futureDate = new Date(Date.now() + 86400000 * 30); // 30 days from now
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        job_number: `JOB-T012-${Date.now()}`,
        status: 'scheduled',
        priority: 'high',
        title: 'Multi-Crew Test Job',
        scheduled_start: futureDate.toISOString(),
        scheduled_end: new Date(futureDate.getTime() + 14400000).toISOString(),
      })
      .select('id')
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create test job: ${jobError?.message}`);
    }

    testJobId = job.id;
  });

  afterAll(async () => {
    // Cleanup
    if (assignment1Id) {
      await supabase.from('job_assignments').delete().eq('id', assignment1Id);
    }
    if (assignment2Id) {
      await supabase.from('job_assignments').delete().eq('id', assignment2Id);
    }
    if (testJobId) {
      await supabase.from('jobs').delete().eq('id', testJobId);
    }
    if (crew2UserId) {
      await supabase.from('users_extended').delete().eq('id', crew2UserId);
      await supabase.auth.admin.deleteUser(crew2UserId);
    }
  });

  it('should allow assigning multiple crew members to same job', async () => {
    // Assign crew1 to job
    const { data: assignment1, error: error1 } = await supabase
      .from('job_assignments')
      .insert({
        tenant_id: tenantId,
        job_id: testJobId,
        user_id: crew1Id,
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(error1).toBeNull();
    expect(assignment1).toBeDefined();
    assignment1Id = assignment1!.id;

    // Assign crew2 to same job
    const { data: assignment2, error: error2 } = await supabase
      .from('job_assignments')
      .insert({
        tenant_id: tenantId,
        job_id: testJobId,
        user_id: crew2Id,
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(error2).toBeNull();
    expect(assignment2).toBeDefined();
    assignment2Id = assignment2!.id;

    // Verify both assignments have same job_id
    expect(assignment1?.job_id).toBe(assignment2?.job_id);
    expect(assignment1?.job_id).toBe(testJobId);
  });

  it('should have multiple rows in job_assignments for same job_id', async () => {
    // Query all assignments for this job
    const { data: assignments, error } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('job_id', testJobId);

    expect(error).toBeNull();
    expect(assignments).toBeDefined();
    expect(assignments!.length).toBeGreaterThanOrEqual(2);

    // Verify different user_ids
    const userIds = assignments!.map(a => a.user_id);
    expect(userIds).toContain(crew1Id);
    expect(userIds).toContain(crew2Id);

    // Verify UNIQUE constraint works (tenant_id, job_id, user_id)
    const uniqueKeys = new Set(assignments!.map(a => `${a.tenant_id}:${a.job_id}:${a.user_id}`));
    expect(uniqueKeys.size).toBe(assignments!.length); // No duplicates
  });

  it('should allow crew1 to see job in their assignments', async () => {
    const { data: crew1Assignments, error } = await supabase
      .from('job_assignments')
      .select('*, jobs(*)')
      .eq('user_id', crew1Id)
      .eq('job_id', testJobId);

    expect(error).toBeNull();
    expect(crew1Assignments).toBeDefined();
    expect(crew1Assignments!.length).toBe(1);
    expect(crew1Assignments![0].job_id).toBe(testJobId);
  });

  it('should allow crew2 to see same job in their assignments', async () => {
    const { data: crew2Assignments, error } = await supabase
      .from('job_assignments')
      .select('*, jobs(*)')
      .eq('user_id', crew2Id)
      .eq('job_id', testJobId);

    expect(error).toBeNull();
    expect(crew2Assignments).toBeDefined();
    expect(crew2Assignments!.length).toBe(1);
    expect(crew2Assignments![0].job_id).toBe(testJobId);
  });

  it('should handle concurrent item transactions without conflict', async () => {
    // Get or create a test item first
    const { data: items } = await supabase
      .from('items')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .limit(1);

    const item = items?.[0];

    if (!item) {
      throw new Error('No items found for tenant. Create test item first.');
    }

    // Simulate crew1 creating a check_out transaction
    const { data: transaction1, error: error1 } = await supabase
      .from('item_transactions')
      .insert({
        tenant_id: tenantId,
        job_id: testJobId,
        item_id: item.id,
        transaction_type: 'check_out',
        quantity: 5,
        notes: 'Crew 1 checking out item',
      })
      .select()
      .single();

    expect(error1).toBeNull();
    expect(transaction1).toBeDefined();
    expect(transaction1?.quantity).toBe(5);

    // Simulate crew2 creating another check_out transaction for same item (should succeed)
    const { data: transaction2, error: error2 } = await supabase
      .from('item_transactions')
      .insert({
        tenant_id: tenantId,
        job_id: testJobId,
        item_id: item.id,
        transaction_type: 'check_out',
        quantity: 3,
        notes: 'Crew 2 checking out same item',
      })
      .select()
      .single();

    expect(error2).toBeNull();
    expect(transaction2).toBeDefined();
    expect(transaction2?.quantity).toBe(3);

    // Verify both transactions exist
    const { data: allTransactions, error: queryError } = await supabase
      .from('item_transactions')
      .select('*')
      .eq('job_id', testJobId)
      .eq('item_id', item.id);

    expect(queryError).toBeNull();
    expect(allTransactions).toBeDefined();
    expect(allTransactions!.length).toBeGreaterThanOrEqual(2);

    // Verify total quantity checked out
    const totalQuantity = allTransactions!
      .filter(t => t.transaction_type === 'check_out')
      .reduce((sum, t) => sum + (t.quantity || 0), 0);
    expect(totalQuantity).toBeGreaterThanOrEqual(8);

    // Cleanup
    if (transaction1) {
      await supabase.from('item_transactions').delete().eq('id', transaction1.id);
    }
    if (transaction2) {
      await supabase.from('item_transactions').delete().eq('id', transaction2.id);
    }
  });

  it('should prevent duplicate assignments with UNIQUE constraint', async () => {
    // Try to assign crew1 to same job again (should fail or be idempotent)
    const { data: duplicateAssignment, error } = await supabase
      .from('job_assignments')
      .insert({
        tenant_id: tenantId,
        job_id: testJobId,
        user_id: crew1Id,
        assigned_at: new Date().toISOString(),
      })
      .select();

    // Expect error due to UNIQUE constraint (tenant_id, job_id, user_id)
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505'); // Unique violation error code
  });

  it('should update jobs.assigned_to to first crew member', async () => {
    // Query the job to check assigned_to field
    const { data: job, error } = await supabase
      .from('jobs')
      .select('assigned_to')
      .eq('id', testJobId)
      .single();

    expect(error).toBeNull();
    expect(job).toBeDefined();

    // assigned_to should be one of the crew members (sync trigger behavior)
    expect([crew1Id, crew2Id]).toContain(job?.assigned_to);
  });

  it('should return assignment count when querying job', async () => {
    // Query job with assignment count
    const { data: job, error, count } = await supabase
      .from('job_assignments')
      .select('*', { count: 'exact', head: false })
      .eq('job_id', testJobId);

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(job).toBeDefined();
    expect(job!.length).toBe(count);
  });
});

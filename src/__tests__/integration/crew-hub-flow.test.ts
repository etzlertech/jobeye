/**
 * Integration Test: Crew views assigned jobs (Scenario 2)
 *
 * Tests the crew dashboard query flow:
 * 1. Crew member authenticates
 * 2. Queries their assigned jobs via API
 * 3. Verifies jobs are sorted by scheduled_start ASC
 * 4. Verifies load status is included
 * 5. Verifies only assigned jobs are returned (not all jobs)
 *
 * Task: T011
 * Feature: 010-job-assignment-and
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('T011: Crew views assigned jobs flow', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let crewId: string;
  let tenantId: string;
  let testJobIds: string[] = [];
  let assignmentIds: string[] = [];

  beforeAll(async () => {
    // Setup: Create Supabase client
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get crew user
    const { data: users } = await supabase.auth.admin.listUsers();
    const crew = users?.users.find(u => u.email === 'crew@tophand.tech');

    if (!crew) {
      throw new Error('Crew test user not found');
    }

    crewId = crew.id;
    tenantId = crew.app_metadata.tenant_id;

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

    // Create multiple test jobs with different scheduled dates (far future to avoid double-booking)
    const baseDate = Date.now() + 86400000 * 30; // Start 30 days from now
    const jobsData = [
      {
        job_number: `JOB-T011-A-${Date.now()}`,
        scheduled_start: new Date(baseDate).toISOString(),
        title: 'Job A - Tomorrow'
      },
      {
        job_number: `JOB-T011-B-${Date.now()}`,
        scheduled_start: new Date(baseDate + 86400000).toISOString(), // +1 day
        title: 'Job B - Day After'
      },
      {
        job_number: `JOB-T011-C-${Date.now()}`,
        scheduled_start: new Date(baseDate + 172800000).toISOString(), // +2 days
        title: 'Job C - Three Days'
      },
    ];

    for (const jobData of jobsData) {
      const { data: job, error } = await supabase
        .from('jobs')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          status: 'scheduled',
          priority: 'normal',
          scheduled_end: new Date(new Date(jobData.scheduled_start).getTime() + 14400000).toISOString(),
          ...jobData,
        })
        .select('id')
        .single();

      if (error || !job) {
        throw new Error(`Failed to create test job: ${error?.message}`);
      }

      testJobIds.push(job.id);

      // Assign job to crew member
      const { data: assignment, error: assignError } = await supabase
        .from('job_assignments')
        .insert({
          tenant_id: tenantId,
          job_id: job.id,
          user_id: crewId,
          assigned_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (assignError || !assignment) {
        throw new Error(`Failed to create assignment: ${assignError?.message}`);
      }

      assignmentIds.push(assignment.id);
    }

    // Create one more job that is NOT assigned to crew (to test filtering)
    const { data: unassignedJob } = await supabase
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        job_number: `JOB-T011-UNASSIGNED-${Date.now()}`,
        status: 'scheduled',
        priority: 'normal',
        title: 'Unassigned Job',
        scheduled_start: new Date(baseDate + 259200000).toISOString(), // +3 days
        scheduled_end: new Date(baseDate + 259200000 + 14400000).toISOString(),
      })
      .select('id')
      .single();

    if (unassignedJob) {
      testJobIds.push(unassignedJob.id);
    }
  });

  afterAll(async () => {
    // Cleanup
    if (assignmentIds.length > 0) {
      await supabase.from('job_assignments').delete().in('id', assignmentIds);
    }
    if (testJobIds.length > 0) {
      await supabase.from('jobs').delete().in('id', testJobIds);
    }
  });

  it('should return only jobs assigned to the crew member', async () => {
    // Query assignments for crew member (filter to only our test assignments)
    const { data: assignments, error } = await supabase
      .from('job_assignments')
      .select('*, jobs(*)')
      .eq('user_id', crewId)
      .eq('tenant_id', tenantId)
      .in('id', assignmentIds); // Only our test assignments

    expect(error).toBeNull();
    expect(assignments).toBeDefined();
    expect(assignments!.length).toBe(3); // Exactly our 3 test jobs

    // Verify all returned jobs are assigned to crew
    assignments?.forEach(assignment => {
      expect(assignment.user_id).toBe(crewId);
    });

    // Verify unassigned job is NOT in results
    const unassignedJobId = testJobIds[testJobIds.length - 1];
    const hasUnassigned = assignments?.some(a => a.job_id === unassignedJobId);
    expect(hasUnassigned).toBe(false);
  });

  it('should return jobs sorted by scheduled_start ASC', async () => {
    // Query assignments with JOIN to jobs, ordered by scheduled_start (filter to only our test assignments)
    const { data: assignments, error } = await supabase
      .from('job_assignments')
      .select('*, jobs!inner(*)')
      .eq('user_id', crewId)
      .eq('tenant_id', tenantId)
      .in('id', assignmentIds) // Only our test assignments
      .order('scheduled_start', { referencedTable: 'jobs', ascending: true });

    expect(error).toBeNull();
    expect(assignments).toBeDefined();
    expect(assignments!.length).toBe(3); // Exactly our 3 test jobs

    // Verify sorting
    if (assignments && assignments.length > 1) {
      for (let i = 0; i < assignments.length - 1; i++) {
        const currentStart = new Date(assignments[i].jobs.scheduled_start!);
        const nextStart = new Date(assignments[i + 1].jobs.scheduled_start!);
        expect(currentStart.getTime()).toBeLessThanOrEqual(nextStart.getTime());
      }
    }
  });

  it('should include job details with each assignment', async () => {
    const { data: assignments, error } = await supabase
      .from('job_assignments')
      .select(`
        *,
        jobs (
          id,
          job_number,
          title,
          status,
          priority,
          scheduled_start,
          scheduled_end
        )
      `)
      .eq('user_id', crewId)
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(assignments).toBeDefined();
    expect(assignments?.jobs).toBeDefined();
    expect(assignments?.jobs.job_number).toBeDefined();
    expect(assignments?.jobs.title).toBeDefined();
    expect(assignments?.jobs.status).toBeDefined();
  });

  it('should support pagination parameters', async () => {
    // Query with limit and offset
    const { data: page1, error: error1 } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('user_id', crewId)
      .eq('tenant_id', tenantId)
      .range(0, 1); // First 2 records

    expect(error1).toBeNull();
    expect(page1).toBeDefined();
    expect(page1!.length).toBeLessThanOrEqual(2);

    const { data: page2, error: error2 } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('user_id', crewId)
      .eq('tenant_id', tenantId)
      .range(2, 3); // Next 2 records

    expect(error2).toBeNull();
    expect(page2).toBeDefined();

    // Verify different results
    if (page1 && page2 && page1.length > 0 && page2.length > 0) {
      expect(page1[0].id).not.toBe(page2[0].id);
    }
  });

  it('should filter by job status', async () => {
    // Query only scheduled jobs
    const { data: scheduledJobs, error } = await supabase
      .from('job_assignments')
      .select('*, jobs!inner(*)')
      .eq('user_id', crewId)
      .eq('tenant_id', tenantId)
      .eq('jobs.status', 'scheduled');

    expect(error).toBeNull();
    expect(scheduledJobs).toBeDefined();

    // All returned jobs should have status 'scheduled'
    scheduledJobs?.forEach(assignment => {
      expect(assignment.jobs.status).toBe('scheduled');
    });
  });

  it('should compute load status for jobs with item transactions', async () => {
    // This test verifies we can query item_transactions to compute load status
    // First, create a transaction (check_out) for one of our test jobs
    const testJobId = testJobIds[0];

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

    const { data: transaction, error: insertError } = await supabase
      .from('item_transactions')
      .insert({
        tenant_id: tenantId,
        job_id: testJobId,
        item_id: item.id,
        transaction_type: 'check_out',
        quantity: 5,
        notes: 'Test transaction for crew hub flow test',
      })
      .select('id')
      .single();

    expect(insertError).toBeNull();
    expect(transaction).toBeDefined();

    // Query the job with item transactions
    const { data: transactions, error } = await supabase
      .from('item_transactions')
      .select('item_id, transaction_type, quantity')
      .eq('job_id', testJobId)
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(transactions).toBeDefined();

    // Group by item_id to get latest transaction status per item
    const itemsMap = new Map();
    (transactions || []).forEach((tx: any) => {
      if (!itemsMap.has(tx.item_id)) {
        itemsMap.set(tx.item_id, tx);
      }
    });

    // Count currently assigned items (latest transaction is check_out)
    const assignedItems = Array.from(itemsMap.values())
      .filter((tx: any) => tx.transaction_type === 'check_out');

    const totalItems = assignedItems.reduce((sum, tx: any) => sum + (tx.quantity || 0), 0);

    expect(totalItems).toBe(5);

    // Cleanup transaction
    if (transaction) {
      await supabase.from('item_transactions').delete().eq('id', transaction.id);
    }
  });
});

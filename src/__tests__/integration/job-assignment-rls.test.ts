/**
 * RLS Security Tests: job_assignments table
 *
 * Tests Row Level Security policies:
 * T013: Tenant isolation - users can only see their tenant's data
 * T014: Crew can only view own assignments
 *
 * RLS Policies tested:
 * - tenant_isolation (ALL operations)
 * - crew_view_own_assignments (SELECT)
 * - supervisor_insert_assignments (INSERT)
 * - supervisor_delete_assignments (DELETE)
 *
 * Tasks: T013, T014
 * Feature: 010-job-assignment-and
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('T013: RLS - Tenant isolation on job_assignments', () => {
  let supabaseService: ReturnType<typeof createClient<Database>>;
  let tenant1Id: string;
  let tenant2Id: string;
  let tenant1UserId: string;
  let tenant2UserId: string;
  let tenant1JobId: string;
  let tenant2JobId: string;
  let tenant1AssignmentId: string;
  let tenant2AssignmentId: string;

  beforeAll(async () => {
    // Setup with service role (bypass RLS)
    supabaseService = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get existing tenant
    const { data: tenant1 } = await supabaseService
      .from('tenants')
      .select('id')
      .limit(1)
      .single();

    tenant1Id = tenant1!.id;

    // Create second tenant
    const { data: tenant2, error: tenant2Error } = await supabaseService
      .from('tenants')
      .insert({
        name: `RLS Test Tenant ${Date.now()}`,
        slug: `rls-test-${Date.now()}`,
      })
      .select('id')
      .single();

    if (tenant2Error) {
      throw new Error(`Failed to create tenant2: ${tenant2Error.message}`);
    }

    tenant2Id = tenant2.id;

    // Create user in tenant1
    const { data: user1, error: user1Error } = await supabaseService.auth.admin.createUser({
      email: `tenant1-crew-${Date.now()}@test.com`,
      password: 'test123',
      email_confirm: true,
      app_metadata: {
        tenant_id: tenant1Id,
        role: 'technician',
        roles: ['technician']
      }
    });

    if (user1Error) {
      throw new Error(`Failed to create user1: ${user1Error.message}`);
    }

    tenant1UserId = user1.user.id;

    // Create user in tenant2
    const { data: user2, error: user2Error } = await supabaseService.auth.admin.createUser({
      email: `tenant2-crew-${Date.now()}@test.com`,
      password: 'test123',
      email_confirm: true,
      app_metadata: {
        tenant_id: tenant2Id,
        role: 'technician',
        roles: ['technician']
      }
    });

    if (user2Error) {
      throw new Error(`Failed to create user2: ${user2Error.message}`);
    }

    tenant2UserId = user2.user.id;

    // Create users_extended entries
    await supabaseService.from('users_extended').insert([
      {
        id: tenant1UserId,
        tenant_id: tenant1Id,
        role: 'technician',
        display_name: 'Tenant 1 Crew',
        is_active: true
      },
      {
        id: tenant2UserId,
        tenant_id: tenant2Id,
        role: 'technician',
        display_name: 'Tenant 2 Crew',
        is_active: true
      }
    ]);

    // Get or create customers for each tenant
    const { data: customers1 } = await supabaseService
      .from('customers')
      .select('id')
      .eq('tenant_id', tenant1Id)
      .limit(1);

    const customer1Id = customers1?.[0]?.id;

    if (!customer1Id) {
      throw new Error('No customers found for tenant1. Create test customer first.');
    }

    const { data: customers2 } = await supabaseService
      .from('customers')
      .select('id')
      .eq('tenant_id', tenant2Id)
      .limit(1);

    let customer2Id = customers2?.[0]?.id;

    // If no customer in tenant2, create one
    if (!customer2Id) {
      const { data: newCustomer, error: customerError } = await supabaseService
        .from('customers')
        .insert({
          tenant_id: tenant2Id,
          name: 'RLS Test Customer',
          email: 'test@rls.com',
          status: 'active'
        })
        .select('id')
        .single();

      if (customerError || !newCustomer) {
        throw new Error(`Failed to create customer for tenant2: ${customerError?.message}`);
      }

      customer2Id = newCustomer.id;
    }

    // Create jobs in each tenant (schedule far in future to avoid double-booking)
    const futureDate = new Date(Date.now() + 86400000 * 30); // 30 days from now
    const { data: job1 } = await supabaseService
      .from('jobs')
      .insert({
        tenant_id: tenant1Id,
        customer_id: customer1Id,
        job_number: `JOB-T013-T1-${Date.now()}`,
        status: 'scheduled',
        priority: 'normal',
        title: 'Tenant 1 Job',
        scheduled_start: futureDate.toISOString(),
        scheduled_end: new Date(futureDate.getTime() + 14400000).toISOString(),
      })
      .select('id')
      .single();

    tenant1JobId = job1!.id;

    const { data: job2 } = await supabaseService
      .from('jobs')
      .insert({
        tenant_id: tenant2Id,
        customer_id: customer2Id,
        job_number: `JOB-T013-T2-${Date.now()}`,
        status: 'scheduled',
        priority: 'normal',
        title: 'Tenant 2 Job',
        scheduled_start: new Date(futureDate.getTime() + 86400000).toISOString(), // +1 day
        scheduled_end: new Date(futureDate.getTime() + 86400000 + 14400000).toISOString(),
      })
      .select('id')
      .single();

    tenant2JobId = job2!.id;

    // Create assignments in each tenant
    const { data: assignment1 } = await supabaseService
      .from('job_assignments')
      .insert({
        tenant_id: tenant1Id,
        job_id: tenant1JobId,
        user_id: tenant1UserId,
        assigned_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    tenant1AssignmentId = assignment1!.id;

    const { data: assignment2 } = await supabaseService
      .from('job_assignments')
      .insert({
        tenant_id: tenant2Id,
        job_id: tenant2JobId,
        user_id: tenant2UserId,
        assigned_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    tenant2AssignmentId = assignment2!.id;
  });

  afterAll(async () => {
    // Cleanup
    if (tenant1AssignmentId) {
      await supabaseService.from('job_assignments').delete().eq('id', tenant1AssignmentId);
    }
    if (tenant2AssignmentId) {
      await supabaseService.from('job_assignments').delete().eq('id', tenant2AssignmentId);
    }
    if (tenant1JobId) {
      await supabaseService.from('jobs').delete().eq('id', tenant1JobId);
    }
    if (tenant2JobId) {
      await supabaseService.from('jobs').delete().eq('id', tenant2JobId);
    }
    if (tenant1UserId) {
      await supabaseService.from('users_extended').delete().eq('id', tenant1UserId);
      await supabaseService.auth.admin.deleteUser(tenant1UserId);
    }
    if (tenant2UserId) {
      await supabaseService.from('users_extended').delete().eq('id', tenant2UserId);
      await supabaseService.auth.admin.deleteUser(tenant2UserId);
    }
    if (tenant2Id) {
      await supabaseService.from('tenants').delete().eq('id', tenant2Id);
    }
  });

  it('should enforce tenant isolation - tenant1 user cannot see tenant2 assignments', async () => {
    // Create authenticated client for tenant1 user
    const { data: session1 } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: `tenant1-crew-${tenant1UserId}@test.com`,
    });

    const tenant1Client = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Sign in as tenant1 user
    const { error: signInError } = await tenant1Client.auth.setSession({
      access_token: session1.properties.action_link.split('token=')[1].split('&')[0],
      refresh_token: ''
    });

    if (signInError) {
      console.warn('Sign in error:', signInError);
    }

    // Try to query tenant2's assignment
    const { data: assignments, error } = await tenant1Client
      .from('job_assignments')
      .select('*');

    expect(error).toBeNull();
    expect(assignments).toBeDefined();

    // Should NOT include tenant2's assignment
    const hasTenant2Assignment = assignments?.some(a => a.id === tenant2AssignmentId);
    expect(hasTenant2Assignment).toBe(false);

    // Should only see tenant1's assignments
    assignments?.forEach(assignment => {
      expect(assignment.tenant_id).toBe(tenant1Id);
    });
  });

  it('should enforce tenant isolation - tenant2 user cannot see tenant1 assignments', async () => {
    // Create authenticated client for tenant2 user
    const { data: session2 } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: `tenant2-crew-${tenant2UserId}@test.com`,
    });

    const tenant2Client = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Sign in as tenant2 user
    await tenant2Client.auth.setSession({
      access_token: session2.properties.action_link.split('token=')[1].split('&')[0],
      refresh_token: ''
    });

    // Try to query assignments
    const { data: assignments, error } = await tenant2Client
      .from('job_assignments')
      .select('*');

    expect(error).toBeNull();
    expect(assignments).toBeDefined();

    // Should NOT include tenant1's assignment
    const hasTenant1Assignment = assignments?.some(a => a.id === tenant1AssignmentId);
    expect(hasTenant1Assignment).toBe(false);

    // Should only see tenant2's assignments
    assignments?.forEach(assignment => {
      expect(assignment.tenant_id).toBe(tenant2Id);
    });
  });

  it('should prevent cross-tenant INSERT attempts', async () => {
    // Try to insert assignment for tenant2 job while authenticated as tenant1 user
    const { data: session1 } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: `tenant1-crew-${tenant1UserId}@test.com`,
    });

    const tenant1Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await tenant1Client.auth.setSession({
      access_token: session1.properties.action_link.split('token=')[1].split('&')[0],
      refresh_token: ''
    });

    // Try to insert assignment in tenant2
    const { data, error } = await tenant1Client
      .from('job_assignments')
      .insert({
        tenant_id: tenant2Id,
        job_id: tenant2JobId,
        user_id: tenant1UserId,
        assigned_at: new Date().toISOString(),
      });

    // Should fail due to RLS policy
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

describe('T014: RLS - Crew can only view own assignments', () => {
  let supabaseService: ReturnType<typeof createClient<Database>>;
  let tenantId: string;
  let crew1Id: string;
  let crew2Id: string;
  let job1Id: string;
  let job2Id: string;
  let assignment1Id: string;
  let assignment2Id: string;
  let supervisorId: string;

  beforeAll(async () => {
    supabaseService = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get existing tenant
    const { data: tenant } = await supabaseService
      .from('tenants')
      .select('id')
      .limit(1)
      .single();

    tenantId = tenant!.id;

    // Create 2 crew members in same tenant
    const { data: crew1 } = await supabaseService.auth.admin.createUser({
      email: `crew1-${Date.now()}@test.com`,
      password: 'test123',
      email_confirm: true,
      app_metadata: {
        tenant_id: tenantId,
        role: 'technician',
        roles: ['technician']
      }
    });

    crew1Id = crew1!.user.id;

    const { data: crew2 } = await supabaseService.auth.admin.createUser({
      email: `crew2-${Date.now()}@test.com`,
      password: 'test123',
      email_confirm: true,
      app_metadata: {
        tenant_id: tenantId,
        role: 'technician',
        roles: ['technician']
      }
    });

    crew2Id = crew2!.user.id;

    // Create supervisor in same tenant
    const { data: supervisor } = await supabaseService.auth.admin.createUser({
      email: `supervisor-${Date.now()}@test.com`,
      password: 'test123',
      email_confirm: true,
      app_metadata: {
        tenant_id: tenantId,
        role: 'supervisor',
        roles: ['supervisor']
      }
    });

    supervisorId = supervisor!.user.id;

    // Create users_extended entries
    await supabaseService.from('users_extended').insert([
      {
        id: crew1Id,
        tenant_id: tenantId,
        role: 'technician',
        display_name: 'Crew 1',
        is_active: true
      },
      {
        id: crew2Id,
        tenant_id: tenantId,
        role: 'technician',
        display_name: 'Crew 2',
        is_active: true
      },
      {
        id: supervisorId,
        tenant_id: tenantId,
        role: 'manager',
        display_name: 'Supervisor',
        is_active: true
      }
    ]);

    // Get or create a customer
    const { data: customers } = await supabaseService
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    const customerId = customers?.[0]?.id;

    if (!customerId) {
      throw new Error('No customers found for tenant. Create test customer first.');
    }

    // Create 2 jobs (schedule far in future to avoid double-booking)
    const futureDate = new Date(Date.now() + 86400000 * 30); // 30 days from now
    const { data: job1 } = await supabaseService
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        job_number: `JOB-T014-1-${Date.now()}`,
        status: 'scheduled',
        priority: 'normal',
        title: 'Job for Crew 1',
        scheduled_start: futureDate.toISOString(),
        scheduled_end: new Date(futureDate.getTime() + 14400000).toISOString(),
      })
      .select('id')
      .single();

    job1Id = job1!.id;

    const { data: job2 } = await supabaseService
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        job_number: `JOB-T014-2-${Date.now()}`,
        status: 'scheduled',
        priority: 'normal',
        title: 'Job for Crew 2',
        scheduled_start: new Date(futureDate.getTime() + 86400000).toISOString(), // +1 day
        scheduled_end: new Date(futureDate.getTime() + 86400000 + 14400000).toISOString(),
      })
      .select('id')
      .single();

    job2Id = job2!.id;

    // Assign job1 to crew1
    const { data: assignment1 } = await supabaseService
      .from('job_assignments')
      .insert({
        tenant_id: tenantId,
        job_id: job1Id,
        user_id: crew1Id,
        assigned_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    assignment1Id = assignment1!.id;

    // Assign job2 to crew2
    const { data: assignment2 } = await supabaseService
      .from('job_assignments')
      .insert({
        tenant_id: tenantId,
        job_id: job2Id,
        user_id: crew2Id,
        assigned_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    assignment2Id = assignment2!.id;
  });

  afterAll(async () => {
    // Cleanup
    if (assignment1Id) await supabaseService.from('job_assignments').delete().eq('id', assignment1Id);
    if (assignment2Id) await supabaseService.from('job_assignments').delete().eq('id', assignment2Id);
    if (job1Id) await supabaseService.from('jobs').delete().eq('id', job1Id);
    if (job2Id) await supabaseService.from('jobs').delete().eq('id', job2Id);
    if (crew1Id) {
      await supabaseService.from('users_extended').delete().eq('id', crew1Id);
      await supabaseService.auth.admin.deleteUser(crew1Id);
    }
    if (crew2Id) {
      await supabaseService.from('users_extended').delete().eq('id', crew2Id);
      await supabaseService.auth.admin.deleteUser(crew2Id);
    }
    if (supervisorId) {
      await supabaseService.from('users_extended').delete().eq('id', supervisorId);
      await supabaseService.auth.admin.deleteUser(supervisorId);
    }
  });

  it('should allow crew1 to see only their own assignments', async () => {
    // Authenticate as crew1
    const { data: session1 } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: `crew1-${crew1Id}@test.com`,
    });

    const crew1Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await crew1Client.auth.setSession({
      access_token: session1.properties.action_link.split('token=')[1].split('&')[0],
      refresh_token: ''
    });

    // Query assignments
    const { data: assignments, error } = await crew1Client
      .from('job_assignments')
      .select('*');

    expect(error).toBeNull();
    expect(assignments).toBeDefined();

    // Should only see their own assignments
    assignments?.forEach(assignment => {
      expect(assignment.user_id).toBe(crew1Id);
    });

    // Should NOT see crew2's assignment
    const hasCrew2Assignment = assignments?.some(a => a.id === assignment2Id);
    expect(hasCrew2Assignment).toBe(false);
  });

  it('should allow crew2 to see only their own assignments', async () => {
    // Authenticate as crew2
    const { data: session2 } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: `crew2-${crew2Id}@test.com`,
    });

    const crew2Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await crew2Client.auth.setSession({
      access_token: session2.properties.action_link.split('token=')[1].split('&')[0],
      refresh_token: ''
    });

    // Query assignments
    const { data: assignments, error } = await crew2Client
      .from('job_assignments')
      .select('*');

    expect(error).toBeNull();
    expect(assignments).toBeDefined();

    // Should only see their own assignments
    assignments?.forEach(assignment => {
      expect(assignment.user_id).toBe(crew2Id);
    });

    // Should NOT see crew1's assignment
    const hasCrew1Assignment = assignments?.some(a => a.id === assignment1Id);
    expect(hasCrew1Assignment).toBe(false);
  });

  it('should allow supervisor to see all assignments in their tenant', async () => {
    // Authenticate as supervisor
    const { data: sessionSup } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: `supervisor-${supervisorId}@test.com`,
    });

    const supervisorClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await supervisorClient.auth.setSession({
      access_token: sessionSup.properties.action_link.split('token=')[1].split('&')[0],
      refresh_token: ''
    });

    // Query all assignments
    const { data: assignments, error } = await supervisorClient
      .from('job_assignments')
      .select('*')
      .eq('tenant_id', tenantId);

    expect(error).toBeNull();
    expect(assignments).toBeDefined();

    // Should see both crew1 and crew2 assignments
    const assignmentIds = assignments?.map(a => a.id) || [];
    expect(assignmentIds).toContain(assignment1Id);
    expect(assignmentIds).toContain(assignment2Id);
  });

  it('should prevent crew from querying other crew assignments via SELECT', async () => {
    // Authenticate as crew1
    const { data: session1 } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: `crew1-${crew1Id}@test.com`,
    });

    const crew1Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await crew1Client.auth.setSession({
      access_token: session1.properties.action_link.split('token=')[1].split('&')[0],
      refresh_token: ''
    });

    // Try to query crew2's specific assignment
    const { data: assignment, error } = await crew1Client
      .from('job_assignments')
      .select('*')
      .eq('id', assignment2Id)
      .single();

    // Should return null or empty due to RLS filtering
    expect(assignment).toBeNull();
    expect(error).not.toBeNull(); // Row not found or policy violation
  });
});

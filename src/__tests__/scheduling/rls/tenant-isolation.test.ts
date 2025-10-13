/**
 * @file /src/__tests__/scheduling/rls/tenant-isolation.test.ts
 * @purpose RLS test: Multi-tenant data isolation
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// These will fail with "Cannot find module" - as expected for TDD
import { createTestUser, createTestCompany, cleanupTestData } from '@/test/utils/test-helpers';
import type { Database } from '@/types/database';

describe('Multi-tenant RLS Isolation', () => {
  let adminClient: SupabaseClient<Database>;
  let companyAClient: SupabaseClient<Database>;
  let companyBClient: SupabaseClient<Database>;
  
  const companyAId = '00000000-0000-4000-a000-000000000001';
  const companyBId = '00000000-0000-4000-a000-000000000002';
  let userAId: string;
  let userBId: string;
  let testDataIds: string[] = [];

  beforeEach(async () => {
    // Admin client with service role
    adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Create test companies
    await createTestCompany(adminClient, {
      id: companyAId,
      name: 'Company A',
      domain: 'company-a.test'
    });

    await createTestCompany(adminClient, {
      id: companyBId,
      name: 'Company B',
      domain: 'company-b.test'
    });

    // Create test users
    const userA = await createTestUser(adminClient, {
      email: 'user-a@company-a.test',
      tenant_id: companyAId
    });
    userAId = userA.id;

    const userB = await createTestUser(adminClient, {
      email: 'user-b@company-b.test',
      tenant_id: companyBId
    });
    userBId = userB.id;

    // Create authenticated clients for each company
    companyAClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${userA.access_token}`
          }
        }
      }
    );

    companyBClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${userB.access_token}`
          }
        }
      }
    );
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData(adminClient, testDataIds);
  });

  it('should isolate day_plans between companies', async () => {
    // Company A creates a day plan
    const { data: planA, error: errorA } = await companyAClient
      .from('day_plans')
      .insert({
        tenant_id: companyAId,
        user_id: userAId,
        plan_date: '2024-01-15',
        status: 'draft'
      })
      .select()
      .single();

    expect(errorA).toBeNull();
    expect(planA).toBeDefined();
    testDataIds.push(planA!.id);

    // Company B creates a day plan
    const { data: planB, error: errorB } = await companyBClient
      .from('day_plans')
      .insert({
        tenant_id: companyBId,
        user_id: userBId,
        plan_date: '2024-01-15',
        status: 'draft'
      })
      .select()
      .single();

    expect(errorB).toBeNull();
    expect(planB).toBeDefined();
    testDataIds.push(planB!.id);

    // Company A can only see their own plan
    const { data: companyAPlans } = await companyAClient
      .from('day_plans')
      .select('*');

    expect(companyAPlans).toHaveLength(1);
    expect(companyAPlans![0].id).toBe(planA!.id);

    // Company B can only see their own plan
    const { data: companyBPlans } = await companyBClient
      .from('day_plans')
      .select('*');

    expect(companyBPlans).toHaveLength(1);
    expect(companyBPlans![0].id).toBe(planB!.id);

    // Company A cannot read Company B's plan directly
    const { data: crossRead, error: crossError } = await companyAClient
      .from('day_plans')
      .select('*')
      .eq('id', planB!.id)
      .single();

    expect(crossRead).toBeNull();
    // RLS should silently filter out the row
    expect(crossError?.code).toBe('PGRST116'); // Row not found
  });

  it('should prevent cross-company updates', async () => {
    // Company A creates a kit
    const { data: kitA } = await companyAClient
      .from('kits')
      .insert({
        tenant_id: companyAId,
        kit_code: 'KIT-A-001',
        name: 'Company A Kit',
        category: 'general'
      })
      .select()
      .single();

    testDataIds.push(kitA!.id);

    // Company B tries to update Company A's kit
    const { error: updateError } = await companyBClient
      .from('kits')
      .update({ name: 'Hacked Kit Name' })
      .eq('id', kitA!.id);

    // Update should fail silently (no rows matched due to RLS)
    expect(updateError).toBeNull();

    // Verify kit name unchanged
    const { data: verifyKit } = await companyAClient
      .from('kits')
      .select('name')
      .eq('id', kitA!.id)
      .single();

    expect(verifyKit!.name).toBe('Company A Kit');
  });

  it('should prevent cross-company deletes', async () => {
    // Company A creates a schedule event  
    const { data: eventA } = await companyAClient
      .from('schedule_events')
      .insert({
        tenant_id: companyAId,
        day_plan_id: uuidv4(),
        event_type: 'job',
        sequence_order: 1,
        scheduled_start: '2024-01-15T09:00:00Z',
        scheduled_duration_minutes: 60
      })
      .select()
      .single();

    testDataIds.push(eventA!.id);

    // Company B tries to delete Company A's event
    const { error: deleteError } = await companyBClient
      .from('schedule_events')
      .delete()
      .eq('id', eventA!.id);

    // Delete should fail silently
    expect(deleteError).toBeNull();

    // Verify event still exists
    const { data: verifyEvent } = await companyAClient
      .from('schedule_events')
      .select('id')
      .eq('id', eventA!.id)
      .single();

    expect(verifyEvent).toBeDefined();
  });

  it('should isolate kit assignments between companies', async () => {
    // Each company creates a kit
    const { data: kitA } = await companyAClient
      .from('kits')
      .insert({
        tenant_id: companyAId,
        kit_code: 'SHARED-001',
        name: 'Shared Kit Name'
      })
      .select()
      .single();

    const { data: kitB } = await companyBClient
      .from('kits')
      .insert({
        tenant_id: companyBId,
        kit_code: 'SHARED-001', // Same code, different company
        name: 'Shared Kit Name'
      })
      .select()
      .single();

    testDataIds.push(kitA!.id, kitB!.id);

    // Create job assignments
    const { data: assignA } = await companyAClient
      .from('job_kits')
      .insert({
        tenant_id: companyAId,
        job_id: uuidv4(),
        kit_id: kitA!.id,
        assigned_by: userAId
      })
      .select()
      .single();

    const { data: assignB } = await companyBClient
      .from('job_kits')
      .insert({
        tenant_id: companyBId,
        job_id: uuidv4(),
        kit_id: kitB!.id,
        assigned_by: userBId
      })
      .select()
      .single();

    testDataIds.push(assignA!.id, assignB!.id);

    // Each company can only see their assignments
    const { data: companyAAssignments } = await companyAClient
      .from('job_kits')
      .select('*');

    expect(companyAAssignments).toHaveLength(1);
    expect(companyAAssignments![0].kit_id).toBe(kitA!.id);

    // Company A cannot assign Company B's kit
    const { error: crossAssignError } = await companyAClient
      .from('job_kits')
      .insert({
        tenant_id: companyAId,
        job_id: uuidv4(),
        kit_id: kitB!.id, // Trying to use Company B's kit
        assigned_by: userAId
      });

    expect(crossAssignError).toBeDefined();
    expect(crossAssignError!.code).toBe('23503'); // Foreign key violation
  });

  it('should isolate kit override logs between companies', async () => {
    // Create override logs for each company
    const { data: overrideA } = await companyAClient
      .from('kit_override_logs')
      .insert({
        tenant_id: companyAId,
        job_id: uuidv4(),
        kit_id: uuidv4(),
        item_id: uuidv4(),
        technician_id: userAId,
        override_reason: 'Company A reason'
      })
      .select()
      .single();

    const { data: overrideB } = await companyBClient
      .from('kit_override_logs')
      .insert({
        tenant_id: companyBId,
        job_id: uuidv4(),
        kit_id: uuidv4(),
        item_id: uuidv4(),
        technician_id: userBId,
        override_reason: 'Company B reason'
      })
      .select()
      .single();

    testDataIds.push(overrideA!.id, overrideB!.id);

    // Company A can only see their overrides
    const { data: companyAOverrides } = await companyAClient
      .from('kit_override_logs')
      .select('*');

    expect(companyAOverrides).toHaveLength(1);
    expect(companyAOverrides![0].override_reason).toBe('Company A reason');

    // Analytics should only include own company data
    const { data: analyticsA } = await companyAClient
      .rpc('get_override_analytics', {
        start_date: '2024-01-01',
        end_date: '2024-12-31'
      });

    expect(analyticsA.total_overrides).toBe(1);
    expect(analyticsA.tenant_id).toBe(companyAId);
  });

  it('should enforce tenant_id consistency in nested operations', async () => {
    // Create day plan as Company A
    const { data: dayPlan } = await companyAClient
      .from('day_plans')
      .insert({
        tenant_id: companyAId,
        user_id: userAId,
        plan_date: '2024-01-15'
      })
      .select()
      .single();

    testDataIds.push(dayPlan!.id);

    // Try to create schedule event with mismatched tenant_id
    const { error: mismatchError } = await companyAClient
      .from('schedule_events')
      .insert({
        tenant_id: companyBId, // Wrong company!
        day_plan_id: dayPlan!.id,
        event_type: 'job',
        sequence_order: 1
      });

    expect(mismatchError).toBeDefined();
    // Should be blocked by RLS check constraint

    // Create with correct tenant_id
    const { data: validEvent } = await companyAClient
      .from('schedule_events')
      .insert({
        tenant_id: companyAId,
        day_plan_id: dayPlan!.id,
        event_type: 'job',
        sequence_order: 1,
        scheduled_start: '2024-01-15T09:00:00Z',
        scheduled_duration_minutes: 60
      })
      .select()
      .single();

    expect(validEvent).toBeDefined();
    testDataIds.push(validEvent!.id);
  });

  it('should handle service role bypass correctly', async () => {
    // Service role can see all companies' data
    const { data: allDayPlans } = await adminClient
      .from('day_plans')
      .select('*')
      .in('tenant_id', [companyAId, companyBId]);

    // Create test data first
    await adminClient
      .from('day_plans')
      .insert([
        { tenant_id: companyAId, user_id: userAId, plan_date: '2024-01-15' },
        { tenant_id: companyBId, user_id: userBId, plan_date: '2024-01-15' }
      ]);

    const { data: verifyPlans } = await adminClient
      .from('day_plans')
      .select('tenant_id')
      .in('tenant_id', [companyAId, companyBId]);

    const tenantIds = verifyPlans!.map(p => p.tenant_id);
    expect(tenantIds).toContain(companyAId);
    expect(tenantIds).toContain(companyBId);

    // But regular clients still isolated
    const { data: isolatedA } = await companyAClient
      .from('day_plans')
      .select('tenant_id');

    expect(isolatedA!.every(p => p.tenant_id === companyAId)).toBe(true);
  });
});
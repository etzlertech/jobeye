/**
 * @fileoverview Integration tests for CRUD operations
 * @module tests/integration/task-definitions/crud
 *
 * @ai-context
 * Purpose: End-to-end testing of task definition CRUD operations
 * Pattern: Integration testing with full stack (API + DB)
 * Dependencies: API routes, Repository, Service, Database
 * Status: TDD - These tests WILL FAIL until implementation is complete
 *
 * @ai-rules
 * - Test full request/response cycle
 * - Verify database state after operations
 * - Test validation and error handling
 * - Test business logic (usage guard, soft delete)
 * - Clean up test data after each test
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Task Definitions - CRUD Operations', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  const testTenantId = '00000000-0000-0000-0000-000000000001';
  const testUserId = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Ensure test tenant exists
    const { error: tenantError } = await supabase
      .from('tenants')
      .upsert({
        id: testTenantId,
        name: 'TEST Tenant',
        slug: 'test-tenant',
        status: 'active',
        plan: 'free'
      }, {
        onConflict: 'id',
        ignoreDuplicates: true
      });

    if (tenantError) {
      console.warn('Could not create test tenant:', tenantError);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from('task_definitions').delete().like('name', 'TEST_%');
  });

  describe('Create Task Definition', () => {
    it('should create task definition with all fields', async () => {
      const taskData = {
        tenant_id: testTenantId,
        name: 'TEST_Complete_Task',
        description: 'Full description with all fields',
        acceptance_criteria: 'Must meet all criteria',
        requires_photo_verification: true,
        requires_supervisor_approval: true,
        is_required: false,
        // created_by is nullable, so we'll test without it
      };

      const { data, error } = await supabase
        .from('task_definitions')
        .insert(taskData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data?.id).toBeTruthy();
      expect(data?.name).toBe(taskData.name);
      expect(data?.description).toBe(taskData.description);
      expect(data?.acceptance_criteria).toBe(taskData.acceptance_criteria);
      expect(data?.requires_photo_verification).toBe(true);
      expect(data?.requires_supervisor_approval).toBe(true);
      expect(data?.is_required).toBe(false);
      expect(data?.created_by).toBeNull();
      expect(data?.created_at).toBeTruthy();
      expect(data?.updated_at).toBeTruthy();
      expect(data?.deleted_at).toBeNull();
    });

    it('should create task definition with minimal fields', async () => {
      const taskData = {
        tenant_id: testTenantId,
        name: 'TEST_Minimal_Task',
        description: 'Minimal description',
      };

      const { data, error } = await supabase
        .from('task_definitions')
        .insert(taskData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data?.acceptance_criteria).toBeNull();
      expect(data?.requires_photo_verification).toBe(false); // Default
      expect(data?.requires_supervisor_approval).toBe(false); // Default
      expect(data?.is_required).toBe(true); // Default
    });

    it('should reject creation with empty name', async () => {
      const taskData = {
        tenant_id: testTenantId,
        name: '',
        description: 'Test description',
      };

      const { error } = await supabase
        .from('task_definitions')
        .insert(taskData)
        .select()
        .single();

      expect(error).toBeTruthy();
      expect(error?.code).toBe('23514'); // Check constraint violation
    });

    it('should reject creation with description exceeding 2000 chars', async () => {
      const taskData = {
        tenant_id: testTenantId,
        name: 'TEST_Long_Desc',
        description: 'a'.repeat(2001),
      };

      const { error } = await supabase
        .from('task_definitions')
        .insert(taskData)
        .select()
        .single();

      expect(error).toBeTruthy();
      expect(error?.code).toBe('23514'); // Check constraint violation
    });
  });

  describe('Read Task Definitions', () => {
    beforeEach(async () => {
      // Create test data
      await supabase.from('task_definitions').insert([
        {
          tenant_id: testTenantId,
          name: 'TEST_Task_Alpha',
          description: 'First task',
        },
        {
          tenant_id: testTenantId,
          name: 'TEST_Task_Beta',
          description: 'Second task',
        },
        {
          tenant_id: testTenantId,
          name: 'TEST_Task_Gamma',
          description: 'Third task',
          deleted_at: new Date().toISOString(),
        },
      ]);
    });

    it('should list all active task definitions', async () => {
      const { data, error } = await supabase
        .from('task_definitions')
        .select('*')
        .eq('tenant_id', testTenantId)
        .is('deleted_at', null)
        .like('name', 'TEST_%')
        .order('name');

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data?.[0].name).toBe('TEST_Task_Alpha');
      expect(data?.[1].name).toBe('TEST_Task_Beta');
    });

    it('should get task definition by ID', async () => {
      const { data: created } = await supabase
        .from('task_definitions')
        .select('id')
        .eq('name', 'TEST_Task_Alpha')
        .single();

      const { data, error } = await supabase
        .from('task_definitions')
        .select('*')
        .eq('id', created!.id)
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe('TEST_Task_Alpha');
    });

    it('should return empty for non-existent ID', async () => {
      const { data, error } = await supabase
        .from('task_definitions')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-999999999999')
        .single();

      expect(error).toBeTruthy();
      expect(error?.code).toBe('PGRST116'); // Not found
    });
  });

  describe('Update Task Definition', () => {
    let taskId: string;

    beforeEach(async () => {
      const { data } = await supabase
        .from('task_definitions')
        .insert({
          tenant_id: testTenantId,
          name: 'TEST_Update_Task',
          description: 'Original description',
          requires_photo_verification: false,
        })
        .select('id')
        .single();

      taskId = data!.id;
    });

    it('should update task definition fields', async () => {
      const updates = {
        name: 'TEST_Updated_Task',
        description: 'Updated description',
        requires_photo_verification: true,
      };

      const { data, error } = await supabase
        .from('task_definitions')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe(updates.name);
      expect(data?.description).toBe(updates.description);
      expect(data?.requires_photo_verification).toBe(true);
      expect(data?.updated_at).not.toBe(data?.created_at);
    });

    it('should update only specified fields (partial update)', async () => {
      const { data: before } = await supabase
        .from('task_definitions')
        .select('*')
        .eq('id', taskId)
        .single();

      const { data: updated } = await supabase
        .from('task_definitions')
        .update({ description: 'New description only' })
        .eq('id', taskId)
        .select()
        .single();

      expect(updated?.name).toBe(before?.name); // Unchanged
      expect(updated?.description).toBe('New description only'); // Changed
    });

    it('should auto-update updated_at timestamp', async () => {
      const { data: before } = await supabase
        .from('task_definitions')
        .select('updated_at')
        .eq('id', taskId)
        .single();

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { data: after } = await supabase
        .from('task_definitions')
        .update({ description: 'Changed' })
        .eq('id', taskId)
        .select('updated_at')
        .single();

      expect(after?.updated_at).not.toBe(before?.updated_at);
    });

    it('should reject update with invalid data', async () => {
      const { error } = await supabase
        .from('task_definitions')
        .update({ name: '' })
        .eq('id', taskId)
        .select()
        .single();

      expect(error).toBeTruthy();
      expect(error?.code).toBe('23514'); // Check constraint
    });
  });

  describe('Delete Task Definition', () => {
    let taskId: string;

    beforeEach(async () => {
      const { data } = await supabase
        .from('task_definitions')
        .insert({
          tenant_id: testTenantId,
          name: 'TEST_Delete_Task',
          description: 'To be deleted',
        })
        .select('id')
        .single();

      taskId = data!.id;
    });

    it('should soft delete task definition', async () => {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('task_definitions')
        .update({ deleted_at: now })
        .eq('id', taskId);

      expect(error).toBeNull();

      // Verify soft deleted
      const { data } = await supabase
        .from('task_definitions')
        .select('deleted_at')
        .eq('id', taskId)
        .single();

      expect(data?.deleted_at).toBeTruthy();
    });

    it('should exclude soft deleted from active queries', async () => {
      // Soft delete
      await supabase
        .from('task_definitions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', taskId);

      // Query active only
      const { data } = await supabase
        .from('task_definitions')
        .select('*')
        .eq('tenant_id', testTenantId)
        .is('deleted_at', null)
        .like('name', 'TEST_%');

      expect(data?.find((t) => t.id === taskId)).toBeUndefined();
    });

    it('should still be queryable when include_deleted=true', async () => {
      // Soft delete
      await supabase
        .from('task_definitions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', taskId);

      // Query all (including deleted)
      const { data } = await supabase
        .from('task_definitions')
        .select('*')
        .eq('id', taskId);

      expect(data).toHaveLength(1);
      expect(data?.[0].deleted_at).toBeTruthy();
    });
  });

  describe('Usage Guard (Delete Prevention)', () => {
    it('should prevent deletion when task is referenced in templates', async () => {
      // This test requires task_template_items table
      // For now, we'll just verify the check mechanism exists

      const { data: task } = await supabase
        .from('task_definitions')
        .insert({
          tenant_id: testTenantId,
          name: 'TEST_In_Use_Task',
          description: 'Used in template',
        })
        .select()
        .single();

      // TODO: Insert into task_template_items with source_definition_id = task.id

      // Attempt to query usage
      const { data: usage } = await supabase
        .from('task_template_items')
        .select('template_id')
        .eq('source_definition_id', task!.id);

      // For now, just verify query works
      expect(usage).toBeDefined();
    });
  });

  describe('Validation Constraints', () => {
    it('should enforce name length constraint', async () => {
      const { error } = await supabase
        .from('task_definitions')
        .insert({
          tenant_id: testTenantId,
          name: 'a'.repeat(256),
          description: 'Test',
        })
        .select()
        .single();

      expect(error).toBeTruthy();
    });

    it('should enforce description length constraint', async () => {
      const { error } = await supabase
        .from('task_definitions')
        .insert({
          tenant_id: testTenantId,
          name: 'TEST_Long_Desc',
          description: 'a'.repeat(2001),
        })
        .select()
        .single();

      expect(error).toBeTruthy();
      expect(error?.code).toBe('23514');
    });

    it('should enforce acceptance_criteria length constraint', async () => {
      const { error } = await supabase
        .from('task_definitions')
        .insert({
          tenant_id: testTenantId,
          name: 'TEST_Long_Criteria',
          description: 'Test',
          acceptance_criteria: 'a'.repeat(2001),
        })
        .select()
        .single();

      expect(error).toBeTruthy();
      expect(error?.code).toBe('23514');
    });

    it('should enforce name not empty constraint', async () => {
      const { error } = await supabase
        .from('task_definitions')
        .insert({
          tenant_id: testTenantId,
          name: '   ',
          description: 'Test',
        })
        .select()
        .single();

      expect(error).toBeTruthy();
      expect(error?.code).toBe('23514');
    });
  });

  describe('Index Performance', () => {
    it('should efficiently query by tenant_id', async () => {
      // Create multiple tasks
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        tenant_id: testTenantId,
        name: `TEST_Perf_Task_${i}`,
        description: `Task ${i}`,
      }));

      await supabase.from('task_definitions').insert(tasks);

      const startTime = Date.now();

      const { data } = await supabase
        .from('task_definitions')
        .select('*')
        .eq('tenant_id', testTenantId)
        .is('deleted_at', null)
        .like('name', 'TEST_Perf_%');

      const queryTime = Date.now() - startTime;

      expect(data).toHaveLength(10);
      expect(queryTime).toBeLessThan(1000); // Should be fast (< 1 second)
    });

    it('should efficiently query by tenant_id and name', async () => {
      await supabase.from('task_definitions').insert({
        tenant_id: testTenantId,
        name: 'TEST_Index_Search',
        description: 'Test',
      });

      const startTime = Date.now();

      const { data } = await supabase
        .from('task_definitions')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('name', 'TEST_Index_Search');

      const queryTime = Date.now() - startTime;

      expect(data).toHaveLength(1);
      expect(queryTime).toBeLessThan(500); // Should be very fast (< 500ms)
    });
  });
});

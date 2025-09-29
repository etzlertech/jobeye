/**
 * @file /src/__tests__/scheduling/integration/offline-sync.test.ts
 * @purpose Integration test: Offline sync with conflicts
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import Dexie from 'dexie';

// These will fail with "Cannot find module" - as expected for TDD
import { OfflineCache } from '@/scheduling/offline/scheduling-cache';
import { SyncQueue } from '@/scheduling/offline/sync-queue';
import { ConflictResolver } from '@/scheduling/offline/conflict-resolver';
import { DayPlanService } from '@/scheduling/services/day-plan.service';
import { SchedulingService } from '@/scheduling/services/scheduling.service';
import type { Database } from '@/types/supabase';

describe('Offline Sync Integration', () => {
  let supabase: SupabaseClient<Database>;
  let offlineCache: OfflineCache;
  let syncQueue: SyncQueue;
  let conflictResolver: ConflictResolver;
  let dayPlanService: DayPlanService;
  let schedulingService: SchedulingService;
  
  const testCompanyId = '00000000-0000-4000-a000-000000000003';
  const technicianId = '123e4567-e89b-12d3-a456-426614174000';
  const supervisorId = '456e4567-e89b-12d3-a456-426614174000';
  const dispatcherId = '789e4567-e89b-12d3-a456-426614174000';

  beforeEach(async () => {
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: { 'x-company-id': testCompanyId }
        }
      }
    );

    // Initialize offline services
    offlineCache = new OfflineCache();
    await offlineCache.initialize();
    
    conflictResolver = new ConflictResolver();
    syncQueue = new SyncQueue(supabase, offlineCache, conflictResolver);
    
    // Initialize services with offline support
    dayPlanService = new DayPlanService(supabase, offlineCache, syncQueue);
    schedulingService = new SchedulingService(supabase, offlineCache, syncQueue);
  });

  afterEach(async () => {
    // Clear offline data
    await offlineCache.clear();
    await Dexie.delete('JobEyeOfflineDB');
  });

  it('should queue operations when offline and sync when online', async () => {
    // Create initial day plan while online
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    // Go offline
    await simulateOffline();

    // Create events while offline
    const offlineEvent1 = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-001',
      sequence_order: 1,
      scheduled_start: '2024-01-15T09:00:00Z',
      scheduled_duration_minutes: 60
    });

    const offlineEvent2 = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-002',
      sequence_order: 2,
      scheduled_start: '2024-01-15T10:30:00Z',
      scheduled_duration_minutes: 45
    });

    // Verify operations are queued
    const queuedOps = await syncQueue.getPendingOperations();
    expect(queuedOps).toHaveLength(2);
    expect(queuedOps[0]).toMatchObject({
      type: 'create',
      entity: 'schedule_events',
      data: expect.objectContaining({
        job_id: 'job-001'
      }),
      offline_id: expect.any(String)
    });

    // Go back online
    await simulateOnline();

    // Trigger sync
    const syncResult = await syncQueue.sync();

    expect(syncResult).toMatchObject({
      synced: 2,
      conflicts: 0,
      errors: 0,
      mappings: expect.objectContaining({
        [offlineEvent1.id]: expect.any(String), // Server ID
        [offlineEvent2.id]: expect.any(String)
      })
    });

    // Verify data synced to server
    const { data: serverEvents } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', dayPlan.id)
      .order('sequence_order');

    expect(serverEvents).toHaveLength(2);
    expect(serverEvents[0].job_id).toBe('job-001');
    expect(serverEvents[1].job_id).toBe('job-002');
  });

  it('should handle role-based conflict resolution', async () => {
    // Create initial schedule event
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    const event = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-001',
      sequence_order: 1,
      scheduled_start: '2024-01-15T09:00:00Z',
      scheduled_duration_minutes: 60
    });

    // Simulate multiple users modifying offline
    await simulateOffline();

    // Technician marks as completed
    const technicianUpdate = await schedulingService.updateEvent(event.id, {
      status: 'completed',
      actual_start: '2024-01-15T09:00:00Z',
      actual_end: '2024-01-15T09:45:00Z',
      notes: 'Completed early'
    }, { user_role: 'technician', user_id: technicianId });

    // Supervisor reschedules (after going offline)
    const supervisorUpdate = await schedulingService.updateEvent(event.id, {
      scheduled_start: '2024-01-15T14:00:00Z',
      notes: 'Customer requested afternoon'
    }, { user_role: 'supervisor', user_id: supervisorId });

    // Go online and sync
    await simulateOnline();
    const syncResult = await syncQueue.sync();

    expect(syncResult.conflicts).toBe(1);
    expect(syncResult.resolutions).toMatchObject([{
      entity_id: event.id,
      winner: 'supervisor',
      reason: 'role_priority',
      merged_fields: ['notes'] // Notes merged from both
    }]);

    // Verify supervisor's change won but notes were merged
    const { data: resolvedEvent } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('id', event.id)
      .single();

    expect(resolvedEvent).toMatchObject({
      scheduled_start: '2024-01-15T14:00:00Z',
      status: 'pending', // Not completed since supervisor rescheduled
      notes: expect.stringContaining('Customer requested afternoon'),
      notes: expect.stringContaining('Completed early') // Both notes preserved
    });
  });

  it('should encrypt sensitive offline data', async () => {
    // Create day plan with sensitive customer info
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15',
      metadata: {
        customer_notes: 'Gate code: 1234',
        special_instructions: 'Dog in backyard'
      }
    });

    await simulateOffline();

    // Store sensitive event data
    await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-sensitive',
      address: {
        street: '123 Private St',
        unit: 'Apt 4B',
        access_code: '5678'
      },
      notes: 'Customer phone: 555-0123'
    });

    // Verify data is encrypted in IndexedDB
    const db = await Dexie.open('JobEyeOfflineDB');
    const storedEvent = await db.table('schedule_events').toArray();
    
    // Raw data should be encrypted
    expect(storedEvent[0].encrypted_data).toBeDefined();
    expect(storedEvent[0].address).toBeUndefined();
    expect(storedEvent[0].notes).toBeUndefined();

    // But accessible through service
    const cachedEvents = await offlineCache.getScheduleEvents(dayPlan.id);
    expect(cachedEvents[0]).toMatchObject({
      address: {
        street: '123 Private St',
        access_code: '5678'
      }
    });
  });

  it('should handle cache eviction when storage is full', async () => {
    // Fill cache near capacity
    const oldJobData = [];
    for (let i = 0; i < 100; i++) {
      const dayPlan = await dayPlanService.createDayPlan({
        user_id: technicianId,
        plan_date: new Date(Date.now() - (i + 10) * 86400000).toISOString().split('T')[0] // Old dates
      });
      oldJobData.push(dayPlan);
    }

    await simulateOffline();

    // Monitor storage
    const storageStatus = await offlineCache.getStorageStatus();
    expect(storageStatus.percentage).toBeGreaterThan(80);

    // Try to add new data (should trigger eviction)
    const newDayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: new Date().toISOString().split('T')[0] // Today
    });

    // Verify old data was evicted
    const remainingOldData = await Promise.all(
      oldJobData.slice(0, 10).map(plan => 
        offlineCache.getDayPlan(plan.id)
      )
    );

    expect(remainingOldData.filter(p => p === null).length).toBeGreaterThan(5);

    // But new data is retained
    const cachedNewPlan = await offlineCache.getDayPlan(newDayPlan.id);
    expect(cachedNewPlan).toBeDefined();

    // Storage should be under limit
    const newStatus = await offlineCache.getStorageStatus();
    expect(newStatus.percentage).toBeLessThan(90);
  });

  it('should sync kit assignments and verifications offline', async () => {
    // Create kit assignment while online
    const kitAssignment = {
      job_id: 'job-001',
      kit_id: 'kit-001',
      assigned_by: technicianId
    };

    const assignment = await supabase
      .from('job_kits')
      .insert(kitAssignment)
      .select()
      .single();

    await simulateOffline();

    // Verify kit while offline
    const verification = await schedulingService.verifyKitOffline({
      job_kit_id: assignment.data.id,
      verified_by: technicianId,
      checklist: [
        { item_id: 'item-001', status: 'present' },
        { item_id: 'item-002', status: 'missing', override_reason: 'Not needed' }
      ]
    });

    // Check queued operations
    const queuedOps = await syncQueue.getPendingOperations();
    const verifyOp = queuedOps.find(op => op.type === 'update' && op.entity === 'job_kits');
    
    expect(verifyOp).toMatchObject({
      data: expect.objectContaining({
        verified_at: expect.any(String),
        verified_by: technicianId
      })
    });

    // Should also queue override log
    const overrideOp = queuedOps.find(op => op.entity === 'kit_override_logs');
    expect(overrideOp).toBeDefined();

    await simulateOnline();
    await syncQueue.sync();

    // Verify synced to server
    const { data: serverAssignment } = await supabase
      .from('job_kits')
      .select('*')
      .eq('id', assignment.data.id)
      .single();

    expect(serverAssignment.verified_at).toBeDefined();
  });

  // Helper functions
  async function simulateOffline() {
    // In real app, this would be navigator.onLine = false
    await syncQueue.setOfflineMode(true);
  }

  async function simulateOnline() {
    await syncQueue.setOfflineMode(false);
  }
});
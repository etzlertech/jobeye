/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/__tests__/sync-queue.test.ts
 * phase: 3
 * domain: Scheduling Core
 * purpose: Test offline sync queue functionality
 * spec_ref: 003-scheduling-kits
 * complexity_budget: 200
 * migration_touched: None
 * state_machine: none
 * estimated_llm_cost: 0
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: ['SyncQueueService', 'IndexedDBService', 'types']
 *   external: ['jest', 'fake-indexeddb']
 * exports: tests
 * voice_considerations: none
 * test_requirements:
 *   unit: 100%
 *   integration: 0%
 * tasks:
 *   - Test queue operations
 *   - Test sync process
 *   - Test conflict detection
 *   - Test retry logic
 */

import 'fake-indexeddb/auto';
import { SyncQueueService } from '../sync-queue.service';
import { IndexedDBService } from '../indexed-db.service';
import { SyncQueueEntry, OperationType } from '../types/offline.types';

// Polyfill structuredClone for Node.js test environment
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  configurable: true
});

describe('SyncQueueService', () => {
  let service: SyncQueueService;
  let dbService: IndexedDBService;

  beforeEach(async () => {
    // Clear IndexedDB - need to close any existing connections first
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        const deleteRequest = indexedDB.deleteDatabase(db.name);
        await new Promise<void>((resolve, reject) => {
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => {
            // Wait a bit and resolve anyway
            setTimeout(() => resolve(), 100);
          };
        });
      }
    }

    // Initialize shared database service
    dbService = new IndexedDBService();
    await dbService.init();

    // Pass the shared dbService to the sync queue service
    service = new SyncQueueService(dbService);
  });

  afterEach(async () => {
    // Close database connections to allow proper cleanup
    if (dbService) {
      dbService.close();
    }
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should add operations to the queue', async () => {
      const operation: Omit<SyncQueueEntry, 'id' | 'created_at' | 'attempts'> = {
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { test: 'data' },
        status: 'pending'
      };

      await service.enqueue(operation);

      const entries = await service.getPendingOperations();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        ...operation,
        attempts: 0,
        status: 'pending'
      });
    });

    it('should handle multiple operations', async () => {
      const operations = [
        {
          operation_type: 'create' as OperationType,
          entity_type: 'schedule_event',
          entity_id: 'event-1',
          company_id: 'company-1',
          user_id: 'user-1',
          data: { title: 'Event 1' },
          status: 'pending' as const
        },
        {
          operation_type: 'update' as OperationType,
          entity_type: 'day_plan',
          entity_id: 'plan-1',
          company_id: 'company-1',
          user_id: 'user-1',
          data: { status: 'in_progress' },
          status: 'pending' as const
        }
      ];

      for (const op of operations) {
        await service.enqueue(op);
      }

      const entries = await service.getPendingOperations();
      expect(entries).toHaveLength(2);
    });
  });

  describe('processSyncQueue', () => {
    beforeEach(() => {
      // Mock online status
      (navigator as any).onLine = true;
    });

    it('should process queue when online', async () => {
      const mockProcessor = jest.fn().mockResolvedValue({ success: true });
      
      await service.enqueue({
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { test: 'data' },
        status: 'pending'
      });

      await service.processSyncQueue(mockProcessor);

      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'create',
          entity_id: 'event-1'
        })
      );

      // Verify entry was marked as synced
      const entries = await service.getPendingOperations();
      expect(entries).toHaveLength(0);
    });

    it('should not process when offline', async () => {
      (navigator as any).onLine = false;
      const mockProcessor = jest.fn();

      await service.enqueue({
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { test: 'data' },
        status: 'pending'
      });

      await service.processSyncQueue(mockProcessor);

      expect(mockProcessor).not.toHaveBeenCalled();
    });

    it('should handle sync errors with retry', async () => {
      const mockProcessor = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });

      await service.enqueue({
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { test: 'data' },
        status: 'pending'
      });

      // First attempt - should fail
      await service.processSyncQueue(mockProcessor);
      
      let entries = await service.getPendingOperations();
      expect(entries).toHaveLength(1);
      expect(entries[0].attempts).toBe(1);
      expect(entries[0].last_error).toBe('Network error');

      // Second attempt - should succeed
      await service.processSyncQueue(mockProcessor);
      
      entries = await service.getPendingOperations();
      expect(entries).toHaveLength(0);
    });

    it('should skip operations after max retries', async () => {
      const mockProcessor = jest.fn().mockRejectedValue(new Error('Persistent error'));

      await service.enqueue({
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { test: 'data' },
        status: 'pending'
      });

      // Simulate max retries
      for (let i = 0; i < 4; i++) {
        await service.processSyncQueue(mockProcessor);
      }

      const entries = await service.getAllOperations();
      expect(entries[0].status).toBe('failed');
      expect(entries[0].attempts).toBe(3); // Max retries
    });
  });

  describe('conflict detection', () => {
    it('should detect conflicting operations', async () => {
      // Add two operations for the same entity
      await service.enqueue({
        operation_type: 'update',
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { title: 'Update 1' },
        status: 'pending'
      });

      await service.enqueue({
        operation_type: 'update',
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        company_id: 'company-1',
        user_id: 'user-2',
        data: { title: 'Update 2' },
        status: 'pending'
      });

      const conflicts = await service.detectConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].entity_id).toBe('event-1');
      expect(conflicts[0].operations).toHaveLength(2);
    });

    it('should not flag non-conflicting operations', async () => {
      await service.enqueue({
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { title: 'Event 1' },
        status: 'pending'
      });

      await service.enqueue({
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-2',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { title: 'Event 2' },
        status: 'pending'
      });

      const conflicts = await service.detectConflicts();
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should remove old synced entries', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 days ago

      // Add old synced entry
      await service.enqueue({
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-old',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { test: 'data' },
        status: 'synced',
        synced_at: oldDate
      });

      // Add recent entry
      await service.enqueue({
        operation_type: 'create',
        entity_type: 'schedule_event',
        entity_id: 'event-new',
        company_id: 'company-1',
        user_id: 'user-1',
        data: { test: 'data' },
        status: 'pending'
      });

      await service.cleanup();

      const entries = await service.getAllOperations();
      expect(entries).toHaveLength(1);
      expect(entries[0].entity_id).toBe('event-new');
    });
  });
});
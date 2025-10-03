/**
 * @file /src/domains/inventory/services/offline-queue.service.ts
 * @phase 3.5
 * @domain Inventory
 * @purpose Offline queue for inventory operations with IndexedDB persistence
 * @complexity_budget 300
 * @feature 004-voice-vision-inventory
 *
 * Extends vision offline queue pattern for inventory-specific operations:
 * - Check-in/check-out equipment
 * - Material usage recording
 * - Transfer operations
 * - Vision detection sessions
 */

export interface QueuedInventoryOperation {
  id: string;
  tenantId: string;
  userId: string;
  type:
    | 'check_in'
    | 'check_out'
    | 'material_usage'
    | 'transfer'
    | 'detection'
    | 'audit';
  payload: Record<string, any>;
  queuedAt: string;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  voiceSessionId?: string;
  jobId?: string;
}

const DB_NAME = 'inventory_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'operations';

/**
 * Offline queue manager for inventory operations
 */
export class OfflineInventoryQueue {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = true;
  private syncIntervalId: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
  }

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    if (typeof window === 'undefined' || this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;

        const storeNames = Array.from(db.objectStoreNames as any);
        if (!storeNames.includes(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('queuedAt', 'queuedAt', { unique: false });
          store.createIndex('tenantId', 'tenantId', { unique: false });
        }
      };
    });
  }

  /**
   * Add operation to queue
   */
  async enqueue(
    operation: Omit<
      QueuedInventoryOperation,
      'id' | 'queuedAt' | 'attempts' | 'status'
    >
  ): Promise<string> {
    await this.init();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const id = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queuedOperation: QueuedInventoryOperation = {
      ...operation,
      id,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(queuedOperation);

      request.onsuccess = () => {
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error('Failed to enqueue operation'));
      };
    });
  }

  /**
   * Get all queued operations
   */
  async getAll(): Promise<QueuedInventoryOperation[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get queued operations'));
      };
    });
  }

  /**
   * Get pending operations
   */
  async getPending(): Promise<QueuedInventoryOperation[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get pending operations'));
      };
    });
  }

  /**
   * Get operations by type
   */
  async getByType(
    type: QueuedInventoryOperation['type']
  ): Promise<QueuedInventoryOperation[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('type');
      const request = index.getAll(type);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get operations by type'));
      };
    });
  }

  /**
   * Update operation status
   */
  async update(
    id: string,
    updates: Partial<QueuedInventoryOperation>
  ): Promise<void> {
    await this.init();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error('Operation not found'));
          return;
        }

        const updated = { ...item, ...updates };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to update operation'));
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to get operation'));
      };
    });
  }

  /**
   * Remove operation from queue
   */
  async remove(id: string): Promise<void> {
    await this.init();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove operation'));
    });
  }

  /**
   * Clear all completed operations
   */
  async clearCompleted(): Promise<void> {
    const all = await this.getAll();
    const completed = all.filter((v) => v.status === 'completed');

    for (const operation of completed) {
      await this.remove(operation.id);
    }
  }

  /**
   * Process queue when online
   */
  async processQueue(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (!this.isOnline) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const pending = await this.getPending();
    let succeeded = 0;
    let failed = 0;

    for (const operation of pending) {
      try {
        // Mark as processing
        await this.update(operation.id, {
          status: 'processing',
          attempts: operation.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        });

        // Determine endpoint based on operation type
        const endpoint = this.getEndpointForType(operation.type);

        // Attempt operation
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(operation.payload),
        });

        if (response.ok) {
          // Success - mark as completed
          await this.update(operation.id, {
            status: 'completed',
          });
          succeeded++;
        } else {
          // Failed - mark as failed if too many attempts
          const maxAttempts = 3;
          if (operation.attempts + 1 >= maxAttempts) {
            await this.update(operation.id, {
              status: 'failed',
              error: 'Max attempts reached',
            });
            failed++;
          } else {
            // Reset to pending for retry
            await this.update(operation.id, {
              status: 'pending',
            });
          }
        }
      } catch (error: any) {
        // Network error - reset to pending
        await this.update(operation.id, {
          status: 'pending',
          error: error.message,
        });
        failed++;
      }
    }

    return {
      processed: pending.length,
      succeeded,
      failed,
    };
  }

  /**
   * Get API endpoint for operation type
   */
  private getEndpointForType(type: QueuedInventoryOperation['type']): string {
    const endpoints: Record<QueuedInventoryOperation['type'], string> = {
      check_in: '/api/inventory/check-in',
      check_out: '/api/inventory/check-out',
      material_usage: '/api/inventory/material-usage',
      transfer: '/api/inventory/transfer',
      detection: '/api/inventory/detect',
      audit: '/api/inventory/audit',
    };

    return endpoints[type];
  }

  /**
   * Start auto-sync when online
   */
  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncIntervalId) {
      return;
    }

    this.syncIntervalId = setInterval(() => {
      if (this.isOnline) {
        this.processQueue().catch(console.error);
      }
    }, intervalMs);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.isOnline = true;
    console.log('Network online - processing inventory queue');
    this.processQueue().catch(console.error);
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false;
    console.log('Network offline - queuing inventory operations');
  }

  /**
   * Check if online
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }
}

/**
 * Singleton instance
 */
let queueInstance: OfflineInventoryQueue | null = null;

export function getOfflineInventoryQueue(): OfflineInventoryQueue {
  if (!queueInstance) {
    queueInstance = new OfflineInventoryQueue();
  }
  return queueInstance;
}
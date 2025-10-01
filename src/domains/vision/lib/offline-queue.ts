/**
 * @file /src/domains/vision/lib/offline-queue.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Offline queue for vision verifications with IndexedDB persistence
 * @complexity_budget 400
 * @test_coverage ≥80%
 */

export interface QueuedVerification {
  id: string;
  kitId: string;
  companyId: string;
  imageData: ImageData;
  expectedItems: string[];
  maxBudgetUsd?: number;
  maxRequestsPerDay?: number;
  queuedAt: string;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

const DB_NAME = 'vision_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'verifications';
const MAX_QUEUE_SIZE = 200;

/**
 * Offline queue manager for vision verifications
 */
export class OfflineVerificationQueue {
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

        // Create object store if it doesn't exist
        // Use Array.from for compatibility with both real IndexedDB and mocks
        const storeNames = Array.from(db.objectStoreNames as any);
        if (!storeNames.includes(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('queuedAt', 'queuedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Add verification to queue
   * Implements FIFO eviction when queue exceeds MAX_QUEUE_SIZE (200)
   */
  async enqueue(verification: Omit<QueuedVerification, 'id' | 'queuedAt' | 'attempts' | 'status'>): Promise<string> {
    await this.init();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Check queue size and evict oldest if at limit
    const currentCount = await this.getCount();
    if (currentCount >= MAX_QUEUE_SIZE) {
      const oldestId = await this.getOldestId();
      if (oldestId) {
        await this.remove(oldestId);
        console.warn(`[OfflineQueue] Evicted oldest record (${oldestId}) - queue at ${MAX_QUEUE_SIZE} limit`);
      }
    }

    const id = `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queuedVerification: QueuedVerification = {
      ...verification,
      id,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending'
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Convert ImageData to serializable format
      const serialized = {
        ...queuedVerification,
        imageData: {
          data: Array.from(queuedVerification.imageData.data),
          width: queuedVerification.imageData.width,
          height: queuedVerification.imageData.height,
          colorSpace: queuedVerification.imageData.colorSpace
        }
      };

      const request = store.add(serialized);

      request.onsuccess = () => {
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error('Failed to enqueue verification'));
      };
    });
  }

  /**
   * Get all queued verifications
   */
  async getAll(): Promise<QueuedVerification[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result.map(this.deserializeImageData);
        resolve(items);
      };

      request.onerror = () => {
        reject(new Error('Failed to get queued verifications'));
      };
    });
  }

  /**
   * Get pending verifications
   */
  async getPending(): Promise<QueuedVerification[]> {
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
        const items = request.result.map(this.deserializeImageData);
        resolve(items);
      };

      request.onerror = () => {
        reject(new Error('Failed to get pending verifications'));
      };
    });
  }

  /**
   * Update verification status
   */
  async update(id: string, updates: Partial<QueuedVerification>): Promise<void> {
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
          reject(new Error('Verification not found'));
          return;
        }

        const updated = { ...item, ...updates };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to update verification'));
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to get verification'));
      };
    });
  }

  /**
   * Remove verification from queue
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
      request.onerror = () => reject(new Error('Failed to remove verification'));
    });
  }

  /**
   * Clear all completed verifications
   */
  async clearCompleted(): Promise<void> {
    const all = await this.getAll();
    const completed = all.filter(v => v.status === 'completed');

    for (const verification of completed) {
      await this.remove(verification.id);
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

    for (const verification of pending) {
      try {
        // Mark as processing
        await this.update(verification.id, {
          status: 'processing',
          attempts: verification.attempts + 1,
          lastAttemptAt: new Date().toISOString()
        });

        // Attempt verification
        const response = await fetch('/api/vision/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            kitId: verification.kitId,
            companyId: verification.companyId,
            imageData: Array.from(verification.imageData.data),
            expectedItems: verification.expectedItems,
            maxBudgetUsd: verification.maxBudgetUsd,
            maxRequestsPerDay: verification.maxRequestsPerDay
          })
        });

        if (response.ok) {
          // Success - mark as completed
          await this.update(verification.id, {
            status: 'completed'
          });
          succeeded++;
        } else {
          // Failed - mark as failed if too many attempts
          const maxAttempts = 3;
          if (verification.attempts + 1 >= maxAttempts) {
            await this.update(verification.id, {
              status: 'failed',
              error: 'Max attempts reached'
            });
            failed++;
          } else {
            // Reset to pending for retry
            await this.update(verification.id, {
              status: 'pending'
            });
          }
        }

      } catch (error: any) {
        // Network error - reset to pending
        await this.update(verification.id, {
          status: 'pending',
          error: error.message
        });
        failed++;
      }
    }

    return {
      processed: pending.length,
      succeeded,
      failed
    };
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
    console.log('Network online - processing queue');
    this.processQueue().catch(console.error);
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false;
    console.log('Network offline - queuing verifications');
  }

  /**
   * Check if online
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get total count of queued items
   */
  private async getCount(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count items'));
    });
  }

  /**
   * Get ID of oldest queued item (by queuedAt timestamp)
   */
  private async getOldestId(): Promise<string | null> {
    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('queuedAt');
      const request = index.openCursor(null, 'next'); // Ascending order

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          resolve(cursor.value.id);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(new Error('Failed to get oldest item'));
    });
  }

  /**
   * Deserialize ImageData from stored format
   */
  private deserializeImageData(item: any): QueuedVerification {
    const imageDataArray = new Uint8ClampedArray(item.imageData.data);
    const imageData = new ImageData(
      imageDataArray,
      item.imageData.width,
      item.imageData.height
    );

    return {
      ...item,
      imageData
    };
  }
}

/**
 * Singleton instance
 */
let queueInstance: OfflineVerificationQueue | null = null;

export function getOfflineQueue(): OfflineVerificationQueue {
  if (!queueInstance) {
    queueInstance = new OfflineVerificationQueue();
  }
  return queueInstance;
}
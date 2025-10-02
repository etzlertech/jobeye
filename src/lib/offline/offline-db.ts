/**
 * @file /src/lib/offline/offline-db.ts
 * @purpose IndexedDB wrapper for offline storage and sync
 * @phase 3
 * @domain Core Infrastructure
 * @complexity_budget 300
 * @test_coverage 80%
 */

import type { Job, EquipmentItem } from '@/types/database';

export interface OfflineQueueItem {
  id?: number;
  timestamp: number;
  operation: 'create' | 'update' | 'delete';
  entity: string;
  entityId?: string;
  data: any;
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

export interface CachedEntity<T = any> {
  id: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
}

export class OfflineDatabase {
  private static instance: OfflineDatabase;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'jobeye_offline';
  private readonly DB_VERSION = 1;

  private constructor() {}

  static getInstance(): OfflineDatabase {
    if (!OfflineDatabase.instance) {
      OfflineDatabase.instance = new OfflineDatabase();
    }
    return OfflineDatabase.instance;
  }

  async initialize(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Offline sync queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', {
            keyPath: 'id',
            autoIncrement: true
          });
          syncStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('entity', 'entity', { unique: false });
        }

        // Cached jobs
        if (!db.objectStoreNames.contains('cached_jobs')) {
          const jobStore = db.createObjectStore('cached_jobs', {
            keyPath: 'id'
          });
          jobStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Cached inventory
        if (!db.objectStoreNames.contains('cached_inventory')) {
          const inventoryStore = db.createObjectStore('cached_inventory', {
            keyPath: 'id'
          });
          inventoryStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Voice commands
        if (!db.objectStoreNames.contains('voice_commands')) {
          const voiceStore = db.createObjectStore('voice_commands', {
            keyPath: 'id',
            autoIncrement: true
          });
          voiceStore.createIndex('timestamp', 'timestamp', { unique: false });
          voiceStore.createIndex('processed', 'processed', { unique: false });
        }

        // Intent classifications
        if (!db.objectStoreNames.contains('intent_cache')) {
          const intentStore = db.createObjectStore('intent_cache', {
            keyPath: 'imageHash'
          });
          intentStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async queueOperation(operation: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'syncStatus' | 'retryCount'>): Promise<number> {
    await this.ensureInitialized();
    
    const item: OfflineQueueItem = {
      ...operation,
      timestamp: Date.now(),
      syncStatus: 'pending',
      retryCount: 0
    };

    const tx = this.db!.transaction(['sync_queue'], 'readwrite');
    const store = tx.objectStore('sync_queue');
    
    return new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(new Error('Failed to queue operation'));
    });
  }

  async getPendingOperations(limit = 50): Promise<OfflineQueueItem[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['sync_queue'], 'readonly');
    const store = tx.objectStore('sync_queue');
    const index = store.index('syncStatus');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll('pending', limit);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get pending operations'));
    });
  }

  async updateOperationStatus(id: number, status: OfflineQueueItem['syncStatus'], error?: string): Promise<void> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['sync_queue'], 'readwrite');
    const store = tx.objectStore('sync_queue');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error('Operation not found'));
          return;
        }
        
        item.syncStatus = status;
        if (error) item.error = error;
        if (status === 'failed') item.retryCount++;
        
        const updateRequest = store.put(item);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(new Error('Failed to update operation status'));
      };
      
      getRequest.onerror = () => reject(new Error('Failed to get operation'));
    });
  }

  async cacheJobs(jobs: Job[]): Promise<void> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['cached_jobs'], 'readwrite');
    const store = tx.objectStore('cached_jobs');
    const timestamp = Date.now();
    
    const promises = jobs.map(job => {
      const cached: CachedEntity<Job> = {
        id: job.id,
        data: job,
        timestamp,
        expiresAt: timestamp + (24 * 60 * 60 * 1000) // 24 hours
      };
      
      return store.put(cached);
    });
    
    await Promise.all(promises);
  }

  async getCachedJobs(): Promise<Job[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['cached_jobs'], 'readonly');
    const store = tx.objectStore('cached_jobs');
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const cached = request.result as CachedEntity<Job>[];
        const validJobs = cached
          .filter(item => !item.expiresAt || item.expiresAt > now)
          .map(item => item.data);
        resolve(validJobs);
      };
      
      request.onerror = () => reject(new Error('Failed to get cached jobs'));
    });
  }

  async cacheInventory(items: EquipmentItem[]): Promise<void> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['cached_inventory'], 'readwrite');
    const store = tx.objectStore('cached_inventory');
    const timestamp = Date.now();
    
    const promises = items.map(item => {
      const cached: CachedEntity<EquipmentItem> = {
        id: item.id,
        data: item,
        timestamp,
        expiresAt: timestamp + (7 * 24 * 60 * 60 * 1000) // 7 days
      };
      
      return store.put(cached);
    });
    
    await Promise.all(promises);
  }

  async getCachedInventory(): Promise<EquipmentItem[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['cached_inventory'], 'readonly');
    const store = tx.objectStore('cached_inventory');
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const cached = request.result as CachedEntity<EquipmentItem>[];
        const validItems = cached
          .filter(item => !item.expiresAt || item.expiresAt > now)
          .map(item => item.data);
        resolve(validItems);
      };
      
      request.onerror = () => reject(new Error('Failed to get cached inventory'));
    });
  }

  async clearExpiredCache(): Promise<void> {
    await this.ensureInitialized();
    
    const now = Date.now();
    const stores = ['cached_jobs', 'cached_inventory'];
    
    for (const storeName of stores) {
      const tx = this.db!.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('timestamp');
      
      const request = index.openCursor();
      
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const item = cursor.value as CachedEntity;
            if (item.expiresAt && item.expiresAt < now) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        
        request.onerror = () => reject(new Error(`Failed to clear expired cache from ${storeName}`));
      });
    }
  }

  async clearOldSyncItems(daysOld = 7): Promise<void> {
    await this.ensureInitialized();
    
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const tx = this.db!.transaction(['sync_queue'], 'readwrite');
    const store = tx.objectStore('sync_queue');
    const index = store.index('timestamp');
    
    const request = index.openCursor();
    
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const item = cursor.value as OfflineQueueItem;
          if (item.timestamp < cutoff && (item.syncStatus === 'completed' || item.retryCount > 3)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(new Error('Failed to clear old sync items'));
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }
}

// Export singleton instance
export const offlineDB = OfflineDatabase.getInstance();
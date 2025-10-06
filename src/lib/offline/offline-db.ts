/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/offline/offline-db.ts
 * phase: 3
 * domain: offline
 * purpose: Enhanced IndexedDB wrapper for offline data storage and sync queue management
 * spec_ref: 007-mvp-intent-driven/contracts/offline-db.md
 * complexity_budget: 350
 * migrations_touched: []
 * state_machine: {
 *   states: ['connecting', 'connected', 'syncing', 'error'],
 *   transitions: [
 *     'connecting->connected: dbOpened()',
 *     'connected->syncing: startSync()',
 *     'syncing->connected: syncComplete()',
 *     'connected->error: dbError()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "offlineDb": "$0.00 (no AI operations)"
 * }
 * offline_capability: CORE
 * dependencies: {
 *   internal: ['@/core/errors/error-types'],
 *   external: [],
 *   supabase: []
 * }
 * exports: ['OfflineDatabase', 'SyncQueueItem', 'OfflineEntity']
 * voice_considerations: Store voice recordings and transcripts for offline access
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/lib/offline/offline-db.test.ts'
 * }
 * tasks: [
 *   'Enhance IndexedDB schema for MVP features',
 *   'Add voice and image blob storage',
 *   'Implement priority-based sync queue',
 *   'Add conflict resolution strategies'
 * ]
 */

import type { Job, EquipmentItem } from '@/types/database';
import { AppError } from '@/core/errors/error-types';

export interface SyncQueueItem {
  id?: string;
  operation: 'create' | 'update' | 'delete';
  entity: string;
  entityId?: string;
  data: any;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
  retryCount?: number;
  maxRetries?: number;
  conflictResolution?: 'overwrite' | 'merge' | 'skip';
  syncStatus?: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface OfflineEntity {
  id: string;
  entity: string;
  data: any;
  timestamp: number;
  syncStatus: 'pending' | 'synced' | 'error';
  lastModified: number;
}

export interface VoiceRecording {
  id: string;
  blob: Blob;
  transcript?: string;
  duration?: number;
  timestamp: number;
  jobId?: string;
  syncStatus: 'pending' | 'synced' | 'error';
}

export interface ImageData {
  id: string;
  blob: Blob;
  thumbnailBlob?: Blob;
  metadata: {
    width?: number;
    height?: number;
    type: string;
    size: number;
  };
  timestamp: number;
  jobId?: string;
  syncStatus: 'pending' | 'synced' | 'error';
}

export interface CachedEntity<T = any> {
  id: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
}

// Legacy interface for backward compatibility
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
  priority?: 'low' | 'medium' | 'high';
}

export class OfflineDatabase {
  private static instance: OfflineDatabase;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'jobeye_offline';
  private readonly DB_VERSION = 2;

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
        
        // Enhanced sync queue with priority support
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', {
            keyPath: 'id',
            autoIncrement: true
          });
          syncStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('entity', 'entity', { unique: false });
          syncStore.createIndex('priority', 'priority', { unique: false });
        }

        // Voice recordings with blob storage
        if (!db.objectStoreNames.contains('voice_recordings')) {
          const voiceStore = db.createObjectStore('voice_recordings', {
            keyPath: 'id'
          });
          voiceStore.createIndex('timestamp', 'timestamp', { unique: false });
          voiceStore.createIndex('jobId', 'jobId', { unique: false });
          voiceStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Image data with blob storage and thumbnails
        if (!db.objectStoreNames.contains('image_data')) {
          const imageStore = db.createObjectStore('image_data', {
            keyPath: 'id'
          });
          imageStore.createIndex('timestamp', 'timestamp', { unique: false });
          imageStore.createIndex('jobId', 'jobId', { unique: false });
          imageStore.createIndex('syncStatus', 'syncStatus', { unique: false });
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

        // Offline entities for general purpose storage
        if (!db.objectStoreNames.contains('offline_entities')) {
          const entityStore = db.createObjectStore('offline_entities', {
            keyPath: 'id'
          });
          entityStore.createIndex('entity', 'entity', { unique: false });
          entityStore.createIndex('timestamp', 'timestamp', { unique: false });
          entityStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }
      };
    });
  }

  async queueOperation(operation: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'syncStatus' | 'retryCount'>): Promise<number> {
    await this.ensureInitialized();
    
    const item: OfflineQueueItem = {
      ...operation,
      priority: operation.priority ?? 'medium',
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

  // Enhanced sync queue methods with priority support
  async queuePriorityOperation(operation: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<void> {
    await this.ensureInitialized();
    
    const item: SyncQueueItem = {
      ...operation,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      syncStatus: 'pending',
      retryCount: 0,
      maxRetries: operation.maxRetries || 3
    };

    const tx = this.db!.transaction(['sync_queue'], 'readwrite');
    const store = tx.objectStore('sync_queue');
    
    return new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to queue priority operation'));
    });
  }

  async getPriorityOperations(limit = 50): Promise<SyncQueueItem[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['sync_queue'], 'readonly');
    const store = tx.objectStore('sync_queue');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result as SyncQueueItem[];
        // Sort by priority (critical > high > medium > low) then by timestamp
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sorted = items
          .filter(item => item.syncStatus === 'pending')
          .sort((a, b) => {
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.timestamp - b.timestamp;
          })
          .slice(0, limit);
        resolve(sorted);
      };
      request.onerror = () => reject(new Error('Failed to get priority operations'));
    });
  }

  // Voice recording methods
  async storeVoiceRecording(recording: VoiceRecording): Promise<void> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['voice_recordings'], 'readwrite');
    const store = tx.objectStore('voice_recordings');
    
    return new Promise((resolve, reject) => {
      const request = store.put(recording);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store voice recording'));
    });
  }

  async getVoiceRecording(id: string): Promise<VoiceRecording | null> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['voice_recordings'], 'readonly');
    const store = tx.objectStore('voice_recordings');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get voice recording'));
    });
  }

  async getVoiceRecordingsByJob(jobId: string): Promise<VoiceRecording[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['voice_recordings'], 'readonly');
    const store = tx.objectStore('voice_recordings');
    const index = store.index('jobId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(jobId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get voice recordings by job'));
    });
  }

  async getPendingVoiceRecordings(): Promise<VoiceRecording[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['voice_recordings'], 'readonly');
    const store = tx.objectStore('voice_recordings');
    const index = store.index('syncStatus');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get pending voice recordings'));
    });
  }

  async updateVoiceRecordingStatus(id: string, syncStatus: VoiceRecording['syncStatus']): Promise<void> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['voice_recordings'], 'readwrite');
    const store = tx.objectStore('voice_recordings');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const recording = getRequest.result;
        if (!recording) {
          reject(new Error('Voice recording not found'));
          return;
        }
        
        recording.syncStatus = syncStatus;
        
        const updateRequest = store.put(recording);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(new Error('Failed to update voice recording status'));
      };
      
      getRequest.onerror = () => reject(new Error('Failed to get voice recording'));
    });
  }

  // Image data methods
  async storeImageData(imageData: ImageData): Promise<void> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['image_data'], 'readwrite');
    const store = tx.objectStore('image_data');
    
    return new Promise((resolve, reject) => {
      const request = store.put(imageData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store image data'));
    });
  }

  async getImageData(id: string): Promise<ImageData | null> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['image_data'], 'readonly');
    const store = tx.objectStore('image_data');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get image data'));
    });
  }

  async getImageDataByJob(jobId: string): Promise<ImageData[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['image_data'], 'readonly');
    const store = tx.objectStore('image_data');
    const index = store.index('jobId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(jobId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get image data by job'));
    });
  }

  async getPendingImageData(): Promise<ImageData[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['image_data'], 'readonly');
    const store = tx.objectStore('image_data');
    const index = store.index('syncStatus');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get pending image data'));
    });
  }

  async updateImageDataStatus(id: string, syncStatus: ImageData['syncStatus']): Promise<void> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['image_data'], 'readwrite');
    const store = tx.objectStore('image_data');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const imageData = getRequest.result;
        if (!imageData) {
          reject(new Error('Image data not found'));
          return;
        }
        
        imageData.syncStatus = syncStatus;
        
        const updateRequest = store.put(imageData);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(new Error('Failed to update image data status'));
      };
      
      getRequest.onerror = () => reject(new Error('Failed to get image data'));
    });
  }

  // Generic offline entity methods
  async storeOfflineEntity(entity: OfflineEntity): Promise<void> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['offline_entities'], 'readwrite');
    const store = tx.objectStore('offline_entities');
    
    return new Promise((resolve, reject) => {
      const request = store.put(entity);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store offline entity'));
    });
  }

  async getOfflineEntity(id: string): Promise<OfflineEntity | null> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['offline_entities'], 'readonly');
    const store = tx.objectStore('offline_entities');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get offline entity'));
    });
  }

  async getOfflineEntitiesByType(entity: string): Promise<OfflineEntity[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['offline_entities'], 'readonly');
    const store = tx.objectStore('offline_entities');
    const index = store.index('entity');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(entity);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get offline entities by type'));
    });
  }

  async getPendingOfflineEntities(): Promise<OfflineEntity[]> {
    await this.ensureInitialized();
    
    const tx = this.db!.transaction(['offline_entities'], 'readonly');
    const store = tx.objectStore('offline_entities');
    const index = store.index('syncStatus');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get pending offline entities'));
    });
  }

  // Cleanup methods for storage management
  async cleanupExpiredData(maxAge = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.ensureInitialized();
    
    const cutoff = Date.now() - maxAge;
    const stores = ['voice_recordings', 'image_data', 'offline_entities'];
    
    for (const storeName of stores) {
      const tx = this.db!.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('timestamp');
      
      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor();
        
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const item = cursor.value;
            if (item.timestamp < cutoff && item.syncStatus === 'synced') {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        
        request.onerror = () => reject(new Error(`Failed to cleanup ${storeName}`));
      });
    }
  }

  async getStorageStats(): Promise<{
    voiceRecordings: number;
    imageData: number;
    offlineEntities: number;
    pendingSync: number;
  }> {
    await this.ensureInitialized();
    
    const [voiceCount, imageCount, entityCount, syncCount] = await Promise.all([
      this.getStoreCount('voice_recordings'),
      this.getStoreCount('image_data'),
      this.getStoreCount('offline_entities'),
      this.getStoreCount('sync_queue')
    ]);
    
    return {
      voiceRecordings: voiceCount,
      imageData: imageCount,
      offlineEntities: entityCount,
      pendingSync: syncCount
    };
  }

  private async getStoreCount(storeName: string): Promise<number> {
    const tx = this.db!.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count ${storeName}`));
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

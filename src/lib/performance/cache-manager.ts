/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/performance/cache-manager.ts
 * phase: 3
 * domain: performance
 * purpose: Intelligent caching manager for MVP app performance optimization
 * spec_ref: 007-mvp-intent-driven/contracts/cache-manager.md
 * complexity_budget: 350
 * migrations_touched: []
 * state_machine: {
 *   states: ['idle', 'loading', 'cached', 'stale', 'refreshing'],
 *   transitions: [
 *     'idle->loading: requestData()',
 *     'loading->cached: dataLoaded()',
 *     'cached->stale: ttlExpired()',
 *     'stale->refreshing: refreshRequest()',
 *     'refreshing->cached: refreshComplete()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "cacheManager": "$0.00 (no AI operations)"
 * }
 * offline_capability: CORE
 * dependencies: {
 *   internal: [
 *     '@/lib/offline/offline-db',
 *     '@/core/logger/voice-logger'
 *   ],
 *   external: [],
 *   supabase: []
 * }
 * exports: ['CacheManager', 'CacheStrategy', 'CachePolicy']
 * voice_considerations: Cache voice responses and audio data for offline playback
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/lib/performance/cache-manager.test.ts'
 * }
 * tasks: [
 *   'Implement multi-layer caching strategy',
 *   'Add intelligent cache invalidation',
 *   'Create image and audio caching',
 *   'Implement preloading strategies'
 * ]
 */

import { offlineDB } from '@/lib/offline/offline-db';
import { voiceLogger } from '@/core/logger/voice-logger';

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  size?: number;
}

export interface CachePolicy {
  maxSize: number;
  maxAge: number;
  evictionStrategy: 'lru' | 'lfu' | 'ttl' | 'priority';
  compressionEnabled: boolean;
  preloadThreshold: number;
}

export interface CacheStrategy {
  name: string;
  shouldCache: (key: string, data: any) => boolean;
  getTTL: (key: string, data: any) => number;
  getPriority: (key: string, data: any) => CacheEntry['priority'];
  getTags: (key: string, data: any) => string[];
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private persistentCache: Map<string, CacheEntry> = new Map();
  private strategies: Map<string, CacheStrategy> = new Map();
  private policies: Map<string, CachePolicy> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0
  };

  private readonly DEFAULT_POLICY: CachePolicy = {
    maxSize: 50 * 1024 * 1024, // 50MB
    maxAge: 30 * 60 * 1000, // 30 minutes
    evictionStrategy: 'lru',
    compressionEnabled: true,
    preloadThreshold: 0.8
  };

  private constructor() {
    this.initializeStrategies();
    this.initializePolicies();
    this.setupCleanupInterval();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private initializeStrategies(): void {
    // API response caching strategy
    this.strategies.set('api', {
      name: 'api',
      shouldCache: (key, data) => {
        return !key.includes('sensitive') && data && typeof data === 'object';
      },
      getTTL: (key, data) => {
        if (key.includes('static')) return 24 * 60 * 60 * 1000; // 24 hours
        if (key.includes('user')) return 5 * 60 * 1000; // 5 minutes
        return 15 * 60 * 1000; // 15 minutes default
      },
      getPriority: (key, data) => {
        if (key.includes('critical') || key.includes('job')) return 'critical';
        if (key.includes('user') || key.includes('equipment')) return 'high';
        return 'medium';
      },
      getTags: (key, data) => {
        const tags = ['api'];
        if (key.includes('job')) tags.push('jobs');
        if (key.includes('user')) tags.push('users');
        if (key.includes('equipment')) tags.push('equipment');
        return tags;
      }
    });

    // Image caching strategy
    this.strategies.set('image', {
      name: 'image',
      shouldCache: (key, data) => {
        return data instanceof Blob || data instanceof ArrayBuffer;
      },
      getTTL: (key, data) => {
        if (key.includes('profile')) return 24 * 60 * 60 * 1000; // 24 hours
        if (key.includes('thumbnail')) return 7 * 24 * 60 * 60 * 1000; // 7 days
        return 60 * 60 * 1000; // 1 hour default
      },
      getPriority: (key, data) => {
        if (key.includes('thumbnail')) return 'high';
        if (key.includes('profile')) return 'medium';
        return 'low';
      },
      getTags: (key, data) => {
        const tags = ['image'];
        if (key.includes('job')) tags.push('job-photos');
        if (key.includes('profile')) tags.push('user-photos');
        return tags;
      }
    });

    // Voice/audio caching strategy
    this.strategies.set('voice', {
      name: 'voice',
      shouldCache: (key, data) => {
        return data instanceof Blob && key.includes('audio');
      },
      getTTL: (key, data) => {
        if (key.includes('instruction')) return 24 * 60 * 60 * 1000; // 24 hours
        return 60 * 60 * 1000; // 1 hour
      },
      getPriority: (key, data) => {
        if (key.includes('instruction')) return 'critical';
        return 'medium';
      },
      getTags: (key, data) => {
        return ['voice', 'audio'];
      }
    });

    // Component data caching strategy
    this.strategies.set('component', {
      name: 'component',
      shouldCache: (key, data) => {
        return key.startsWith('component:') && data;
      },
      getTTL: (key, data) => {
        return 10 * 60 * 1000; // 10 minutes
      },
      getPriority: (key, data) => {
        if (key.includes('critical')) return 'critical';
        return 'medium';
      },
      getTags: (key, data) => {
        return ['component', 'ui'];
      }
    });
  }

  private initializePolicies(): void {
    // Memory cache policy (for frequently accessed small data)
    this.policies.set('memory', {
      maxSize: 10 * 1024 * 1024, // 10MB
      maxAge: 5 * 60 * 1000, // 5 minutes
      evictionStrategy: 'lru',
      compressionEnabled: false,
      preloadThreshold: 0.9
    });

    // Persistent cache policy (for larger, longer-lived data)
    this.policies.set('persistent', {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      evictionStrategy: 'priority',
      compressionEnabled: true,
      preloadThreshold: 0.8
    });

    // Image cache policy
    this.policies.set('image', {
      maxSize: 200 * 1024 * 1024, // 200MB
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      evictionStrategy: 'lru',
      compressionEnabled: false, // Images are already compressed
      preloadThreshold: 0.7
    });

    // Voice cache policy
    this.policies.set('voice', {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      evictionStrategy: 'priority',
      compressionEnabled: false, // Audio compression would degrade quality
      preloadThreshold: 0.8
    });
  }

  async get<T>(
    key: string, 
    strategyName = 'api'
  ): Promise<T | null> {
    this.stats.totalRequests++;

    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && !this.isExpired(memoryEntry)) {
        this.updateAccessStats(memoryEntry);
        this.stats.hits++;
        voiceLogger.debug('Cache hit (memory)', { key });
        return memoryEntry.data as T;
      }

      // Check persistent cache
      const persistentEntry = this.persistentCache.get(key);
      if (persistentEntry && !this.isExpired(persistentEntry)) {
        this.updateAccessStats(persistentEntry);
        
        // Promote to memory cache if frequently accessed
        if (persistentEntry.accessCount > 5) {
          await this.promoteToMemoryCache(key, persistentEntry);
        }
        
        this.stats.hits++;
        voiceLogger.debug('Cache hit (persistent)', { key });
        return persistentEntry.data as T;
      }

      // Check IndexedDB for offline data
      const offlineData = await this.getFromIndexedDB<T>(key);
      if (offlineData) {
        this.stats.hits++;
        voiceLogger.debug('Cache hit (IndexedDB)', { key });
        return offlineData;
      }

      this.stats.misses++;
      voiceLogger.debug('Cache miss', { key });
      return null;

    } catch (error) {
      voiceLogger.error('Cache get error', { key, error });
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(
    key: string,
    data: T,
    strategyName = 'api',
    options?: {
      ttl?: number;
      priority?: CacheEntry['priority'];
      tags?: string[];
      persistent?: boolean;
    }
  ): Promise<void> {
    try {
      const strategy = this.strategies.get(strategyName);
      if (!strategy || !strategy.shouldCache(key, data)) {
        return;
      }

      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        ttl: options?.ttl || strategy.getTTL(key, data),
        accessCount: 1,
        lastAccessed: Date.now(),
        priority: options?.priority || strategy.getPriority(key, data),
        tags: options?.tags || strategy.getTags(key, data),
        size: this.calculateSize(data)
      };

      // Determine cache layer based on size and persistence requirements
      const shouldPersist = options?.persistent || 
                           entry.size! > 1024 * 1024 || // > 1MB
                           entry.priority === 'critical';

      if (shouldPersist) {
        await this.setPersistent(entry);
      } else {
        await this.setMemory(entry);
      }

      voiceLogger.debug('Cache set', { 
        key, 
        size: entry.size, 
        persistent: shouldPersist,
        ttl: entry.ttl 
      });

    } catch (error) {
      voiceLogger.error('Cache set error', { key, error });
    }
  }

  private async setMemory<T>(entry: CacheEntry<T>): Promise<void> {
    const policy = this.policies.get('memory') || this.DEFAULT_POLICY;
    
    // Check if we need to evict entries
    await this.ensureCapacity(this.memoryCache, policy);
    
    this.memoryCache.set(entry.key, entry);
  }

  private async setPersistent<T>(entry: CacheEntry<T>): Promise<void> {
    const policy = this.policies.get('persistent') || this.DEFAULT_POLICY;
    
    // Check if we need to evict entries
    await this.ensureCapacity(this.persistentCache, policy);
    
    this.persistentCache.set(entry.key, entry);

    // Also store critical data in IndexedDB for offline access
    if (entry.priority === 'critical') {
      await this.storeInIndexedDB(entry);
    }
  }

  private async ensureCapacity(
    cache: Map<string, CacheEntry>,
    policy: CachePolicy
  ): Promise<void> {
    const currentSize = this.calculateCacheSize(cache);
    
    if (currentSize >= policy.maxSize * policy.preloadThreshold) {
      await this.evictEntries(cache, policy);
    }
  }

  private async evictEntries(
    cache: Map<string, CacheEntry>,
    policy: CachePolicy
  ): Promise<void> {
    const entries = Array.from(cache.values());
    let toEvict: CacheEntry[] = [];

    switch (policy.evictionStrategy) {
      case 'lru':
        toEvict = entries
          .sort((a, b) => a.lastAccessed - b.lastAccessed)
          .slice(0, Math.ceil(entries.length * 0.2));
        break;

      case 'lfu':
        toEvict = entries
          .sort((a, b) => a.accessCount - b.accessCount)
          .slice(0, Math.ceil(entries.length * 0.2));
        break;

      case 'ttl':
        const now = Date.now();
        toEvict = entries
          .filter(entry => now - entry.timestamp > entry.ttl)
          .concat(
            entries
              .filter(entry => now - entry.timestamp <= entry.ttl)
              .sort((a, b) => (a.timestamp + a.ttl) - (b.timestamp + b.ttl))
              .slice(0, Math.ceil(entries.length * 0.1))
          );
        break;

      case 'priority':
        const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        toEvict = entries
          .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
          .slice(0, Math.ceil(entries.length * 0.2));
        break;
    }

    for (const entry of toEvict) {
      cache.delete(entry.key);
      this.stats.evictions++;
    }

    voiceLogger.debug('Cache eviction', { 
      evicted: toEvict.length, 
      strategy: policy.evictionStrategy 
    });
  }

  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    this.persistentCache.delete(key);
    await this.removeFromIndexedDB(key);
    
    voiceLogger.debug('Cache invalidated', { key });
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keysToInvalidate: string[] = [];

    // Collect keys from memory cache
    for (const [key, entry] of this.memoryCache) {
      if (entry.tags.includes(tag)) {
        keysToInvalidate.push(key);
      }
    }

    // Collect keys from persistent cache
    for (const [key, entry] of this.persistentCache) {
      if (entry.tags.includes(tag)) {
        keysToInvalidate.push(key);
      }
    }

    // Invalidate all collected keys
    await Promise.all(keysToInvalidate.map(key => this.invalidate(key)));

    voiceLogger.debug('Cache invalidated by tag', { tag, count: keysToInvalidate.length });
  }

  async preload(keys: string[], strategyName = 'api'): Promise<void> {
    const preloadPromises = keys.map(async (key) => {
      try {
        // Check if already cached
        const cached = await this.get(key, strategyName);
        if (cached) {
          return;
        }

        // Preload logic would typically fetch from API
        // For now, we'll just mark as preload attempted
        voiceLogger.debug('Preload attempted', { key });
      } catch (error) {
        voiceLogger.warn('Preload failed', { key, error });
      }
    });

    await Promise.all(preloadPromises);
  }

  async warmup(): Promise<void> {
    try {
      // Preload critical app data
      const criticalKeys = [
        'api:user:profile',
        'api:jobs:today',
        'api:equipment:list',
        'component:dashboard:layout'
      ];

      await this.preload(criticalKeys);

      voiceLogger.info('Cache warmup completed');
    } catch (error) {
      voiceLogger.error('Cache warmup failed', { error });
    }
  }

  async cleanup(): Promise<void> {
    const now = Date.now();

    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // Clean persistent cache
    for (const [key, entry] of this.persistentCache) {
      if (this.isExpired(entry)) {
        this.persistentCache.delete(key);
        await this.removeFromIndexedDB(key);
      }
    }

    voiceLogger.debug('Cache cleanup completed');
  }

  getStats(): CacheStats {
    const totalEntries = this.memoryCache.size + this.persistentCache.size;
    const totalSize = this.calculateCacheSize(this.memoryCache) + 
                     this.calculateCacheSize(this.persistentCache);
    
    return {
      totalEntries,
      totalSize,
      hitRate: this.stats.totalRequests > 0 ? 
        this.stats.hits / this.stats.totalRequests : 0,
      missRate: this.stats.totalRequests > 0 ? 
        this.stats.misses / this.stats.totalRequests : 0,
      evictions: this.stats.evictions,
      memoryUsage: this.calculateCacheSize(this.memoryCache)
    };
  }

  // Helper methods
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private updateAccessStats(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  private async promoteToMemoryCache(key: string, entry: CacheEntry): Promise<void> {
    const policy = this.policies.get('memory') || this.DEFAULT_POLICY;
    
    if (entry.size! < policy.maxSize * 0.1) { // Only promote small entries
      await this.ensureCapacity(this.memoryCache, policy);
      this.memoryCache.set(key, entry);
    }
  }

  private calculateSize(data: any): number {
    if (data instanceof Blob) {
      return data.size;
    }
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 1024; // Default 1KB estimate
    }
  }

  private calculateCacheSize(cache: Map<string, CacheEntry>): number {
    let total = 0;
    for (const entry of cache.values()) {
      total += entry.size || 0;
    }
    return total;
  }

  private async getFromIndexedDB<T>(key: string): Promise<T | null> {
    try {
      // Implementation would use offlineDB to get cached data
      return null; // Placeholder
    } catch {
      return null;
    }
  }

  private async storeInIndexedDB(entry: CacheEntry): Promise<void> {
    try {
      // Implementation would use offlineDB to store critical cache data
    } catch (error) {
      voiceLogger.warn('Failed to store in IndexedDB', { key: entry.key, error });
    }
  }

  private async removeFromIndexedDB(key: string): Promise<void> {
    try {
      // Implementation would use offlineDB to remove cached data
    } catch (error) {
      voiceLogger.warn('Failed to remove from IndexedDB', { key, error });
    }
  }

  private setupCleanupInterval(): void {
    // Run cleanup every 10 minutes
    setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();
/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/cache/distance-matrix.cache.ts
 * phase: 3
 * domain: scheduling
 * purpose: Cache distance and travel time calculations
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 200
 * state_machine: none
 * estimated_llm_cost: 0.001
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - dexie
 *   supabase:
 *     - none (local cache only)
 * exports:
 *   - DistanceMatrixCache
 *   - CacheEntry
 * voice_considerations:
 *   - None (backend service)
 * test_requirements:
 *   coverage: 95%
 *   test_file: src/__tests__/scheduling/unit/distance-matrix-cache.test.ts
 * tasks:
 *   - Implement in-memory and persistent cache
 *   - Support TTL-based expiration
 *   - Handle cache size limits
 *   - Provide cache statistics
 */

import Dexie, { Table } from 'dexie';
import { logger } from '@/core/logger/voice-logger';

export interface CacheEntry {
  key: string;
  durationMinutes: number;
  distanceMiles: number;
  trafficDurationMinutes?: number;
  hasTrafficData: boolean;
  timestamp: string;
  expiresAt: string;
  accessCount: number;
  lastAccessed: string;
}

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  averageAge: number;
  sizeBytes: number;
}

class DistanceMatrixDatabase extends Dexie {
  distanceCache!: Table<CacheEntry>;

  constructor() {
    super('DistanceMatrixCache');
    
    this.version(1).stores({
      distanceCache: 'key, expiresAt, lastAccessed, accessCount'
    });
  }
}

export class DistanceMatrixCache {
  private db: DistanceMatrixDatabase;
  private memoryCache: Map<string, CacheEntry>;
  private stats = {
    hitCount: 0,
    missCount: 0
  };
  private maxMemoryEntries = 1000;
  private defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
  private trafficTTL = 15 * 60 * 1000; // 15 minutes for traffic data

  constructor() {
    this.db = new DistanceMatrixDatabase();
    this.memoryCache = new Map();
    this.initializeCleanup();
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && this.isValid(memoryEntry)) {
        this.stats.hitCount++;
        await this.updateAccessStats(key);
        return memoryEntry;
      }

      // Check persistent cache
      const dbEntry = await this.db.distanceCache.get(key);
      if (dbEntry && this.isValid(dbEntry)) {
        this.stats.hitCount++;
        
        // Promote to memory cache
        this.memoryCache.set(key, dbEntry);
        this.enforceMemoryLimit();
        
        await this.updateAccessStats(key);
        return dbEntry;
      }

      this.stats.missCount++;
      return null;
    } catch (error) {
      logger.error('Cache get error', { error, key });
      return null;
    }
  }

  async set(key: string, data: Omit<CacheEntry, 'key' | 'expiresAt' | 'accessCount' | 'lastAccessed'>): Promise<void> {
    try {
      const ttl = data.hasTrafficData ? this.trafficTTL : this.defaultTTL;
      const now = new Date();
      
      const entry: CacheEntry = {
        ...data,
        key,
        timestamp: data.timestamp || now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl).toISOString(),
        accessCount: 0,
        lastAccessed: now.toISOString()
      };

      // Update both caches
      this.memoryCache.set(key, entry);
      await this.db.distanceCache.put(entry);
      
      this.enforceMemoryLimit();
      
      logger.debug('Cache entry added', { 
        key, 
        ttl: ttl / 1000 / 60, 
        hasTraffic: data.hasTrafficData 
      });
    } catch (error) {
      logger.error('Cache set error', { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      await this.db.distanceCache.delete(key);
    } catch (error) {
      logger.error('Cache delete error', { error, key });
    }
  }

  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      await this.db.distanceCache.clear();
      this.stats.hitCount = 0;
      this.stats.missCount = 0;
      logger.info('Distance matrix cache cleared');
    } catch (error) {
      logger.error('Cache clear error', { error });
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const entries = await this.db.distanceCache.toArray();
      const now = Date.now();
      
      let totalAge = 0;
      let validEntries = 0;
      
      for (const entry of entries) {
        if (this.isValid(entry)) {
          validEntries++;
          totalAge += now - new Date(entry.timestamp).getTime();
        }
      }

      const hitRate = this.stats.hitCount + this.stats.missCount > 0
        ? this.stats.hitCount / (this.stats.hitCount + this.stats.missCount)
        : 0;

      // Estimate size (rough approximation)
      const avgEntrySize = 200; // bytes
      const sizeBytes = entries.length * avgEntrySize;

      return {
        totalEntries: validEntries,
        hitCount: this.stats.hitCount,
        missCount: this.stats.missCount,
        hitRate: Math.round(hitRate * 100) / 100,
        averageAge: validEntries > 0 ? Math.round(totalAge / validEntries / 1000 / 60) : 0, // minutes
        sizeBytes
      };
    } catch (error) {
      logger.error('Error getting cache stats', { error });
      return {
        totalEntries: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0,
        averageAge: 0,
        sizeBytes: 0
      };
    }
  }

  async cleanExpired(): Promise<number> {
    try {
      const now = new Date().toISOString();
      const expired = await this.db.distanceCache
        .where('expiresAt')
        .below(now)
        .toArray();

      const expiredKeys = expired.map(e => e.key);
      
      // Remove from memory cache
      for (const key of expiredKeys) {
        this.memoryCache.delete(key);
      }

      // Remove from database
      await this.db.distanceCache.bulkDelete(expiredKeys);

      if (expiredKeys.length > 0) {
        logger.info('Cleaned expired cache entries', { count: expiredKeys.length });
      }

      return expiredKeys.length;
    } catch (error) {
      logger.error('Error cleaning expired cache entries', { error });
      return 0;
    }
  }

  async warmCache(frequentRoutes: Array<{ origin: any; destination: any }>): Promise<void> {
    logger.info('Warming distance cache', { routeCount: frequentRoutes.length });
    
    // This would be called with frequently used routes to pre-populate the cache
    // Implementation would depend on having access to TravelTimeService
  }

  private isValid(entry: CacheEntry): boolean {
    return new Date(entry.expiresAt) > new Date();
  }

  private async updateAccessStats(key: string): Promise<void> {
    try {
      const entry = await this.db.distanceCache.get(key);
      if (entry) {
        entry.accessCount++;
        entry.lastAccessed = new Date().toISOString();
        await this.db.distanceCache.put(entry);
      }
    } catch (error) {
      // Non-critical error, just log
      logger.debug('Error updating access stats', { error, key });
    }
  }

  private enforceMemoryLimit(): void {
    if (this.memoryCache.size <= this.maxMemoryEntries) return;

    // Remove least recently used entries
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => {
        const aTime = new Date(a[1].lastAccessed).getTime();
        const bTime = new Date(b[1].lastAccessed).getTime();
        return aTime - bTime;
      });

    const toRemove = entries.slice(0, this.memoryCache.size - this.maxMemoryEntries);
    for (const [key] of toRemove) {
      this.memoryCache.delete(key);
    }
  }

  private initializeCleanup(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanExpired().catch(error => {
        logger.error('Periodic cleanup failed', { error });
      });
    }, 60 * 60 * 1000);

    // Initial cleanup
    this.cleanExpired().catch(error => {
      logger.error('Initial cleanup failed', { error });
    });
  }

  async exportCache(): Promise<CacheEntry[]> {
    try {
      const entries = await this.db.distanceCache.toArray();
      return entries.filter(e => this.isValid(e));
    } catch (error) {
      logger.error('Error exporting cache', { error });
      return [];
    }
  }

  async importCache(entries: CacheEntry[]): Promise<void> {
    try {
      // Validate and update timestamps
      const now = new Date();
      const validEntries = entries
        .filter(e => this.isValid(e))
        .map(e => ({
          ...e,
          lastAccessed: now.toISOString()
        }));

      await this.db.distanceCache.bulkPut(validEntries);
      logger.info('Cache imported', { count: validEntries.length });
    } catch (error) {
      logger.error('Error importing cache', { error });
    }
  }
}
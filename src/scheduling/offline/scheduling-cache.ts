/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/scheduling-cache.ts
 * phase: 3
 * domain: scheduling
 * purpose: IndexedDB schema and operations for offline caching
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 300
 * state_machine: none
 * estimated_llm_cost: 0.002
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - dexie
 *   supabase:
 *     - none (offline only)
 * exports:
 *   - SchedulingOfflineDB
 *   - OfflineDayPlan
 *   - OfflineScheduleEvent
 *   - OfflineKit
 * voice_considerations:
 *   - Track voice commands offline
 *   - Store voice transcripts locally
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/scheduling-cache.test.ts
 * tasks:
 *   - Define IndexedDB schema
 *   - Implement CRUD operations
 *   - Handle cache size limits
 *   - Support data expiration
 */

import Dexie, { Table } from 'dexie';
import { logger } from '@/core/logger/voice-logger';

// Offline data models
export interface OfflineDayPlan {
  id: string;
  tenant_id: string;
  user_id: string;
  plan_date: string;
  status: string;
  route_data?: any;
  total_distance_miles?: number;
  estimated_duration_minutes?: number;
  metadata?: any;
  offline_created?: boolean;
  offline_modified?: boolean;
  sync_status: 'pending' | 'synced' | 'conflict';
  last_synced?: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineScheduleEvent {
  id: string;
  tenant_id: string;
  day_plan_id: string;
  event_type: string;
  job_id?: string;
  sequence_order: number;
  scheduled_start?: string;
  scheduled_duration_minutes?: number;
  actual_start?: string;
  actual_end?: string;
  status: string;
  location_data?: any;
  address?: any;
  notes?: string;
  voice_notes?: string;
  metadata?: any;
  offline_created?: boolean;
  offline_modified?: boolean;
  sync_status: 'pending' | 'synced' | 'conflict';
  last_synced?: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineKit {
  id: string;
  tenant_id: string;
  kit_code: string;
  name: string;
  description?: string;
  category?: string;
  is_active: boolean;
  metadata?: any;
  items?: OfflineKitItem[];
  variants?: OfflineKitVariant[];
  last_synced: string;
}

export interface OfflineKitItem {
  id: string;
  kit_id: string;
  item_type: string;
  quantity: number;
  unit?: string;
  is_required: boolean;
  metadata?: any;
}

export interface OfflineKitVariant {
  id: string;
  kit_id: string;
  variant_code: string;
  name: string;
  is_default: boolean;
  metadata?: any;
}

export interface OfflineOverride {
  id: string;
  tenant_id: string;
  job_id: string;
  kit_id?: string;
  item_id?: string;
  technician_id: string;
  override_reason: string;
  voice_initiated: boolean;
  offline_created: boolean;
  sync_status: 'pending' | 'synced' | 'failed';
  created_at: string;
}

export interface OfflineVoiceCommand {
  id: string;
  user_id: string;
  command_text: string;
  intent_type?: string;
  parameters?: any;
  processed: boolean;
  result?: any;
  error?: string;
  created_at: string;
}

export interface CacheMetadata {
  id: string;
  table_name: string;
  last_sync: string;
  record_count: number;
  size_bytes: number;
}

// Database schema
export class SchedulingOfflineDB extends Dexie {
  dayPlans!: Table<OfflineDayPlan>;
  scheduleEvents!: Table<OfflineScheduleEvent>;
  kits!: Table<OfflineKit>;
  overrides!: Table<OfflineOverride>;
  voiceCommands!: Table<OfflineVoiceCommand>;
  metadata!: Table<CacheMetadata>;

  constructor() {
    super('SchedulingOfflineDB');

    this.version(1).stores({
      dayPlans: 'id, [tenant_id+user_id+plan_date], sync_status, updated_at',
      scheduleEvents: 'id, day_plan_id, [tenant_id+job_id], sync_status, updated_at',
      kits: 'id, [tenant_id+kit_code], last_synced',
      overrides: 'id, [tenant_id+job_id], sync_status, created_at',
      voiceCommands: 'id, user_id, created_at, processed',
      metadata: 'id, table_name'
    });

    // Hooks for automatic timestamps
    this.dayPlans.hook('creating', (primaryKey, obj) => {
      obj.created_at = obj.created_at || new Date().toISOString();
      obj.updated_at = new Date().toISOString();
      obj.offline_created = true;
      obj.sync_status = 'pending';
    });

    this.dayPlans.hook('updating', (modifications, primaryKey, obj) => {
      modifications.updated_at = new Date().toISOString();
      if (!obj.offline_created) {
        modifications.offline_modified = true;
        modifications.sync_status = 'pending';
      }
    });

    this.scheduleEvents.hook('creating', (primaryKey, obj) => {
      obj.created_at = obj.created_at || new Date().toISOString();
      obj.updated_at = new Date().toISOString();
      obj.offline_created = true;
      obj.sync_status = 'pending';
    });

    this.scheduleEvents.hook('updating', (modifications, primaryKey, obj) => {
      modifications.updated_at = new Date().toISOString();
      if (!obj.offline_created) {
        modifications.offline_modified = true;
        modifications.sync_status = 'pending';
      }
    });
  }

  async init(): Promise<void> {
    try {
      await this.open();
      logger.info('Offline database initialized');
      await this.updateMetadata();
    } catch (error) {
      logger.error('Failed to initialize offline database', { error });
      throw error;
    }
  }

  // Day Plan operations
  async saveDayPlan(dayPlan: Partial<OfflineDayPlan>): Promise<string> {
    try {
      const id = dayPlan.id || this.generateOfflineId('dp');
      await this.dayPlans.put({ ...dayPlan, id } as OfflineDayPlan);
      return id;
    } catch (error) {
      logger.error('Error saving offline day plan', { error, dayPlan });
      throw error;
    }
  }

  async getDayPlan(id: string): Promise<OfflineDayPlan | undefined> {
    return this.dayPlans.get(id);
  }

  async getDayPlanByUserAndDate(
    userId: string,
    date: string,
    tenantId: string
  ): Promise<OfflineDayPlan | undefined> {
    return this.dayPlans
      .where('[tenant_id+user_id+plan_date]')
      .equals([tenantId, userId, date])
      .first();
  }

  // Schedule Event operations
  async saveScheduleEvent(event: Partial<OfflineScheduleEvent>): Promise<string> {
    try {
      const id = event.id || this.generateOfflineId('se');
      await this.scheduleEvents.put({ ...event, id } as OfflineScheduleEvent);
      return id;
    } catch (error) {
      logger.error('Error saving offline schedule event', { error, event });
      throw error;
    }
  }

  async getScheduleEventsByDayPlan(dayPlanId: string): Promise<OfflineScheduleEvent[]> {
    return this.scheduleEvents
      .where('day_plan_id')
      .equals(dayPlanId)
      .sortBy('sequence_order');
  }

  // Kit operations
  async saveKit(kit: OfflineKit): Promise<void> {
    try {
      kit.last_synced = new Date().toISOString();
      await this.kits.put(kit);
    } catch (error) {
      logger.error('Error saving offline kit', { error, kit });
      throw error;
    }
  }

  async getKit(id: string): Promise<OfflineKit | undefined> {
    return this.kits.get(id);
  }

  async getKitByCode(code: string, tenantId: string): Promise<OfflineKit | undefined> {
    return this.kits
      .where('[tenant_id+kit_code]')
      .equals([tenantId, code])
      .first();
  }

  // Override operations
  async saveOverride(override: Partial<OfflineOverride>): Promise<string> {
    try {
      const id = override.id || this.generateOfflineId('or');
      await this.overrides.put({
        ...override,
        id,
        offline_created: true,
        sync_status: 'pending',
        created_at: new Date().toISOString()
      } as OfflineOverride);
      return id;
    } catch (error) {
      logger.error('Error saving offline override', { error, override });
      throw error;
    }
  }

  // Voice command operations
  async saveVoiceCommand(command: Partial<OfflineVoiceCommand>): Promise<string> {
    try {
      const id = command.id || this.generateOfflineId('vc');
      await this.voiceCommands.put({
        ...command,
        id,
        processed: false,
        created_at: new Date().toISOString()
      } as OfflineVoiceCommand);
      return id;
    } catch (error) {
      logger.error('Error saving offline voice command', { error, command });
      throw error;
    }
  }

  async getUnprocessedVoiceCommands(userId: string): Promise<OfflineVoiceCommand[]> {
    return this.voiceCommands
      .where('user_id')
      .equals(userId)
      .and(vc => !vc.processed)
      .sortBy('created_at');
  }

  async markVoiceCommandProcessed(id: string, result?: any): Promise<void> {
    await this.voiceCommands.update(id, {
      processed: true,
      result
    });
  }

  // Sync operations
  async getPendingSyncItems(): Promise<{
    dayPlans: OfflineDayPlan[];
    scheduleEvents: OfflineScheduleEvent[];
    overrides: OfflineOverride[];
  }> {
    const [dayPlans, scheduleEvents, overrides] = await Promise.all([
      this.dayPlans.where('sync_status').equals('pending').toArray(),
      this.scheduleEvents.where('sync_status').equals('pending').toArray(),
      this.overrides.where('sync_status').equals('pending').toArray()
    ]);

    return { dayPlans, scheduleEvents, overrides };
  }

  async markSynced(table: string, id: string): Promise<void> {
    const now = new Date().toISOString();
    
    switch (table) {
      case 'dayPlans':
        await this.dayPlans.update(id, {
          sync_status: 'synced',
          last_synced: now,
          offline_created: false,
          offline_modified: false
        });
        break;
      case 'scheduleEvents':
        await this.scheduleEvents.update(id, {
          sync_status: 'synced',
          last_synced: now,
          offline_created: false,
          offline_modified: false
        });
        break;
      case 'overrides':
        await this.overrides.update(id, { sync_status: 'synced' });
        break;
    }
  }

  async markConflict(table: string, id: string): Promise<void> {
    switch (table) {
      case 'dayPlans':
        await this.dayPlans.update(id, { sync_status: 'conflict' });
        break;
      case 'scheduleEvents':
        await this.scheduleEvents.update(id, { sync_status: 'conflict' });
        break;
    }
  }

  // Cache management
  async getCacheSize(): Promise<number> {
    // Estimate size based on record counts
    const counts = await Promise.all([
      this.dayPlans.count(),
      this.scheduleEvents.count(),
      this.kits.count(),
      this.overrides.count(),
      this.voiceCommands.count()
    ]);

    const avgSizes = [1024, 512, 2048, 256, 256]; // Estimated bytes per record
    return counts.reduce((total, count, index) => total + count * avgSizes[index], 0);
  }

  async cleanOldData(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    const deleteCounts = await Promise.all([
      this.dayPlans
        .where('updated_at')
        .below(cutoffISO)
        .and(dp => dp.sync_status === 'synced')
        .delete(),
      this.scheduleEvents
        .where('updated_at')
        .below(cutoffISO)
        .and(se => se.sync_status === 'synced')
        .delete(),
      this.voiceCommands
        .where('created_at')
        .below(cutoffISO)
        .and(vc => vc.processed)
        .delete()
    ]);

    const totalDeleted = deleteCounts.reduce((sum, count) => sum + count, 0);
    logger.info('Cleaned old offline data', { totalDeleted, daysToKeep });
    return totalDeleted;
  }

  private async updateMetadata(): Promise<void> {
    const tables = ['dayPlans', 'scheduleEvents', 'kits', 'overrides', 'voiceCommands'];
    
    for (const tableName of tables) {
      const count = await (this as any)[tableName].count();
      await this.metadata.put({
        id: tableName,
        table_name: tableName,
        last_sync: new Date().toISOString(),
        record_count: count,
        size_bytes: count * 512 // Rough estimate
      });
    }
  }

  private generateOfflineId(prefix: string): string {
    return `${prefix}_offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map(table => table.clear()));
    });
    logger.info('All offline data cleared');
  }
}
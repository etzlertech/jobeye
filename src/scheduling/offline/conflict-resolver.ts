/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/conflict-resolver.ts
 * phase: 3
 * domain: scheduling
 * purpose: Resolve sync conflicts with role-based priorities
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 250
 * state_machine: idle -> analyzing -> resolved/manual_required
 * estimated_llm_cost: 0.002
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/scheduling/offline/scheduling-cache"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - date-fns
 *   supabase:
 *     - none (offline conflict resolution)
 * exports:
 *   - ConflictResolver
 *   - ConflictResolution
 *   - ResolutionStrategy
 * voice_considerations:
 *   - Voice prompts for manual resolution
 *   - Simple conflict explanations
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/conflict-resolver.test.ts
 * tasks:
 *   - Implement conflict detection
 *   - Apply role-based resolution rules
 *   - Handle voice command conflicts
 *   - Support manual resolution
 */

import { compareAsc, compareDesc, isAfter } from 'date-fns';
import { SchedulingOfflineDB, OfflineDayPlan, OfflineScheduleEvent } from '@/scheduling/offline/scheduling-cache';
import { logger } from '@/core/logger/voice-logger';

export enum ConflictType {
  SCHEDULE_UPDATE = 'schedule_update',
  TIME_OVERLAP = 'time_overlap',
  STATUS_CHANGE = 'status_change',
  LOCATION_CHANGE = 'location_change',
  KIT_ASSIGNMENT = 'kit_assignment',
  VOICE_COMMAND = 'voice_command',
  DELETION = 'deletion'
}

export enum ResolutionStrategy {
  ACCEPT_LOCAL = 'accept_local',
  ACCEPT_REMOTE = 'accept_remote',
  MERGE = 'merge',
  MANUAL = 'manual'
}

export enum UserRole {
  TECHNICIAN = 'technician',
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin',
  SYSTEM = 'system'
}

export interface ConflictContext {
  type: ConflictType;
  localData: any;
  remoteData: any;
  localTimestamp: Date;
  remoteTimestamp: Date;
  localRole: UserRole;
  remoteRole: UserRole;
  metadata?: {
    fieldChanged?: string;
    voiceInitiated?: boolean;
    offlineMinutes?: number;
  };
}

export interface ConflictResolution {
  strategy: ResolutionStrategy;
  resolvedData: any;
  explanation: string;
  voiceExplanation: string;
  requiresConfirmation: boolean;
  autoResolved: boolean;
}

export class ConflictResolver {
  private rolePriority: Map<UserRole, number> = new Map([
    [UserRole.TECHNICIAN, 1],
    [UserRole.SUPERVISOR, 2],
    [UserRole.ADMIN, 3],
    [UserRole.SYSTEM, 4]
  ]);

  private resolutionRules: Array<{
    condition: (context: ConflictContext) => boolean;
    strategy: (context: ConflictContext) => ResolutionStrategy;
    priority: number;
  }> = [];

  constructor(private db: SchedulingOfflineDB) {
    this.initializeRules();
  }

  private initializeRules(): void {
    // Rule 1: System always wins
    this.addRule(
      (ctx) => ctx.remoteRole === UserRole.SYSTEM,
      () => ResolutionStrategy.ACCEPT_REMOTE,
      100
    );

    // Rule 2: Higher role wins for status changes
    this.addRule(
      (ctx) => ctx.type === ConflictType.STATUS_CHANGE,
      (ctx) => this.getRolePriority(ctx.remoteRole) > this.getRolePriority(ctx.localRole)
        ? ResolutionStrategy.ACCEPT_REMOTE
        : ResolutionStrategy.ACCEPT_LOCAL,
      90
    );

    // Rule 3: Voice commands from field get priority for certain updates
    this.addRule(
      (ctx) => ctx.metadata?.voiceInitiated && ctx.localRole === UserRole.TECHNICIAN &&
               (ctx.type === ConflictType.STATUS_CHANGE || ctx.type === ConflictType.LOCATION_CHANGE),
      () => ResolutionStrategy.ACCEPT_LOCAL,
      85
    );

    // Rule 4: Merge non-conflicting field changes
    this.addRule(
      (ctx) => ctx.type === ConflictType.SCHEDULE_UPDATE && 
               this.canMergeChanges(ctx.localData, ctx.remoteData),
      () => ResolutionStrategy.MERGE,
      80
    );

    // Rule 5: Most recent wins for time overlaps
    this.addRule(
      (ctx) => ctx.type === ConflictType.TIME_OVERLAP,
      (ctx) => isAfter(ctx.localTimestamp, ctx.remoteTimestamp)
        ? ResolutionStrategy.ACCEPT_LOCAL
        : ResolutionStrategy.ACCEPT_REMOTE,
      70
    );

    // Rule 6: Offline duration consideration
    this.addRule(
      (ctx) => (ctx.metadata?.offlineMinutes || 0) > 60,
      () => ResolutionStrategy.MANUAL,
      60
    );

    // Rule 7: Default - higher role wins
    this.addRule(
      () => true,
      (ctx) => this.getRolePriority(ctx.remoteRole) >= this.getRolePriority(ctx.localRole)
        ? ResolutionStrategy.ACCEPT_REMOTE
        : ResolutionStrategy.ACCEPT_LOCAL,
      0
    );
  }

  private addRule(
    condition: (context: ConflictContext) => boolean,
    strategy: (context: ConflictContext) => ResolutionStrategy,
    priority: number
  ): void {
    this.resolutionRules.push({ condition, strategy, priority });
    this.resolutionRules.sort((a, b) => b.priority - a.priority);
  }

  async resolveConflict(context: ConflictContext): Promise<ConflictResolution> {
    try {
      logger.info('Resolving conflict', {
        type: context.type,
        localRole: context.localRole,
        remoteRole: context.remoteRole,
        metadata: { voice: { initiated: context.metadata?.voiceInitiated } }
      });

      // Find applicable rule
      const applicableRule = this.resolutionRules.find(rule => rule.condition(context));
      
      if (!applicableRule) {
        return this.createManualResolution(context, 'No automatic resolution rule found');
      }

      const strategy = applicableRule.strategy(context);

      switch (strategy) {
        case ResolutionStrategy.ACCEPT_LOCAL:
          return this.createLocalResolution(context);
        case ResolutionStrategy.ACCEPT_REMOTE:
          return this.createRemoteResolution(context);
        case ResolutionStrategy.MERGE:
          return this.createMergeResolution(context);
        case ResolutionStrategy.MANUAL:
          return this.createManualResolution(context, 'Manual resolution required by rules');
        default:
          return this.createManualResolution(context, 'Unknown resolution strategy');
      }
    } catch (error) {
      logger.error('Error resolving conflict', { error, context });
      return this.createManualResolution(context, 'Error during conflict resolution');
    }
  }

  async resolveScheduleConflicts(
    localDayPlan: OfflineDayPlan,
    remoteDayPlan: any,
    userRole: UserRole
  ): Promise<ConflictResolution[]> {
    const conflicts: ConflictResolution[] = [];

    // Compare day plan level changes
    if (this.hasConflictingChanges(localDayPlan, remoteDayPlan)) {
      const context: ConflictContext = {
        type: ConflictType.SCHEDULE_UPDATE,
        localData: localDayPlan,
        remoteData: remoteDayPlan,
        localTimestamp: new Date(localDayPlan.updated_at),
        remoteTimestamp: new Date(remoteDayPlan.updated_at),
        localRole: userRole,
        remoteRole: this.inferRole(remoteDayPlan),
        metadata: {
          offlineMinutes: this.calculateOfflineMinutes(localDayPlan)
        }
      };

      conflicts.push(await this.resolveConflict(context));
    }

    // Compare events
    const localEvents = await this.db.getScheduleEventsByDayPlan(localDayPlan.id);
    const remoteEvents = remoteDayPlan.events || [];

    for (const localEvent of localEvents) {
      const remoteEvent = remoteEvents.find((e: any) => e.id === localEvent.id);
      
      if (remoteEvent && this.hasConflictingChanges(localEvent, remoteEvent)) {
        const eventContext: ConflictContext = {
          type: this.determineConflictType(localEvent, remoteEvent),
          localData: localEvent,
          remoteData: remoteEvent,
          localTimestamp: new Date(localEvent.updated_at),
          remoteTimestamp: new Date(remoteEvent.updated_at),
          localRole: userRole,
          remoteRole: this.inferRole(remoteEvent),
          metadata: {
            voiceInitiated: localEvent.voice_notes ? true : false
          }
        };

        conflicts.push(await this.resolveConflict(eventContext));
      }
    }

    return conflicts;
  }

  private createLocalResolution(context: ConflictContext): ConflictResolution {
    return {
      strategy: ResolutionStrategy.ACCEPT_LOCAL,
      resolvedData: context.localData,
      explanation: `Keeping local ${context.type} changes made by ${context.localRole}`,
      voiceExplanation: 'Keeping your changes',
      requiresConfirmation: false,
      autoResolved: true
    };
  }

  private createRemoteResolution(context: ConflictContext): ConflictResolution {
    return {
      strategy: ResolutionStrategy.ACCEPT_REMOTE,
      resolvedData: context.remoteData,
      explanation: `Accepting remote ${context.type} changes made by ${context.remoteRole}`,
      voiceExplanation: 'Accepting server changes',
      requiresConfirmation: false,
      autoResolved: true
    };
  }

  private createMergeResolution(context: ConflictContext): ConflictResolution {
    const mergedData = this.mergeData(context.localData, context.remoteData);
    
    return {
      strategy: ResolutionStrategy.MERGE,
      resolvedData: mergedData,
      explanation: 'Merged non-conflicting changes from both versions',
      voiceExplanation: 'Combined changes',
      requiresConfirmation: true,
      autoResolved: true
    };
  }

  private createManualResolution(context: ConflictContext, reason: string): ConflictResolution {
    return {
      strategy: ResolutionStrategy.MANUAL,
      resolvedData: null,
      explanation: `Manual resolution required: ${reason}`,
      voiceExplanation: 'Needs manual review',
      requiresConfirmation: true,
      autoResolved: false
    };
  }

  private hasConflictingChanges(local: any, remote: any): boolean {
    // Skip if same update timestamp
    if (local.updated_at === remote.updated_at) return false;

    // Check for field conflicts
    const conflictFields = ['status', 'scheduled_start', 'location_data', 'sequence_order'];
    
    for (const field of conflictFields) {
      if (local[field] !== remote[field]) {
        return true;
      }
    }

    return false;
  }

  private canMergeChanges(local: any, remote: any): boolean {
    // Identify changed fields in each version
    const localChanges = new Set<string>();
    const remoteChanges = new Set<string>();

    for (const key in local) {
      if (local[key] !== remote[key]) localChanges.add(key);
    }

    for (const key in remote) {
      if (remote[key] !== local[key]) remoteChanges.add(key);
    }

    // Check for overlapping changes (excluding metadata fields)
    const conflictingFields = ['status', 'scheduled_start', 'location_data'];
    
    for (const field of conflictingFields) {
      if (localChanges.has(field) && remoteChanges.has(field)) {
        return false;
      }
    }

    return true;
  }

  private mergeData(local: any, remote: any): any {
    const merged = { ...remote }; // Start with remote as base

    // Apply local changes that don't conflict
    for (const key in local) {
      if (key === 'updated_at' || key === 'sync_status') continue;
      
      // If remote hasn't changed this field, use local value
      if (remote[key] === local[key] || !remote.hasOwnProperty(key)) {
        merged[key] = local[key];
      }
    }

    // Merge arrays intelligently
    if (local.metadata && remote.metadata) {
      merged.metadata = { ...remote.metadata, ...local.metadata };
    }

    return merged;
  }

  private determineConflictType(local: any, remote: any): ConflictType {
    if (local.status !== remote.status) return ConflictType.STATUS_CHANGE;
    if (local.scheduled_start !== remote.scheduled_start) return ConflictType.TIME_OVERLAP;
    if (local.location_data !== remote.location_data) return ConflictType.LOCATION_CHANGE;
    if (local.voice_notes && !remote.voice_notes) return ConflictType.VOICE_COMMAND;
    return ConflictType.SCHEDULE_UPDATE;
  }

  private getRolePriority(role: UserRole): number {
    return this.rolePriority.get(role) || 0;
  }

  private inferRole(data: any): UserRole {
    // Infer role from metadata or default to system
    if (data.metadata?.updated_by_role) {
      return data.metadata.updated_by_role as UserRole;
    }
    if (data.metadata?.source === 'admin_portal') {
      return UserRole.ADMIN;
    }
    if (data.metadata?.source === 'mobile_app') {
      return UserRole.TECHNICIAN;
    }
    return UserRole.SYSTEM;
  }

  private calculateOfflineMinutes(data: any): number {
    if (!data.last_synced) return 0;
    
    const lastSync = new Date(data.last_synced);
    const now = new Date();
    return Math.floor((now.getTime() - lastSync.getTime()) / 60000);
  }

  async applyResolution(resolution: ConflictResolution, entityType: string, entityId: string): Promise<void> {
    if (!resolution.autoResolved || !resolution.resolvedData) {
      logger.warn('Cannot apply manual resolution automatically', { entityType, entityId });
      return;
    }

    try {
      switch (entityType) {
        case 'dayPlan':
          await this.db.saveDayPlan(resolution.resolvedData);
          await this.db.markSynced('dayPlans', entityId);
          break;
        case 'scheduleEvent':
          await this.db.saveScheduleEvent(resolution.resolvedData);
          await this.db.markSynced('scheduleEvents', entityId);
          break;
      }

      logger.info('Applied conflict resolution', {
        entityType,
        entityId,
        strategy: resolution.strategy,
        metadata: { voice: { explanation: resolution.voiceExplanation } }
      });
    } catch (error) {
      logger.error('Error applying resolution', { error, entityType, entityId });
      throw error;
    }
  }
}
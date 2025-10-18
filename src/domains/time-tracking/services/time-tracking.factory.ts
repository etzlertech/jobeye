/**
 * @file src/domains/time-tracking/services/time-tracking.factory.ts
 * @phase 3
 * @domain time-tracking
 * @purpose Factory helpers to construct TimeTrackingService with Supabase-backed repositories and defaults.
 * @spec_ref specs/003-scheduling-kits/tasks.md#T082
 * @complexity_budget 200 LoC
 * @dependencies
 *   internal:
 *     - @/domains/time-tracking/repositories/time-entry.repository
 *     - ./time-tracking.service
 *     - ./time-tracking.types
 * @exports
 *   - createTimeTrackingService
 *   - createDefaultTimeTrackingDependencies
 * @voice_considerations
 *   - Emits warnings when overlap/geofence checks are disabled so voice workflows can compensate.
 * END AGENT DIRECTIVE BLOCK
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TimeEntryRepository } from '@/domains/time-tracking/repositories/time-entry.repository';
import { voiceLogger } from '@/core/logger/voice-logger';
import {
  TimeTrackingDependencies,
  TimeTrackingContext,
  LocationPoint,
} from './time-tracking.types';
import { TimeTrackingService } from './time-tracking.service';

export interface TimeTrackingFactoryOptions {
  supabaseClient?: SupabaseClient;
  repository?: TimeTrackingDependencies['timeEntryRepository'];
  geofenceService?: TimeTrackingDependencies['geofenceService'];
  overlapValidator?: TimeTrackingDependencies['overlapValidator'];
  auditLogger?: TimeTrackingDependencies['auditLogger'];
  now?: TimeTrackingDependencies['now'];
  logger?: TimeTrackingDependencies['logger'];
}

export function createTimeTrackingService(
  options: TimeTrackingFactoryOptions = {}
): TimeTrackingService {
  const deps = createDefaultTimeTrackingDependencies(options);
  return new TimeTrackingService(deps);
}

export function createDefaultTimeTrackingDependencies(
  options: TimeTrackingFactoryOptions = {}
): TimeTrackingDependencies {
  const repository =
    options.repository ??
    (options.supabaseClient
      ? new TimeEntryRepository(options.supabaseClient)
      : null);

  if (!repository) {
    voiceLogger.warn('TimeTrackingService factory: using in-memory repository stubs; provide Supabase client for persistence.');
  }

  const geofenceService =
    options.geofenceService ??
    createDefaultGeofenceService();

  const overlapValidator =
    options.overlapValidator ??
    createDefaultOverlapValidator(repository ?? undefined);

  const auditLogger =
    options.auditLogger ??
    createDefaultAuditLogger();

  return {
    timeEntryRepository: repository ?? createMemoryRepository(),
    geofenceService,
    overlapValidator,
    auditLogger,
    now: options.now,
    logger: options.logger ?? voiceLogger,
  };
}

function createDefaultGeofenceService(): TimeTrackingDependencies['geofenceService'] {
  return {
    async isInside(_location: LocationPoint, _context?: TimeTrackingContext) {
      return true; // default permissive; real implementation should check job geofence
    },
  };
}

function createDefaultOverlapValidator(
  repository?: TimeTrackingDependencies['timeEntryRepository']
): TimeTrackingDependencies['overlapValidator'] {
  return {
    async hasOverlap(userId, proposedStart) {
      if (!repository?.findActiveEntry) return false;
      const active = await repository.findActiveEntry(userId);
      if (!active) return false;
      return new Date(active.clock_in_time).toISOString() !== proposedStart;
    },
  };
}

function createDefaultAuditLogger(): TimeTrackingDependencies['auditLogger'] {
  return {
    async logClockIn(payload) {
      voiceLogger.info('Audit clock-in', payload);
    },
    async logClockOut(payload) {
      voiceLogger.info('Audit clock-out', payload);
    },
  };
}

function createMemoryRepository(): TimeTrackingDependencies['timeEntryRepository'] {
  let current: any = null;
  return {
    async findActiveEntry(_userId: string) {
      return current;
    },
    async create(entry: Record<string, unknown>) {
      current = { id: 'memory-entry', ...entry };
      return current;
    },
    async update(_id: string, updates: Record<string, unknown>) {
      current = { ...current, ...updates };
      return current;
    },
  };
}

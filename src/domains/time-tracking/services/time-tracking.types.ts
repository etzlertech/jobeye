/**
 * @file src/domains/time-tracking/services/time-tracking.types.ts
 * @phase 3
 * @domain time-tracking
 * @purpose Shared types and dependency contracts for TimeTrackingService.
 * @spec_ref specs/003-scheduling-kits/tasks.md#T082
 * @complexity_budget 200 LoC
 * @dependencies []
 * @exports
 *   - LocationPoint
 *   - TimeTrackingContext
 *   - ClockSource
 *   - ClockInOptions
 *   - ClockInResponse
 *   - ClockOutResponse
 *   - TimeTrackingDependencies
 *   - TimeEntryRecord
 * @voice_considerations
 *   - Types include metadata needed for voice confirmations (source, duration, geofence status).
 * END AGENT DIRECTIVE BLOCK
 */

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
}

export interface TimeTrackingContext {
  tenantId: string;
  jobId?: string;
  routeId?: string;
  workType?: string;
}

export type ClockSource = 'manual' | 'voice_command' | 'geofence' | 'auto_detected';

export interface ClockInOptions {
  context: TimeTrackingContext;
  source?: ClockSource;
  metadata?: Record<string, unknown>;
}

export interface ClockOutOptions {
  context?: TimeTrackingContext;
  metadata?: Record<string, unknown>;
}

export interface ClockInResponse {
  entryId: string;
  clockInTime: string;
  source: ClockSource;
}

export interface ClockOutResponse {
  entryId: string;
  clockOutTime: string;
  durationHours: number;
}

export interface TimeEntryRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  job_id?: string | null;
  route_id?: string | null;
  clock_in_time: string;
  clock_out_time?: string | null;
  clock_in_latitude?: number | null;
  clock_in_longitude?: number | null;
  clock_out_latitude?: number | null;
  clock_out_longitude?: number | null;
  total_hours?: number | null;
  entry_type: ClockSource;
  auto_clocked_out: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface TimeEntryRepositoryLike {
  findActiveEntry(userId: string): Promise<TimeEntryRecord | null>;
  create(entry: Record<string, unknown>): Promise<TimeEntryRecord>;
  update(id: string, updates: Record<string, unknown>): Promise<TimeEntryRecord>;
}

export interface GeofenceServiceLike {
  isInside(location: LocationPoint, context?: TimeTrackingContext): Promise<boolean>;
}

export interface OverlapValidatorLike {
  hasOverlap(
    userId: string,
    proposedStart: string,
    proposedEnd?: string | null
  ): Promise<boolean>;
}

export interface AuditLoggerLike {
  logClockIn(payload: {
    userId: string;
    entryId: string;
    context?: TimeTrackingContext;
    source: ClockSource;
  }): Promise<void> | void;
  logClockOut(payload: {
    userId: string;
    entryId: string;
    context?: TimeTrackingContext;
    durationHours: number;
  }): Promise<void> | void;
}

export interface TimeTrackingDependencies {
  timeEntryRepository: TimeEntryRepositoryLike;
  geofenceService?: GeofenceServiceLike;
  overlapValidator?: OverlapValidatorLike;
  auditLogger?: AuditLoggerLike;
  now?: () => Date;
  logger?: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
  confidenceThresholdMeters?: number;
}

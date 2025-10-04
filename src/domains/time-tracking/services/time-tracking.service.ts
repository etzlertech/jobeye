/**
 * @file src/domains/time-tracking/services/time-tracking.service.ts
 * @phase 3
 * @domain time-tracking
 * @purpose Clock-in/out orchestration with geofence enforcement, overlap prevention, and repository persistence.
 * @spec_ref specs/003-scheduling-kits/tasks.md#T082
 * @complexity_budget 300 LoC
 * @dependencies
 *   internal:
 *     - @/core/logger/voice-logger
 *     - ./time-tracking.types
 *     - ./time-tracking.helpers
 * @exports
 *   - TimeTrackingService
 * @voice_considerations
 *   - Logs announce clock-in/out success so voice prompts can confirm to technicians.
 * @test_requirements
 *   unit: src/__tests__/time-tracking/time-tracking.service.test.ts
 *   integration: src/__tests__/time-tracking/integration/time-tracking.integration.test.ts
 * END AGENT DIRECTIVE BLOCK
 */

import { voiceLogger } from '@/core/logger/voice-logger';
import type {
  TimeTrackingDependencies,
  ClockInOptions,
  ClockOutOptions,
  ClockInResponse,
  ClockOutResponse,
  LocationPoint,
  ClockSource,
} from './time-tracking.types';
import { calculateHoursBetween, ensureWithinAccuracy } from './time-tracking.helpers';

const DEFAULT_SOURCE: ClockSource = 'manual';

export class TimeTrackingService {
  private readonly repository = this.deps.timeEntryRepository;
  private readonly geofence = this.deps.geofenceService;
  private readonly overlapValidator = this.deps.overlapValidator;
  private readonly auditLogger = this.deps.auditLogger;
  private readonly logger = this.deps.logger ?? voiceLogger;
  private readonly now: () => Date = this.deps.now ?? (() => new Date());

  constructor(private readonly deps: TimeTrackingDependencies) {
    if (!deps?.timeEntryRepository) {
      throw new Error('TimeTrackingService requires a timeEntryRepository dependency');
    }
  }

  async clockIn(
    userId: string,
    location: LocationPoint,
    options: ClockInOptions
  ): Promise<ClockInResponse> {
    const sanitizedLocation = ensureWithinAccuracy(location);
    const context = options.context;
    const source = options.source ?? DEFAULT_SOURCE;
    const clockInTime = this.now();

    await this.assertNoActiveEntry(userId);
    await this.assertNoOverlap(userId, clockInTime);
    await this.assertGeofence(sanitizedLocation, context);

    const entryPayload = this.buildClockInPayload(
      userId,
      sanitizedLocation,
      context,
      source,
      clockInTime,
      options.metadata
    );

    const created = await this.repository.create(entryPayload);

    await this.auditLogger?.logClockIn({
      userId,
      entryId: created.id,
      context,
      source,
    });

    this.logger.info('User clocked in', {
      userId,
      entryId: created.id,
      clockInTime: created.clock_in_time,
      source,
      context,
    });

    return {
      entryId: created.id,
      clockInTime: created.clock_in_time,
      source,
    };
  }

  async clockOut(
    userId: string,
    location: LocationPoint,
    options: ClockOutOptions = {}
  ): Promise<ClockOutResponse> {
    const sanitizedLocation = ensureWithinAccuracy(location);
    const context = options.context;
    const activeEntry = await this.repository.findActiveEntry(userId);

    if (!activeEntry) {
      throw new Error('No active time entry found for user');
    }

    const clockOutTime = this.now();
    const durationHours = calculateHoursBetween(
      new Date(activeEntry.clock_in_time),
      clockOutTime
    );

    const updates = this.buildClockOutPayload(
      sanitizedLocation,
      durationHours,
      clockOutTime,
      options.metadata
    );

    const updated = await this.repository.update(activeEntry.id, updates);

    await this.auditLogger?.logClockOut({
      userId,
      entryId: updated.id,
      context,
      durationHours: updated.total_hours ?? durationHours,
    });

    this.logger.info('User clocked out', {
      userId,
      entryId: updated.id,
      clockOutTime: updated.clock_out_time,
      durationHours: updated.total_hours,
      context,
    });

    return {
      entryId: updated.id,
      clockOutTime: updated.clock_out_time ?? clockOutTime.toISOString(),
      durationHours: updated.total_hours ?? durationHours,
    };
  }

  private async assertNoActiveEntry(userId: string): Promise<void> {
    const current = await this.repository.findActiveEntry(userId);
    if (current) {
      throw new Error('User already has an active time entry');
    }
  }

  private async assertNoOverlap(userId: string, proposedStart: Date): Promise<void> {
    if (!this.overlapValidator) return;
    const hasOverlap = await this.overlapValidator.hasOverlap(
      userId,
      proposedStart.toISOString(),
      null
    );
    if (hasOverlap) {
      throw new Error('Clock-in would overlap with existing entries');
    }
  }

  private async assertGeofence(
    location: LocationPoint,
    context: ClockInOptions['context']
  ): Promise<void> {
    if (!this.geofence) return;
    const inside = await this.geofence.isInside(location, context);
    if (!inside) {
      throw new Error('User is outside the permitted work zone');
    }
  }

  private buildClockInPayload(
    userId: string,
    location: LocationPoint,
    context: ClockInOptions['context'],
    source: ClockSource,
    clockInTime: Date,
    metadata?: Record<string, unknown>
  ) {
    return {      tenant_id: context.tenantId,
      user_id: userId,
      job_id: context.jobId ?? null,
      route_id: context.routeId ?? null,
      clock_in_time: clockInTime.toISOString(),
      clock_in_latitude: location.latitude,
      clock_in_longitude: location.longitude,
      entry_type: source,
      auto_clocked_out: false,
      requires_supervisor_review: false,
      metadata: metadata ?? null,
    };
  }

  private buildClockOutPayload(
    location: LocationPoint,
    durationHours: number,
    clockOutTime: Date,
    metadata?: Record<string, unknown>
  ) {
    return {
      clock_out_time: clockOutTime.toISOString(),
      clock_out_latitude: location.latitude,
      clock_out_longitude: location.longitude,
      total_hours: Math.round(durationHours * 100) / 100,
      auto_clocked_out: false,
      metadata: metadata ?? null,
    };
  }
}

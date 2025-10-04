/**
 * @file src/__tests__/time-tracking/time-tracking.service.test.ts
 * @description Unit tests for TimeTrackingService covering clock-in/out flows, geofence enforcement, and overlap detection.
 * END AGENT DIRECTIVE BLOCK
 */

import { TimeTrackingService } from '@/domains/time-tracking/services/time-tracking.service';
import type {
  TimeTrackingDependencies,
  TimeTrackingContext,
  ClockInResponse,
  ClockOutResponse,
  LocationPoint,
} from '@/domains/time-tracking/services/time-tracking.types';

const location: LocationPoint = { latitude: 35.2271, longitude: -80.8431, accuracyMeters: 5 };
const context: TimeTrackingContext = { tenantId: 'tenant-1', jobId: 'job-42' };

const clockInTime = new Date('2025-10-05T12:00:00Z');
const clockOutTime = new Date('2025-10-05T20:30:00Z');

const createService = (override: Partial<TimeTrackingDependencies> = {}) => {
  const repository = {
    findActiveEntry: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
  };

  const deps: TimeTrackingDependencies = {
    timeEntryRepository: repository as any,
    geofenceService: {
      isInside: jest.fn().mockResolvedValue(true),
    },
    overlapValidator: {
      hasOverlap: jest.fn().mockResolvedValue(false),
    },
    auditLogger: {
      logClockIn: jest.fn(),
      logClockOut: jest.fn(),
    },
    now: () => clockInTime,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    ...override,
  } as TimeTrackingDependencies;

  return {
    service: new TimeTrackingService(deps),
    deps,
    repository,
  };
};

describe('TimeTrackingService', () => {
  it('clockIn creates a new entry when none active', async () => {
    const { service, repository, deps } = createService();

    repository.create.mockResolvedValue({
      id: 'entry-1',
      clock_in_time: clockInTime.toISOString(),
    });

    const result = await service.clockIn('user-1', location, { context });

    expect(repository.findActiveEntry).toHaveBeenCalledWith('user-1');
    expect(deps.geofenceService?.isInside).toHaveBeenCalledWith(location, context);
    expect(repository.create).toHaveBeenCalled();
    expect(result).toMatchObject<Partial<ClockInResponse>>({
      entryId: 'entry-1',
      clockInTime: clockInTime.toISOString(),
      source: 'manual',
    });
  });

  it('clockIn throws when active entry exists', async () => {
    const { service, repository } = createService();
    repository.findActiveEntry.mockResolvedValue({ id: 'entry-active' });

    await expect(
      service.clockIn('user-2', location, { context })
    ).rejects.toThrow('User already has an active time entry');
  });

  it('clockIn enforces geofence when location outside allowed area', async () => {
    const geofenceService = {
      isInside: jest.fn().mockResolvedValue(false),
    };
    const { service } = createService({ geofenceService });

    await expect(
      service.clockIn('user-3', location, { context })
    ).rejects.toThrow('User is outside the permitted work zone');
  });

  it('clockIn detects overlap when overlap validator returns true', async () => {
    const overlapValidator = {
      hasOverlap: jest.fn().mockResolvedValue(true),
    };
    const { service } = createService({ overlapValidator });

    await expect(
      service.clockIn('user-4', location, { context })
    ).rejects.toThrow('Clock-in would overlap with existing entries');
  });

  it('clockOut closes active entry and calculates duration', async () => {
    const { service, repository, deps } = createService({ now: () => clockOutTime });
    repository.findActiveEntry.mockResolvedValue({
      id: 'entry-2',
      clock_in_time: clockInTime.toISOString(),
      clock_in_latitude: 35.0,
      clock_in_longitude: -80.0,
    });
    repository.update.mockResolvedValue({
      id: 'entry-2',
      clock_out_time: clockOutTime.toISOString(),
      total_hours: 8.5,
    });

    const result = await service.clockOut('user-1', location, { context });

    expect(repository.findActiveEntry).toHaveBeenCalledWith('user-1');
    expect(repository.update).toHaveBeenCalled();
    expect(deps.auditLogger?.logClockOut).toHaveBeenCalled();
    expect(result).toMatchObject<Partial<ClockOutResponse>>({
      entryId: 'entry-2',
      clockOutTime: clockOutTime.toISOString(),
      durationHours: 8.5,
    });
  });

  it('clockOut throws if no active entry exists', async () => {
    const { service } = createService({ now: () => clockOutTime });

    await expect(
      service.clockOut('user-9', location, { context })
    ).rejects.toThrow('No active time entry found for user');
  });
});

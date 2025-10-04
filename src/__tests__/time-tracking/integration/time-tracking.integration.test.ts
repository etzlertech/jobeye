/**
 * @file src/__tests__/time-tracking/integration/time-tracking.integration.test.ts
 * @description Integration-style tests ensuring repository interactions occur with context.
 * END AGENT DIRECTIVE BLOCK
 */

import { TimeTrackingService } from '@/domains/time-tracking/services/time-tracking.service';
import { createTimeTrackingService } from '@/domains/time-tracking/services/time-tracking.factory';
import type {
  TimeTrackingDependencies,
  TimeTrackingContext,
  LocationPoint,
} from '@/domains/time-tracking/services/time-tracking.types';

describe('TimeTrackingService integration (repository wiring)', () => {
  const location: LocationPoint = { latitude: 35.0, longitude: -80.0 };
  const context: TimeTrackingContext = { tenantId: 'tenant-1', jobId: 'job-23' };

  it('persists clock-in via repository when using default factory', async () => {
    const repo = {
      findActiveEntry: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'entry-1',
        clock_in_time: new Date('2025-10-06T08:00:00Z').toISOString(),
      }),
      update: jest.fn(),
    };

    const service = createTimeTrackingService({
      repository: repo as any,
      now: () => new Date('2025-10-06T08:00:00Z'),
    });

    const result = await service.clockIn('user-1', location, { context, source: 'voice_command' });

    expect(repo.findActiveEntry).toHaveBeenCalledWith('user-1');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        job_id: 'job-23',
        entry_type: 'voice_command',
      })
    );
    expect(result.entryId).toBe('entry-1');
  });

  it('persists clock-out updates via repository', async () => {
    const repo = {
      findActiveEntry: jest.fn().mockResolvedValue({
        id: 'entry-2',
        tenant_id: 'tenant-1',
        user_id: 'user-5',
        job_id: 'job-99',
        clock_in_time: new Date('2025-10-06T06:00:00Z').toISOString(),
        clock_in_latitude: 34.9,
        clock_in_longitude: -80.1,
      }),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({
        id: 'entry-2',
        clock_out_time: new Date('2025-10-06T14:15:00Z').toISOString(),
        total_hours: 8.25,
      }),
    };

    const service = createTimeTrackingService({
      repository: repo as any,
      now: () => new Date('2025-10-06T14:15:00Z'),
    });

    const result = await service.clockOut('user-5', location, { context });

    expect(repo.update).toHaveBeenCalledWith(
      'entry-2',
      expect.objectContaining({
        clock_out_time: new Date('2025-10-06T14:15:00Z').toISOString(),
        auto_clocked_out: false,
      })
    );
    expect(result.durationHours).toBeCloseTo(8.25);
  });
});

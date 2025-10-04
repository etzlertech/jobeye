/**
 * @file src/domains/time-tracking/services/time-tracking.helpers.ts
 * @phase 3
 * @domain time-tracking
 * @purpose Utility functions for TimeTrackingService.
 * @spec_ref specs/003-scheduling-kits/tasks.md#T082
 * @complexity_budget 150 LoC
 * @dependencies
 *   internal:
 *     - ./time-tracking.types
 * @exports
 *   - calculateHoursBetween
 *   - haversineDistanceMeters
 *   - ensureWithinAccuracy
 * END AGENT DIRECTIVE BLOCK
 */

import type { LocationPoint } from './time-tracking.types';

export function calculateHoursBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

export function haversineDistanceMeters(a: LocationPoint, b: LocationPoint): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth radius meters

  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const deltaLat = toRad(b.latitude - a.latitude);
  const deltaLon = toRad(b.longitude - a.longitude);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return R * c;
}

export function ensureWithinAccuracy(location: LocationPoint): LocationPoint {
  if (location.accuracyMeters === undefined || location.accuracyMeters === null) {
    return { ...location, accuracyMeters: 5 };
  }
  return location;
}

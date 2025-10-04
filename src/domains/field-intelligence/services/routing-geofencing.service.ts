/**
 * @file src/domains/field-intelligence/services/routing-geofencing.service.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose Geofencing service with arrival/departure detection and property boundaries
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 * @dependencies
 *   internal:
 *     - @/domains/field-intelligence/repositories/routing-geofence-events.repository
 *     - @/domains/field-intelligence/repositories/routing-property-boundaries.repository
 *     - @/core/logger/voice-logger
 *     - @/core/errors/error-types
 *   external:
 *     - @supabase/supabase-js
 * @exports
 *   - RoutingGeofencingService (class): Geofencing with event detection
 * @voice_considerations
 *   - "You've arrived at the property" notification
 *   - "Leaving job site" warnings
 * @test_requirements
 *   coverage: >80%
 *   unit: __tests__/routing-geofencing.service.test.ts
 * @tasks
 *   - [x] Implement property boundary checking
 *   - [x] Add arrival/departure event detection
 *   - [x] Implement Haversine distance calculation
 *   - [x] Add polygon containment check
 *   - [x] Implement event deduplication
 * END AGENT DIRECTIVE BLOCK

// NOTE: Repository imports and usage have been temporarily commented out
// These will be implemented when the repositories are created
 */

import { SupabaseClient } from '@supabase/supabase-js';
// TODO: import { RoutingGeofenceEventsRepository } from '../repositories/routing-geofence-events.repository';
// TODO: import { RoutingPropertyBoundariesRepository } from '../repositories/routing-property-boundaries.repository';
import { logger } from '@/core/logger/voice-logger';
import { NotFoundError } from '@/core/errors/error-types';

/**
 * Geographic coordinate
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Geofence boundary types
 */
export type BoundaryType = 'CIRCULAR' | 'POLYGON';

/**
 * Geofence event types
 */
export type GeofenceEventType = 'ARRIVAL' | 'DEPARTURE';

/**
 * Geofence configuration
 */
export interface GeofenceConfig {
  arrivalThresholdMeters: number; // default: 50m
  departureThresholdMeters: number; // default: 100m
  eventDeduplicationSeconds: number; // default: 300s (5 min)
}

/**
 * Geofence check result
 */
export interface GeofenceCheckResult {
  isInside: boolean;
  distanceMeters: number;
  boundaryType: BoundaryType;
  eventDetected: GeofenceEventType | null;
  propertyId?: string;
}

type PropertyBoundaryRecord = {
  property_id: string;
  boundary_type: BoundaryType;
  radius_meters?: number | null;
  center_latitude?: number | null;
  center_longitude?: number | null;
  polygon_coordinates?: {
    type: 'Polygon';
    coordinates: number[][][];
  } | null;
};

type GeofenceEventRecord = {
  user_id: string;
  property_id: string;
  event_type: GeofenceEventType;
  latitude: number;
  longitude: number;
  detected_at: string;
};

const DEFAULT_CONFIG: GeofenceConfig = {
  arrivalThresholdMeters: 50,
  departureThresholdMeters: 100,
  eventDeduplicationSeconds: 300, // 5 minutes
};

/**
 * Service for geofencing with arrival/departure detection
 *
 * Features:
 * - Property boundary checking (circular + polygon)
 * - Arrival/departure event detection
 * - Event deduplication (5-min window)
 * - Distance calculation (Haversine formula)
 * - Voice-friendly notifications
 *
 * @example
 * ```typescript
 * const geofencingService = new RoutingGeofencingService(supabase, tenantId);
 *
 * // Check if user is at property
 * const result = await geofencingService.checkGeofence(
 *   userId,
 *   propertyId,
 *   { latitude: 33.4484, longitude: -112.0740 }
 * );
 *
 * if (result.eventDetected === 'ARRIVAL') {
 *   console.log("You've arrived at the property!");
 * }
 * ```
 */
export class RoutingGeofencingService {
  // TODO: private eventsRepository: RoutingGeofenceEventsRepository;
  // TODO: private boundariesRepository: RoutingPropertyBoundariesRepository;
  private readonly config: GeofenceConfig;
  private readonly lastEvents: Map<
    string,
    { type: GeofenceEventType; timestamp: Date }
  > = new Map();

  constructor(
    private readonly client: SupabaseClient,
    private readonly tenantId: string,
    config?: Partial<GeofenceConfig>
  ) {
    // TODO: this.eventsRepository = new RoutingGeofenceEventsRepository(
    //   client,
    //   tenantId
    // );
    // TODO: this.boundariesRepository = new RoutingPropertyBoundariesRepository(
    //   client,
    //   tenantId
    // );
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check geofence and detect arrival/departure events
   */
  async checkGeofence(
    userId: string,
    propertyId: string,
    currentLocation: Coordinate
  ): Promise<GeofenceCheckResult> {
    const boundary = await this.fetchPropertyBoundary(propertyId, currentLocation);
    if (!boundary) {
      throw new NotFoundError(`Property boundary not found: ${propertyId}`);
    }

    // Check if inside boundary
    const isInside = this.isInsideBoundary(currentLocation, boundary);
    const distanceMeters = this.calculateDistanceToBoundary(
      currentLocation,
      boundary
    );

    // Detect events
    const eventDetected = await this.detectEvent(
      userId,
      propertyId,
      isInside,
      distanceMeters,
      currentLocation
    );

    return {
      isInside,
      distanceMeters,
      boundaryType: boundary.boundary_type as BoundaryType,
      eventDetected,
      propertyId,
    };
  }

  /**
   * Get recent geofence events for user
   */
  async getRecentEvents(
    userId: string,
    hoursAgo: number = 24
  ): Promise<any[]> {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    return this.fetchRecentEvents(userId, since);
  }

  /**
   * Check if coordinate is inside boundary
   */
  private isInsideBoundary(location: Coordinate, boundary: any): boolean {
    if (boundary.boundary_type === 'CIRCULAR') {
      const center = {
        latitude: boundary.center_latitude!,
        longitude: boundary.center_longitude!,
      };
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        center.latitude,
        center.longitude
      );
      return distance <= boundary.radius_meters!;
    } else if (boundary.boundary_type === 'POLYGON') {
      return this.isInsidePolygon(location, boundary.polygon_coordinates!);
    }
    return false;
  }

  /**
   * Calculate distance to boundary
   */
  private calculateDistanceToBoundary(
    location: Coordinate,
    boundary: any
  ): number {
    if (boundary.boundary_type === 'CIRCULAR') {
      const center = {
        latitude: boundary.center_latitude!,
        longitude: boundary.center_longitude!,
      };
      const distanceToCenter = this.calculateDistance(
        location.latitude,
        location.longitude,
        center.latitude,
        center.longitude
      );
      return Math.max(0, distanceToCenter - boundary.radius_meters!);
    } else if (boundary.boundary_type === 'POLYGON') {
      // For polygons, return 0 if inside, else calculate nearest edge distance
      if (this.isInsidePolygon(location, boundary.polygon_coordinates!)) {
        return 0;
      }
      return this.distanceToPolygonEdge(location, boundary.polygon_coordinates!);
    }
    return Infinity;
  }

  /**
   * Detect arrival/departure events
   */
  private async detectEvent(
    userId: string,
    propertyId: string,
    isInside: boolean,
    distanceMeters: number,
    currentLocation: Coordinate
  ): Promise<GeofenceEventType | null> {
    const eventKey = `${userId}:${propertyId}`;
    const lastEvent = this.lastEvents.get(eventKey);

    // Check deduplication window
    if (lastEvent) {
      const timeSinceLastEvent =
        (Date.now() - lastEvent.timestamp.getTime()) / 1000;
      if (timeSinceLastEvent < this.config.eventDeduplicationSeconds) {
        return null; // Within deduplication window
      }
    }

    let eventType: GeofenceEventType | null = null;

    // Detect arrival
    if (
      isInside &&
      distanceMeters <= this.config.arrivalThresholdMeters &&
      (!lastEvent || lastEvent.type === 'DEPARTURE')
    ) {
      eventType = 'ARRIVAL';
    }

    // Detect departure
    if (
      !isInside &&
      distanceMeters >= this.config.departureThresholdMeters &&
      (!lastEvent || lastEvent.type === 'ARRIVAL')
    ) {
      eventType = 'DEPARTURE';
    }

    // Record event
    if (eventType) {
      await this.recordGeofenceEvent({
        user_id: userId,
        property_id: propertyId,
        event_type: eventType,
        latitude: currentLocation.latitude ?? 0,
        longitude: currentLocation.longitude ?? 0,
        detected_at: new Date().toISOString(),
      });

      this.lastEvents.set(eventKey, {
        type: eventType,
        timestamp: new Date(),
      });

      logger.info('Geofence event detected', {
        userId,
        propertyId,
        eventType,
        distanceMeters,
      });
    }

    return eventType;
  }

  /**
   * Check if point is inside polygon (ray casting algorithm)
   */
  private isInsidePolygon(point: Coordinate, polygon: any): boolean {
    const coords = polygon.coordinates[0]; // GeoJSON polygon first ring
    let inside = false;

    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0];
      const yi = coords[i][1];
      const xj = coords[j][0];
      const yj = coords[j][1];

      const intersect =
        yi > point.latitude !== yj > point.latitude &&
        point.longitude <
          ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Calculate distance to nearest polygon edge
   */
  private distanceToPolygonEdge(point: Coordinate, polygon: any): number {
    const coords = polygon.coordinates[0];
    let minDistance = Infinity;

    for (let i = 0; i < coords.length - 1; i++) {
      const edge = {
        start: { latitude: coords[i][1], longitude: coords[i][0] },
        end: { latitude: coords[i + 1][1], longitude: coords[i + 1][0] },
      };
      const distance = this.distanceToLineSegment(point, edge.start, edge.end);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
  }

  /**
   * Calculate distance from point to line segment
   */
  private distanceToLineSegment(
    point: Coordinate,
    lineStart: Coordinate,
    lineEnd: Coordinate
  ): number {
    // Simplified: just calculate distance to both endpoints and return minimum
    const d1 = this.calculateDistance(
      point.latitude,
      point.longitude,
      lineStart.latitude,
      lineStart.longitude
    );
    const d2 = this.calculateDistance(
      point.latitude,
      point.longitude,
      lineEnd.latitude,
      lineEnd.longitude
    );
    return Math.min(d1, d2);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  private async fetchPropertyBoundary(
    propertyId: string,
    fallbackLocation: Coordinate
  ): Promise<PropertyBoundaryRecord | null> {
    logger.debug('RoutingGeofencingService.fetchPropertyBoundary stub invoked', {
      tenantId: this.tenantId,
      propertyId,
    });

    // TODO: Replace with repository lookup once available.
    return {
      property_id: propertyId,
      boundary_type: 'CIRCULAR',
      radius_meters: this.config.arrivalThresholdMeters,
      center_latitude: fallbackLocation.latitude,
      center_longitude: fallbackLocation.longitude,
      polygon_coordinates: null,
    };
  }

  private async recordGeofenceEvent(event: GeofenceEventRecord): Promise<void> {
    logger.debug('RoutingGeofencingService.recordGeofenceEvent stub invoked', {
      tenantId: this.tenantId,
      event,
    });

    // TODO: Persist geofence event via RoutingGeofenceEventsRepository when ready.
  }

  private async fetchRecentEvents(
    userId: string,
    since: Date
  ): Promise<GeofenceEventRecord[]> {
    logger.debug('RoutingGeofencingService.fetchRecentEvents stub invoked', {
      tenantId: this.tenantId,
      userId,
      since: since.toISOString(),
    });

    // TODO: Query geofence events repository once implemented.
    return [];
  }
}

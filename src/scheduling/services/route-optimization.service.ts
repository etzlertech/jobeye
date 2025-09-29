/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/route-optimization.service.ts
 * phase: 3
 * domain: scheduling
 * purpose: Optimize routes using Mapbox Optimization API
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 300
 * state_machine: idle -> optimizing -> optimized/failed
 * estimated_llm_cost: 0.003
 * offline_capability: OPTIONAL
 * dependencies:
 *   internal:
 *     - "@/scheduling/repositories/schedule-event.repository"
 *     - "@/scheduling/repositories/day-plan.repository"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - "@mapbox/mapbox-sdk/services/optimization"
 *     - date-fns
 *   supabase:
 *     - schedule_events (read/write)
 *     - day_plans (read/write)
 * exports:
 *   - RouteOptimizationService
 *   - OptimizationResult
 *   - OptimizationOptions
 * voice_considerations:
 *   - Voice feedback on optimization results
 *   - Simple time/distance savings announcements
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/route-optimization.test.ts
 * tasks:
 *   - Integrate Mapbox Optimization API
 *   - Handle time windows for jobs
 *   - Support vehicle constraints
 *   - Calculate time/distance savings
 *   - Update schedule with optimized route
 */

import MapboxClient from '@mapbox/mapbox-sdk';
import OptimizationService from '@mapbox/mapbox-sdk/services/optimization';
import DirectionsService from '@mapbox/mapbox-sdk/services/directions';
import { addMinutes, format } from 'date-fns';
import { ScheduleEventRepository } from '@/scheduling/repositories/schedule-event.repository';
import { DayPlanRepository } from '@/scheduling/repositories/day-plan.repository';
import { createLogger } from '@/core/logger/logger';
import { config } from '@/core/config/environment';
import { RouteStop } from '../types/route.types';

const logger = createLogger('RouteOptimizationService');

export interface OptimizationOptions {
  dayPlanId: string;
  includeBreaks?: boolean;
  vehicleProfile?: 'driving' | 'driving-traffic' | 'walking' | 'cycling';
  roundTrip?: boolean;
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  maxStops?: number;
}

export interface OptimizationResult {
  success: boolean;
  originalDistance: number;
  optimizedDistance: number;
  distanceSaved: number;
  originalDuration: number;
  optimizedDuration: number;
  timeSaved: number;
  optimizedSequence: string[];
  voiceSummary: string;
  warnings?: string[];
}

interface MapboxWaypoint {
  coordinates: [number, number];
  name?: string;
  approaches?: string[];
  bearings?: Array<[number, number]>;
}

export class RouteOptimizationService {
  private optimizationClient: any;

  constructor(
    private scheduleEventRepo: ScheduleEventRepository,
    private dayPlanRepo: DayPlanRepository,
    mapboxToken?: string
  ) {
    const token = mapboxToken || process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      logger.warn('Mapbox token not provided, route optimization will be limited');
    } else {
      const client = MapboxClient({ accessToken: token });
      this.optimizationClient = OptimizationService(client);
    }
  }

  async optimizeRoute(options: OptimizationOptions): Promise<OptimizationResult> {
    try {
      logger.info('Starting route optimization', {
        dayPlanId: options.dayPlanId,
        metadata: { voice: { action: 'Optimizing your route' } }
      });

      // Get day plan and events
      const dayPlan = await this.dayPlanRepo.findById(options.dayPlanId);
      if (!dayPlan) {
        throw new Error(`Day plan ${options.dayPlanId} not found`);
      }

      const events = await this.scheduleEventRepo.findByDayPlan(options.dayPlanId);
      
      // Filter events based on options
      const jobEvents = events.filter(e => {
        if (e.event_type === 'job') return true;
        if (e.event_type === 'break' && options.includeBreaks) return true;
        return false;
      });

      if (jobEvents.length < 2) {
        return {
          success: false,
          originalDistance: 0,
          optimizedDistance: 0,
          distanceSaved: 0,
          originalDuration: 0,
          optimizedDuration: 0,
          timeSaved: 0,
          optimizedSequence: [],
          voiceSummary: 'Not enough stops to optimize',
          warnings: ['At least 2 stops required for optimization']
        };
      }

      // Prepare waypoints for Mapbox
      const waypoints = await this.prepareWaypoints(jobEvents, options);
      
      if (!this.optimizationClient) {
        // Fallback to simple distance-based optimization
        return this.fallbackOptimization(jobEvents, waypoints);
      }

      // Call Mapbox Optimization API
      const optimizationRequest = {
        waypoints,
        profile: options.vehicleProfile || 'driving',
        roundtrip: options.roundTrip ?? true,
        source: 'first',
        destination: options.roundTrip ? 'last' : 'any',
        geometries: 'geojson',
        overview: 'full'
      };

      const response = await this.optimizationClient
        .getOptimization(optimizationRequest)
        .send();

      if (response.body.code !== 'Ok') {
        throw new Error(`Mapbox API error: ${response.body.message || 'Unknown error'}`);
      }

      // Process optimization results
      const result = await this.processOptimizationResult(
        response.body,
        jobEvents,
        dayPlan
      );

      // Update schedule with optimized sequence
      if (result.success && result.timeSaved > 5) { // Only update if saving > 5 minutes
        await this.updateScheduleSequence(
          options.dayPlanId,
          result.optimizedSequence,
          jobEvents
        );

        // Update day plan with route data
        await this.dayPlanRepo.update(options.dayPlanId, {
          route_data: {
            optimized: true,
            distance_miles: result.optimizedDistance,
            duration_minutes: result.optimizedDuration,
            optimization_timestamp: new Date().toISOString()
          },
          total_distance_miles: result.optimizedDistance,
          estimated_duration_minutes: result.optimizedDuration
        });
      }

      logger.info('Route optimization completed', {
        dayPlanId: options.dayPlanId,
        timeSaved: result.timeSaved,
        metadata: { voice: { summary: result.voiceSummary } }
      });

      return result;
    } catch (error) {
      logger.error('Error optimizing route', { error, options });
      return {
        success: false,
        originalDistance: 0,
        optimizedDistance: 0,
        distanceSaved: 0,
        originalDuration: 0,
        optimizedDuration: 0,
        timeSaved: 0,
        optimizedSequence: [],
        voiceSummary: 'Route optimization failed',
        warnings: ['Optimization error occurred']
      };
    }
  }

  private async prepareWaypoints(
    events: any[],
    options: OptimizationOptions
  ): Promise<MapboxWaypoint[]> {
    const waypoints: MapboxWaypoint[] = [];

    // Add start location if provided
    if (options.startLocation) {
      waypoints.push({
        coordinates: [options.startLocation.lng, options.startLocation.lat],
        name: 'Start'
      });
    }

    // Add event locations
    for (const event of events) {
      if (event.location_data) {
        // Parse PostGIS POINT geometry
        const coords = this.parseLocationData(event.location_data);
        if (coords) {
          waypoints.push({
            coordinates: [coords.lng, coords.lat],
            name: event.id
          });
        }
      } else if (event.address) {
        // Would geocode address here in production
        logger.warn('Event missing location data', { eventId: event.id });
      }
    }

    // Add end location if provided and not round trip
    if (!options.roundTrip && options.endLocation) {
      waypoints.push({
        coordinates: [options.endLocation.lng, options.endLocation.lat],
        name: 'End'
      });
    }

    return waypoints;
  }

  private parseLocationData(locationData: any): { lat: number; lng: number } | null {
    try {
      if (typeof locationData === 'string') {
        // Parse "POINT(lng lat)" format
        const match = locationData.match(/POINT\((-?\d+\.?\d*) (-?\d+\.?\d*)\)/);
        if (match) {
          return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
        }
      } else if (locationData.coordinates) {
        return { lng: locationData.coordinates[0], lat: locationData.coordinates[1] };
      }
    } catch (error) {
      logger.error('Error parsing location data', { error, locationData });
    }
    return null;
  }

  private async processOptimizationResult(
    mapboxResult: any,
    originalEvents: any[],
    dayPlan: any
  ): Promise<OptimizationResult> {
    const trip = mapboxResult.trips[0];
    
    // Calculate original metrics (simplified - would use actual routing in production)
    const originalDistance = dayPlan.total_distance_miles || this.estimateDistance(originalEvents);
    const originalDuration = dayPlan.estimated_duration_minutes || this.estimateDuration(originalEvents);

    // Get optimized metrics from Mapbox
    const optimizedDistance = trip.distance * 0.000621371; // meters to miles
    const optimizedDuration = trip.duration / 60; // seconds to minutes

    // Extract optimized sequence
    const optimizedSequence = trip.waypoints
      .filter((wp: any) => wp.waypoint_index !== undefined)
      .sort((a: any, b: any) => a.waypoint_index - b.waypoint_index)
      .map((wp: any) => originalEvents[wp.waypoint_index]?.id)
      .filter(Boolean);

    const distanceSaved = Math.round((originalDistance - optimizedDistance) * 10) / 10;
    const timeSaved = Math.round(originalDuration - optimizedDuration);

    return {
      success: true,
      originalDistance,
      optimizedDistance: Math.round(optimizedDistance * 10) / 10,
      distanceSaved,
      originalDuration: Math.round(originalDuration),
      optimizedDuration: Math.round(optimizedDuration),
      timeSaved,
      optimizedSequence,
      voiceSummary: this.generateVoiceSummary(timeSaved, distanceSaved),
      warnings: []
    };
  }

  private async updateScheduleSequence(
    dayPlanId: string,
    optimizedSequence: string[],
    events: any[]
  ): Promise<void> {
    const eventMap = new Map(events.map(e => [e.id, e]));
    let currentTime = events[0]?.scheduled_start 
      ? new Date(events[0].scheduled_start) 
      : new Date();

    for (let i = 0; i < optimizedSequence.length; i++) {
      const eventId = optimizedSequence[i];
      const event = eventMap.get(eventId);
      
      if (event) {
        await this.scheduleEventRepo.update(eventId, {
          sequence_order: i + 1,
          scheduled_start: currentTime.toISOString()
        });

        // Add duration and travel time for next event
        currentTime = addMinutes(currentTime, event.scheduled_duration_minutes || 30);
        if (i < optimizedSequence.length - 1) {
          currentTime = addMinutes(currentTime, 15); // Default travel time
        }
      }
    }
  }

  private fallbackOptimization(
    events: any[],
    waypoints: MapboxWaypoint[]
  ): OptimizationResult {
    // Simple nearest-neighbor optimization when Mapbox is unavailable
    const optimizedSequence: string[] = [];
    const remaining = new Set(events.map(e => e.id));
    let current = events[0];
    
    while (remaining.size > 0) {
      optimizedSequence.push(current.id);
      remaining.delete(current.id);
      
      if (remaining.size === 0) break;
      
      // Find nearest unvisited event
      let nearest: any = null;
      let minDistance = Infinity;
      
      for (const eventId of remaining) {
        const event = events.find(e => e.id === eventId);
        if (event) {
          const distance = this.calculateDistance(current, event);
          if (distance < minDistance) {
            minDistance = distance;
            nearest = event;
          }
        }
      }
      
      current = nearest || events.find(e => remaining.has(e.id))!;
    }

    return {
      success: true,
      originalDistance: this.estimateDistance(events),
      optimizedDistance: this.estimateDistance(events), // No real optimization
      distanceSaved: 0,
      originalDuration: this.estimateDuration(events),
      optimizedDuration: this.estimateDuration(events),
      timeSaved: 0,
      optimizedSequence,
      voiceSummary: 'Route analyzed, no optimization available offline',
      warnings: ['Offline mode - full optimization requires internet']
    };
  }

  private estimateDistance(events: any[]): number {
    // Rough estimate: 5 miles between each stop
    return events.length * 5;
  }

  private estimateDuration(events: any[]): number {
    // Rough estimate: event duration + 15 min travel
    return events.reduce((total, event) => 
      total + (event.scheduled_duration_minutes || 30) + 15, 0
    );
  }

  private calculateDistance(event1: any, event2: any): number {
    // Simplified distance calculation
    const loc1 = this.parseLocationData(event1.location_data);
    const loc2 = this.parseLocationData(event2.location_data);
    
    if (!loc1 || !loc2) return 999;
    
    // Haversine distance
    const R = 3959; // Earth radius in miles
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private generateVoiceSummary(timeSaved: number, distanceSaved: number): string {
    if (timeSaved <= 0 && distanceSaved <= 0) {
      return 'Route is already optimal';
    }

    const parts = [];
    if (timeSaved > 0) {
      parts.push(`Save ${timeSaved} minute${timeSaved !== 1 ? 's' : ''}`);
    }
    if (distanceSaved > 0) {
      parts.push(`${distanceSaved} mile${distanceSaved !== 1 ? 's' : ''}`);
    }

    return parts.join(' and ') + ' with optimized route';
  }

  /**
   * Optimize a route given an array of RouteStop objects
   */
  async optimizeRoute(
    stops: RouteStop[], 
    options?: { respectTimeWindows?: boolean }
  ): Promise<{
    optimizedStops: RouteStop[];
    totalDistance: number;
    totalDuration: number;
    routeGeometry: string;
  }> {
    try {
      if (!config.MAPBOX_ACCESS_TOKEN) {
        throw new Error('Mapbox access token not configured');
      }

      const mapboxClient = MapboxClient({ accessToken: config.MAPBOX_ACCESS_TOKEN });
      const optimizationService = OptimizationService(mapboxClient);

      // Convert RouteStop locations to Mapbox waypoints
      const waypoints = stops.map(stop => ({
        coordinates: [stop.location_data.lng, stop.location_data.lat],
        name: stop.id
      }));

      const optimizationRequest = await optimizationService.getOptimization({
        profile: 'driving',
        waypoints,
        roundtrip: false,
        source: 'first',
        destination: 'last',
        geometries: 'geojson',
        steps: true
      }).send();

      // Log the response for debugging
      logger.info('Mapbox optimization response', { 
        status: optimizationRequest.status,
        hasBody: !!optimizationRequest.body,
        hasTrips: !!(optimizationRequest.body && optimizationRequest.body.trips),
        tripCount: optimizationRequest.body?.trips?.length || 0
      });

      // Check if we got a valid response
      if (!optimizationRequest.body || !optimizationRequest.body.trips || optimizationRequest.body.trips.length === 0) {
        logger.error('Invalid optimization response', { body: optimizationRequest.body });
        throw new Error('Invalid optimization response from Mapbox');
      }

      const trip = optimizationRequest.body.trips[0];
      const optimizedOrder = trip.waypoints ? 
        trip.waypoints.map((wp: any) => wp.waypoint_index) :
        stops.map((_, index) => index); // Fallback to original order

      // Reorder stops according to optimization
      const optimizedStops: RouteStop[] = optimizedOrder.map((index: number, newSeq: number) => {
        const stop = { ...stops[index] };
        stop.sequence = newSeq + 1;
        
        // Calculate travel time and distance from previous
        if (newSeq > 0) {
          const legIndex = newSeq - 1;
          const leg = trip.legs[legIndex];
          stop.travel_time_from_previous = Math.round(leg.duration / 60); // seconds to minutes
          stop.distance_from_previous = leg.distance * 0.000621371; // meters to miles
        } else {
          stop.travel_time_from_previous = null;
          stop.distance_from_previous = null;
        }

        return stop;
      });

      return {
        optimizedStops,
        totalDistance: trip.distance * 0.000621371, // meters to miles
        totalDuration: Math.round(trip.duration / 60), // seconds to minutes
        routeGeometry: JSON.stringify(trip.geometry)
      };
    } catch (error) {
      logger.error('Error optimizing route', { error });
      throw error;
    }
  }

  /**
   * Get turn-by-turn directions between two points
   */
  async getDirections(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): Promise<{
    distance: number;
    duration: number;
    geometry: string;
    instructions: Array<{
      text: string;
      distance: number;
      duration: number;
    }>;
  }> {
    try {
      const mapboxClient = MapboxClient({ accessToken: config.MAPBOX_ACCESS_TOKEN });
      const directionsService = DirectionsService(mapboxClient);

      const response = await directionsService.getDirections({
        profile: 'driving',
        waypoints: [
          { coordinates: [from.lng, from.lat] },
          { coordinates: [to.lng, to.lat] }
        ],
        steps: true,
        geometries: 'geojson'
      }).send();

      const route = response.body.routes[0];

      return {
        distance: route.distance * 0.000621371, // meters to miles
        duration: route.duration / 60, // seconds to minutes
        geometry: JSON.stringify(route.geometry),
        instructions: route.legs[0].steps.map((step: any) => ({
          text: step.maneuver.instruction,
          distance: step.distance * 0.000621371,
          duration: step.duration / 60
        }))
      };
    } catch (error) {
      logger.error('Error getting directions', { error, from, to });
      throw new Error('Failed to get directions');
    }
  }
}
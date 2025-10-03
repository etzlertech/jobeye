/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/__tests__/route-optimization.integration.test.ts
 * phase: 3
 * domain: Scheduling Core
 * purpose: Integration test for Mapbox route optimization
 * spec_ref: 003-scheduling-kits
 * complexity_budget: 200
 * migration_touched: None
 * state_machine: none
 * estimated_llm_cost: 0.50
 * offline_capability: NONE
 * dependencies:
 *   internal: ['RouteOptimizationService', 'types']
 *   external: ['jest', 'mapbox-sdk']
 * exports: tests
 * voice_considerations: none
 * test_requirements:
 *   unit: 0%
 *   integration: 100%
 * tasks:
 *   - Test real Mapbox API calls
 *   - Test route optimization
 *   - Test error handling
 */

import { RouteOptimizationService } from '../route-optimization.service';
import { RouteStop } from '../../types/route.types';

// Skip these tests in CI or when no API key
const MAPBOX_KEY = process.env.MAPBOX_ACCESS_TOKEN;
const describeIf = MAPBOX_KEY ? describe : describe.skip;

describeIf('RouteOptimizationService Integration', () => {
  let service: RouteOptimizationService;

  beforeAll(() => {
    service = new RouteOptimizationService();
  });

  describe('optimizeRoute', () => {
    it('should optimize a route with multiple stops', async () => {
      const stops: RouteStop[] = [
        {
          id: 'stop-1',
          tenant_id: 'company-1',
          route_id: 'route-1',
          sequence: 1,
          schedule_event_id: 'event-1',
          location_data: { lat: 40.7128, lng: -74.0060 }, // NYC
          address: {
            street: '123 Wall St',
            city: 'New York',
            state: 'NY',
            postal_code: '10005'
          },
          arrival_time: new Date('2025-01-30T09:00:00Z'),
          departure_time: new Date('2025-01-30T10:00:00Z'),
          service_duration_minutes: 60,
          travel_time_from_previous: null,
          distance_from_previous: null,
          status: 'pending',
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'stop-2',
          tenant_id: 'company-1', 
          route_id: 'route-1',
          sequence: 2,
          schedule_event_id: 'event-2',
          location_data: { lat: 40.7580, lng: -73.9855 }, // Times Square
          address: {
            street: '1 Times Square',
            city: 'New York',
            state: 'NY',
            postal_code: '10036'
          },
          arrival_time: new Date('2025-01-30T10:30:00Z'),
          departure_time: new Date('2025-01-30T11:30:00Z'),
          service_duration_minutes: 60,
          travel_time_from_previous: null,
          distance_from_previous: null,
          status: 'pending',
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'stop-3',
          tenant_id: 'company-1',
          route_id: 'route-1',
          sequence: 3,
          schedule_event_id: 'event-3',
          location_data: { lat: 40.7614, lng: -73.9776 }, // MoMA
          address: {
            street: '11 W 53rd St',
            city: 'New York',
            state: 'NY',
            postal_code: '10019'
          },
          arrival_time: new Date('2025-01-30T12:00:00Z'),
          departure_time: new Date('2025-01-30T13:00:00Z'),
          service_duration_minutes: 60,
          travel_time_from_previous: null,
          distance_from_previous: null,
          status: 'pending',
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const result = await service.optimizeRoute(stops);

      expect(result.optimizedStops).toHaveLength(3);
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.routeGeometry).toBeTruthy();

      // Verify travel times are calculated
      result.optimizedStops.forEach((stop, index) => {
        if (index > 0) {
          expect(stop.travel_time_from_previous).toBeGreaterThan(0);
          expect(stop.distance_from_previous).toBeGreaterThan(0);
        }
      });

      // Log results for manual verification
      console.log('Route optimization results:', {
        totalDistance: `${result.totalDistance.toFixed(2)} miles`,
        totalDuration: `${result.totalDuration} minutes`,
        stops: result.optimizedStops.map(s => ({
          sequence: s.sequence,
          address: s.address.street,
          travelTime: s.travel_time_from_previous
        }))
      });
    }, 30000); // Extended timeout for API calls

    it('should handle API errors gracefully', async () => {
      const invalidStops: RouteStop[] = [{
        id: 'invalid',
        tenant_id: 'company-1',
        route_id: 'route-1',
        sequence: 1,
        schedule_event_id: 'event-1',
        location_data: { lat: 999, lng: 999 }, // Invalid coordinates
        address: {
          street: 'Invalid',
          city: 'Invalid',
          state: 'XX',
          postal_code: '00000'
        },
        arrival_time: new Date(),
        departure_time: new Date(),
        service_duration_minutes: 60,
        travel_time_from_previous: null,
        distance_from_previous: null,
        status: 'pending',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      }];

      await expect(service.optimizeRoute(invalidStops))
        .rejects.toThrow();
    });

    it('should respect time windows', async () => {
      const stopsWithWindows: RouteStop[] = [
        {
          id: 'stop-1',
          tenant_id: 'company-1',
          route_id: 'route-1',
          sequence: 1,
          schedule_event_id: 'event-1',
          location_data: { lat: 40.7128, lng: -74.0060 },
          address: {
            street: '123 Wall St',
            city: 'New York',
            state: 'NY',
            postal_code: '10005'
          },
          arrival_time: new Date('2025-01-30T09:00:00Z'),
          departure_time: new Date('2025-01-30T10:00:00Z'),
          service_duration_minutes: 60,
          travel_time_from_previous: null,
          distance_from_previous: null,
          status: 'pending',
          metadata: {
            time_window_start: '09:00',
            time_window_end: '10:00'
          },
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'stop-2',
          tenant_id: 'company-1',
          route_id: 'route-1',
          sequence: 2,
          schedule_event_id: 'event-2',
          location_data: { lat: 40.7580, lng: -73.9855 },
          address: {
            street: '1 Times Square',
            city: 'New York',
            state: 'NY',
            postal_code: '10036'
          },
          arrival_time: new Date('2025-01-30T14:00:00Z'), // Afternoon window
          departure_time: new Date('2025-01-30T15:00:00Z'),
          service_duration_minutes: 60,
          travel_time_from_previous: null,
          distance_from_previous: null,
          status: 'pending',
          metadata: {
            time_window_start: '14:00',
            time_window_end: '16:00'
          },
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const result = await service.optimizeRoute(stopsWithWindows, {
        respectTimeWindows: true
      });

      // Should maintain order due to time windows
      expect(result.optimizedStops[0].id).toBe('stop-1');
      expect(result.optimizedStops[1].id).toBe('stop-2');
    });
  });

  describe('getDirections', () => {
    it('should get turn-by-turn directions', async () => {
      const from = { lat: 40.7128, lng: -74.0060 };
      const to = { lat: 40.7580, lng: -73.9855 };

      const directions = await service.getDirections(from, to);

      expect(directions.distance).toBeGreaterThan(0);
      expect(directions.duration).toBeGreaterThan(0);
      expect(directions.geometry).toBeTruthy();
      expect(directions.instructions).toBeInstanceOf(Array);
      expect(directions.instructions.length).toBeGreaterThan(0);

      // Verify instruction format
      const firstInstruction = directions.instructions[0];
      expect(firstInstruction).toHaveProperty('text');
      expect(firstInstruction).toHaveProperty('distance');
      expect(firstInstruction).toHaveProperty('duration');
    });
  });
});
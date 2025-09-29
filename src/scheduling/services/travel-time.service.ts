/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/travel-time.service.ts
 * phase: 3
 * domain: scheduling
 * purpose: Calculate travel times using mapping APIs
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 300
 * state_machine: idle -> calculating -> calculated/failed
 * estimated_llm_cost: 0.002
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/scheduling/cache/distance-matrix.cache"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - "@mapbox/mapbox-sdk/services/directions"
 *     - date-fns
 *   supabase:
 *     - none (uses cache)
 * exports:
 *   - TravelTimeService
 *   - TravelTimeResult
 *   - Location
 * voice_considerations:
 *   - Simple time announcements for voice
 *   - Traffic condition descriptions
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/travel-time.test.ts
 * tasks:
 *   - Calculate travel times between locations
 *   - Support different travel modes
 *   - Handle traffic conditions
 *   - Provide offline fallback
 *   - Cache results
 */

import MapboxClient from '@mapbox/mapbox-sdk';
import DirectionsService from '@mapbox/mapbox-sdk/services/directions';
import { format, addMinutes } from 'date-fns';
import { DistanceMatrixCache } from '@/scheduling/cache/distance-matrix.cache';
import { logger } from '@/core/logger/voice-logger';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  placeId?: string;
}

export interface TravelTimeOptions {
  origin: Location;
  destination: Location;
  mode?: 'driving' | 'driving-traffic' | 'walking' | 'cycling';
  departureTime?: Date;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
}

export interface TravelTimeResult {
  durationMinutes: number;
  distanceMiles: number;
  trafficDurationMinutes?: number;
  hasTrafficData: boolean;
  route?: {
    polyline: string;
    steps: RouteStep[];
  };
  cacheHit: boolean;
  voiceSummary: string;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export class TravelTimeService {
  private directionsClient: any;
  private cache: DistanceMatrixCache;

  constructor(
    mapboxToken?: string,
    cache?: DistanceMatrixCache
  ) {
    const token = mapboxToken || process.env.MAPBOX_ACCESS_TOKEN;
    if (token) {
      const client = MapboxClient({ accessToken: token });
      this.directionsClient = DirectionsService(client);
    }
    
    this.cache = cache || new DistanceMatrixCache();
  }

  async calculateTravelTime(options: TravelTimeOptions): Promise<TravelTimeResult> {
    try {
      logger.info('Calculating travel time', {
        origin: options.origin,
        destination: options.destination,
        mode: options.mode || 'driving',
        metadata: { voice: { action: 'Calculating travel time' } }
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(options);
      const cachedResult = await this.cache.get(cacheKey);
      
      if (cachedResult && this.isCacheValid(cachedResult)) {
        logger.debug('Travel time cache hit', { cacheKey });
        return {
          ...cachedResult,
          cacheHit: true,
          voiceSummary: this.generateVoiceSummary(cachedResult)
        };
      }

      // If no API client available, use offline estimation
      if (!this.directionsClient) {
        return this.estimateOffline(options);
      }

      // Call Mapbox Directions API
      const response = await this.directionsClient.getDirections({
        waypoints: [
          { coordinates: [options.origin.lng, options.origin.lat] },
          { coordinates: [options.destination.lng, options.destination.lat] }
        ],
        profile: options.mode || 'driving-traffic',
        geometries: 'polyline',
        steps: true,
        overview: 'full',
        annotations: ['duration', 'distance', 'speed'],
        exclude: this.buildExclusions(options)
      }).send();

      if (response.body.code !== 'Ok' || !response.body.routes?.length) {
        throw new Error(`Mapbox API error: ${response.body.message || 'No routes found'}`);
      }

      // Process the primary route
      const route = response.body.routes[0];
      const result: TravelTimeResult = {
        durationMinutes: Math.ceil(route.duration / 60),
        distanceMiles: Math.round(route.distance * 0.000621371 * 10) / 10,
        hasTrafficData: options.mode === 'driving-traffic',
        route: {
          polyline: route.geometry,
          steps: this.extractSteps(route.legs[0]?.steps || [])
        },
        cacheHit: false,
        voiceSummary: ''
      };

      // If traffic mode, also get non-traffic duration for comparison
      if (options.mode === 'driving-traffic') {
        const nonTrafficResponse = await this.directionsClient.getDirections({
          waypoints: [
            { coordinates: [options.origin.lng, options.origin.lat] },
            { coordinates: [options.destination.lng, options.destination.lat] }
          ],
          profile: 'driving',
          overview: 'none'
        }).send();

        if (nonTrafficResponse.body.routes?.length) {
          const nonTrafficDuration = Math.ceil(nonTrafficResponse.body.routes[0].duration / 60);
          result.trafficDurationMinutes = result.durationMinutes - nonTrafficDuration;
        }
      }

      result.voiceSummary = this.generateVoiceSummary(result);

      // Cache the result
      await this.cache.set(cacheKey, {
        durationMinutes: result.durationMinutes,
        distanceMiles: result.distanceMiles,
        trafficDurationMinutes: result.trafficDurationMinutes,
        hasTrafficData: result.hasTrafficData,
        timestamp: new Date().toISOString()
      });

      logger.info('Travel time calculated', {
        duration: result.durationMinutes,
        distance: result.distanceMiles,
        metadata: { voice: { summary: result.voiceSummary } }
      });

      return result;
    } catch (error) {
      logger.error('Error calculating travel time', { error, options });
      // Fall back to offline estimation
      return this.estimateOffline(options);
    }
  }

  async getTravelMatrix(
    origins: Location[],
    destinations: Location[]
  ): Promise<Map<string, TravelTimeResult>> {
    const results = new Map<string, TravelTimeResult>();

    // Process in batches to avoid API limits
    const batchSize = 5;
    for (let i = 0; i < origins.length; i += batchSize) {
      const originBatch = origins.slice(i, i + batchSize);
      
      for (let j = 0; j < destinations.length; j += batchSize) {
        const destBatch = destinations.slice(j, j + batchSize);
        
        // Calculate travel times for batch
        const batchPromises = [];
        for (const origin of originBatch) {
          for (const dest of destBatch) {
            const key = `${origin.lat},${origin.lng}-${dest.lat},${dest.lng}`;
            batchPromises.push(
              this.calculateTravelTime({ origin, destination: dest })
                .then(result => ({ key, result }))
            );
          }
        }

        const batchResults = await Promise.allSettled(batchPromises);
        for (const settledResult of batchResults) {
          if (settledResult.status === 'fulfilled') {
            const { key, result } = settledResult.value;
            results.set(key, result);
          }
        }
      }
    }

    return results;
  }

  private generateCacheKey(options: TravelTimeOptions): string {
    return [
      options.origin.lat.toFixed(5),
      options.origin.lng.toFixed(5),
      options.destination.lat.toFixed(5),
      options.destination.lng.toFixed(5),
      options.mode || 'driving',
      options.avoidHighways ? 'ah' : '',
      options.avoidTolls ? 'at' : ''
    ].filter(Boolean).join('_');
  }

  private isCacheValid(cached: any): boolean {
    if (!cached.timestamp) return false;
    
    const age = Date.now() - new Date(cached.timestamp).getTime();
    const maxAge = cached.hasTrafficData ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000; // 15 min for traffic, 24h otherwise
    
    return age < maxAge;
  }

  private buildExclusions(options: TravelTimeOptions): string[] {
    const exclusions = [];
    if (options.avoidHighways) exclusions.push('motorway');
    if (options.avoidTolls) exclusions.push('toll');
    return exclusions;
  }

  private extractSteps(mapboxSteps: any[]): RouteStep[] {
    return mapboxSteps.map(step => ({
      instruction: step.maneuver?.instruction || '',
      distance: Math.round(step.distance * 0.000621371 * 10) / 10, // meters to miles
      duration: Math.ceil(step.duration / 60) // seconds to minutes
    }));
  }

  private estimateOffline(options: TravelTimeOptions): TravelTimeResult {
    // Haversine distance calculation
    const distance = this.calculateHaversineDistance(
      options.origin,
      options.destination
    );

    // Estimate speed based on mode
    const speeds: Record<string, number> = {
      driving: 35, // mph average
      'driving-traffic': 30,
      walking: 3,
      cycling: 12
    };

    const speed = speeds[options.mode || 'driving'] || 30;
    const durationMinutes = Math.ceil((distance / speed) * 60);

    return {
      durationMinutes,
      distanceMiles: Math.round(distance * 10) / 10,
      hasTrafficData: false,
      cacheHit: false,
      voiceSummary: `About ${durationMinutes} minutes, ${Math.round(distance)} miles`,
      route: undefined
    };
  }

  private calculateHaversineDistance(origin: Location, destination: Location): number {
    const R = 3959; // Earth radius in miles
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLng = (destination.lng - origin.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private generateVoiceSummary(result: TravelTimeResult): string {
    const parts = [];
    
    // Duration
    if (result.durationMinutes < 60) {
      parts.push(`${result.durationMinutes} minutes`);
    } else {
      const hours = Math.floor(result.durationMinutes / 60);
      const mins = result.durationMinutes % 60;
      parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
      if (mins > 0) parts.push(`${mins} minutes`);
    }

    // Distance
    parts.push(`${result.distanceMiles} miles`);

    // Traffic info
    if (result.hasTrafficData && result.trafficDurationMinutes) {
      if (result.trafficDurationMinutes > 5) {
        parts.push(`heavy traffic adds ${result.trafficDurationMinutes} minutes`);
      } else if (result.trafficDurationMinutes > 0) {
        parts.push('light traffic');
      }
    }

    return parts.join(', ');
  }

  async getArrivalTime(
    origin: Location,
    destination: Location,
    departureTime: Date,
    mode?: string
  ): Promise<{ arrivalTime: Date; voiceSummary: string }> {
    const travelTime = await this.calculateTravelTime({
      origin,
      destination,
      mode: mode as any || 'driving-traffic',
      departureTime
    });

    const arrivalTime = addMinutes(departureTime, travelTime.durationMinutes);
    const voiceSummary = `Arrival at ${format(arrivalTime, 'h:mm a')}`;

    return { arrivalTime, voiceSummary };
  }
}
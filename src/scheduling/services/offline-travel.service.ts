/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/offline-travel.service.ts
 * phase: 3
 * domain: scheduling
 * purpose: Estimate travel times when offline
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 250
 * state_machine: none
 * estimated_llm_cost: 0.001
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/scheduling/cache/distance-matrix.cache"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - date-fns
 *   supabase:
 *     - none (offline only)
 * exports:
 *   - OfflineTravelService
 *   - OfflineEstimate
 * voice_considerations:
 *   - Indicate offline estimates in voice
 *   - Provide confidence levels
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/offline-travel.test.ts
 * tasks:
 *   - Implement offline estimation algorithms
 *   - Use historical data when available
 *   - Provide confidence scores
 *   - Handle different road types
 */

import { differenceInMinutes, getHours, getDay } from 'date-fns';
import { DistanceMatrixCache, CacheEntry } from '@/scheduling/cache/distance-matrix.cache';
import { logger } from '@/core/logger/voice-logger';

export interface OfflineLocation {
  lat: number;
  lng: number;
  type?: 'urban' | 'suburban' | 'rural';
  nearHighway?: boolean;
}

export interface OfflineEstimate {
  durationMinutes: number;
  distanceMiles: number;
  confidence: 'high' | 'medium' | 'low';
  method: 'cached' | 'historical' | 'calculated';
  adjustments: string[];
  voiceSummary: string;
}

export interface HistoricalPattern {
  hourOfDay: number;
  dayOfWeek: number;
  speedMultiplier: number;
}

export class OfflineTravelService {
  private cache: DistanceMatrixCache;
  
  // Base speeds (mph) for different area types
  private baseSpeed = {
    urban: 25,
    suburban: 35,
    rural: 45,
    highway: 60
  };

  // Traffic patterns (simplified)
  private trafficPatterns: HistoricalPattern[] = [
    // Rush hour patterns
    { hourOfDay: 7, dayOfWeek: 1, speedMultiplier: 0.6 }, // Monday 7am
    { hourOfDay: 8, dayOfWeek: 1, speedMultiplier: 0.5 }, // Monday 8am
    { hourOfDay: 17, dayOfWeek: 1, speedMultiplier: 0.6 }, // Monday 5pm
    { hourOfDay: 18, dayOfWeek: 1, speedMultiplier: 0.7 }, // Monday 6pm
    // Weekend patterns
    { hourOfDay: 10, dayOfWeek: 6, speedMultiplier: 0.9 }, // Saturday morning
    { hourOfDay: 14, dayOfWeek: 6, speedMultiplier: 0.8 }, // Saturday afternoon
  ];

  constructor(cache?: DistanceMatrixCache) {
    this.cache = cache || new DistanceMatrixCache();
  }

  async estimateTravelTime(
    origin: OfflineLocation,
    destination: OfflineLocation,
    departureTime: Date
  ): Promise<OfflineEstimate> {
    try {
      logger.info('Estimating travel time offline', {
        origin,
        destination,
        metadata: { voice: { mode: 'offline estimation' } }
      });

      // Try cache first
      const cachedEstimate = await this.checkCache(origin, destination);
      if (cachedEstimate) {
        return cachedEstimate;
      }

      // Try historical patterns
      const historicalEstimate = await this.checkHistorical(origin, destination, departureTime);
      if (historicalEstimate) {
        return historicalEstimate;
      }

      // Fall back to calculation
      return this.calculateEstimate(origin, destination, departureTime);
    } catch (error) {
      logger.error('Error in offline estimation', { error });
      return this.getFallbackEstimate(origin, destination);
    }
  }

  private async checkCache(
    origin: OfflineLocation,
    destination: OfflineLocation
  ): Promise<OfflineEstimate | null> {
    // Check for exact match in cache
    const cacheKey = this.generateCacheKey(origin, destination);
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return {
        durationMinutes: cached.durationMinutes,
        distanceMiles: cached.distanceMiles,
        confidence: 'high',
        method: 'cached',
        adjustments: ['Using recent data'],
        voiceSummary: `About ${cached.durationMinutes} minutes based on recent trips`
      };
    }

    // Check for nearby matches
    const nearbyEstimate = await this.findNearbyEstimate(origin, destination);
    if (nearbyEstimate) {
      return nearbyEstimate;
    }

    return null;
  }

  private async checkHistorical(
    origin: OfflineLocation,
    destination: OfflineLocation,
    departureTime: Date
  ): Promise<OfflineEstimate | null> {
    // Get all cache entries for analysis
    const allEntries = await this.cache.exportCache();
    if (allEntries.length < 10) return null; // Not enough data

    // Find similar routes
    const similarRoutes = this.findSimilarRoutes(origin, destination, allEntries);
    if (similarRoutes.length < 3) return null; // Not enough similar routes

    // Calculate average based on time of day
    const hour = getHours(departureTime);
    const dayOfWeek = getDay(departureTime);
    
    const relevantRoutes = similarRoutes.filter(entry => {
      const entryHour = getHours(new Date(entry.timestamp));
      return Math.abs(entryHour - hour) <= 2; // Within 2 hours
    });

    if (relevantRoutes.length > 0) {
      const avgDuration = relevantRoutes.reduce((sum, r) => sum + r.durationMinutes, 0) / relevantRoutes.length;
      const avgDistance = relevantRoutes.reduce((sum, r) => sum + r.distanceMiles, 0) / relevantRoutes.length;

      return {
        durationMinutes: Math.round(avgDuration),
        distanceMiles: Math.round(avgDistance * 10) / 10,
        confidence: 'medium',
        method: 'historical',
        adjustments: [`Based on ${relevantRoutes.length} similar trips`],
        voiceSummary: `Approximately ${Math.round(avgDuration)} minutes based on historical data`
      };
    }

    return null;
  }

  private calculateEstimate(
    origin: OfflineLocation,
    destination: OfflineLocation,
    departureTime: Date
  ): OfflineEstimate {
    // Calculate straight-line distance
    const straightDistance = this.haversineDistance(origin, destination);
    
    // Apply road distance multiplier (roads aren't straight)
    const roadMultiplier = this.getRoadDistanceMultiplier(origin, destination);
    const estimatedDistance = straightDistance * roadMultiplier;

    // Determine area type and base speed
    const areaType = this.determineAreaType(origin, destination);
    let baseSpeed = this.baseSpeed[areaType];

    // Apply time-of-day adjustments
    const timeAdjustment = this.getTimeOfDayAdjustment(departureTime);
    baseSpeed *= timeAdjustment.multiplier;

    // Calculate duration
    const durationMinutes = Math.round((estimatedDistance / baseSpeed) * 60);

    const adjustments = [
      `${areaType} area`,
      timeAdjustment.description,
      `Road factor ${roadMultiplier.toFixed(1)}x`
    ];

    return {
      durationMinutes,
      distanceMiles: Math.round(estimatedDistance * 10) / 10,
      confidence: 'low',
      method: 'calculated',
      adjustments,
      voiceSummary: `Estimated ${durationMinutes} minutes, about ${Math.round(estimatedDistance)} miles`
    };
  }

  private haversineDistance(origin: OfflineLocation, destination: OfflineLocation): number {
    const R = 3959; // Earth radius in miles
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLng = (destination.lng - origin.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private getRoadDistanceMultiplier(origin: OfflineLocation, destination: OfflineLocation): number {
    const distance = this.haversineDistance(origin, destination);
    
    // Empirical multipliers based on distance
    if (distance < 2) return 1.3;    // Short trips in city
    if (distance < 5) return 1.4;    // Medium city trips
    if (distance < 10) return 1.35;  // Suburban trips
    if (distance < 20) return 1.25;  // Mix of roads
    return 1.2;                      // Longer trips (more highways)
  }

  private determineAreaType(origin: OfflineLocation, destination: OfflineLocation): 'urban' | 'suburban' | 'rural' {
    // Use provided types if available
    if (origin.type && destination.type) {
      if (origin.type === 'urban' || destination.type === 'urban') return 'urban';
      if (origin.type === 'suburban' || destination.type === 'suburban') return 'suburban';
      return 'rural';
    }

    // Estimate based on coordinates (simplified)
    // In production, this would use population density data
    const avgLat = (origin.lat + destination.lat) / 2;
    const avgLng = (origin.lng + destination.lng) / 2;
    
    // Very simplified logic - would need real data
    if (Math.abs(avgLat - 40.7) < 0.5 && Math.abs(avgLng + 74) < 0.5) return 'urban'; // Near NYC
    if (Math.abs(avgLat - 34.0) < 0.5 && Math.abs(avgLng + 118.2) < 0.5) return 'urban'; // Near LA
    
    return 'suburban'; // Default
  }

  private getTimeOfDayAdjustment(time: Date): { multiplier: number; description: string } {
    const hour = getHours(time);
    const day = getDay(time);
    const isWeekday = day >= 1 && day <= 5;

    // Rush hour adjustments
    if (isWeekday) {
      if (hour >= 7 && hour <= 9) return { multiplier: 0.6, description: 'Morning rush hour' };
      if (hour >= 16 && hour <= 18) return { multiplier: 0.65, description: 'Evening rush hour' };
      if (hour >= 11 && hour <= 13) return { multiplier: 0.8, description: 'Lunch traffic' };
    }

    // Night time - less traffic
    if (hour >= 22 || hour <= 5) return { multiplier: 1.2, description: 'Light overnight traffic' };
    
    // Weekend
    if (!isWeekday) {
      if (hour >= 10 && hour <= 16) return { multiplier: 0.85, description: 'Weekend traffic' };
    }

    return { multiplier: 1.0, description: 'Normal traffic' };
  }

  private generateCacheKey(origin: OfflineLocation, destination: OfflineLocation): string {
    return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}_${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}_driving`;
  }

  private findSimilarRoutes(
    origin: OfflineLocation,
    destination: OfflineLocation,
    entries: CacheEntry[]
  ): CacheEntry[] {
    const threshold = 0.5; // miles
    
    return entries.filter(entry => {
      // Parse cache key to get coordinates
      const parts = entry.key.split('_');
      if (parts.length < 2) return false;
      
      const [originPart, destPart] = parts;
      const [oLat, oLng] = originPart.split(',').map(Number);
      const [dLat, dLng] = destPart.split(',').map(Number);
      
      // Check if origin and destination are close
      const originDistance = this.haversineDistance(origin, { lat: oLat, lng: oLng });
      const destDistance = this.haversineDistance(destination, { lat: dLat, lng: dLng });
      
      return originDistance < threshold && destDistance < threshold;
    });
  }

  private async findNearbyEstimate(
    origin: OfflineLocation,
    destination: OfflineLocation
  ): Promise<OfflineEstimate | null> {
    const entries = await this.cache.exportCache();
    const similar = this.findSimilarRoutes(origin, destination, entries);
    
    if (similar.length > 0) {
      // Use the most recent similar route
      const mostRecent = similar.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      return {
        durationMinutes: mostRecent.durationMinutes,
        distanceMiles: mostRecent.distanceMiles,
        confidence: 'medium',
        method: 'cached',
        adjustments: ['Using nearby route data'],
        voiceSummary: `About ${mostRecent.durationMinutes} minutes based on similar route`
      };
    }

    return null;
  }

  private getFallbackEstimate(origin: OfflineLocation, destination: OfflineLocation): OfflineEstimate {
    const distance = this.haversineDistance(origin, destination);
    const duration = Math.round((distance / 30) * 60); // Assume 30 mph average
    
    return {
      durationMinutes: duration,
      distanceMiles: Math.round(distance * 10) / 10,
      confidence: 'low',
      method: 'calculated',
      adjustments: ['Basic estimation'],
      voiceSummary: `Roughly ${duration} minutes offline estimate`
    };
  }

  async preloadCommonRoutes(commonPairs: Array<[OfflineLocation, OfflineLocation]>): Promise<void> {
    logger.info('Preloading common routes for offline use', { count: commonPairs.length });
    
    // This would be called during app initialization to ensure
    // common routes are available offline
    for (const [origin, destination] of commonPairs) {
      await this.estimateTravelTime(origin, destination, new Date());
    }
  }
}
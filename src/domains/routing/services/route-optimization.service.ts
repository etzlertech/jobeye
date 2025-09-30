/**
 * T067: RouteOptimizationService
 * Service for route optimization using Mapbox Optimization API with daily limit enforcement
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { DailyRouteRepository, DailyRoute } from '../repositories/daily-route.repository';
import { RouteWaypointRepository, RouteWaypoint } from '../repositories/route-waypoint.repository';

export interface OptimizationJob {
  job_id: string;
  latitude: number;
  longitude: number;
  address: string;
  estimated_duration_mins?: number;
  priority?: number;
}

export interface OptimizationResult {
  route_id: string;
  optimized_waypoints: RouteWaypoint[];
  total_distance_km: number;
  total_duration_mins: number;
  optimization_savings?: {
    distance_saved_km: number;
    time_saved_mins: number;
  };
}

export class RouteOptimizationService {
  private routeRepo: DailyRouteRepository;
  private waypointRepo: RouteWaypointRepository;
  private readonly MAX_OPTIMIZATIONS_PER_DISPATCHER_PER_DAY = 1; // Free tier: 100/month
  private readonly MAX_WAYPOINTS_PER_ROUTE = 12; // Mapbox Optimization API limit

  constructor(private supabase: SupabaseClient) {
    this.routeRepo = new DailyRouteRepository(supabase);
    this.waypointRepo = new RouteWaypointRepository(supabase);
  }

  /**
   * Create and optimize a route
   */
  async createAndOptimizeRoute(data: {
    tenant_id: string;
    assigned_to: string;
    route_date: string;
    jobs: OptimizationJob[];
    start_location?: { latitude: number; longitude: number; address: string };
    end_location?: { latitude: number; longitude: number; address: string };
  }): Promise<OptimizationResult> {
    // Check daily optimization limit
    await this.enforceOptimizationLimit(data.assigned_to, data.route_date);

    // Validate waypoint count
    if (data.jobs.length > this.MAX_WAYPOINTS_PER_ROUTE) {
      throw new Error(
        `Too many jobs for a single route. Maximum ${this.MAX_WAYPOINTS_PER_ROUTE} waypoints allowed. Please split into multiple routes.`
      );
    }

    // Create the route
    const route = await this.routeRepo.create({
      tenant_id: data.tenant_id,
      assigned_to: data.assigned_to,
      route_date: data.route_date,
      status: 'draft',
      optimization_used: true,
      total_jobs: data.jobs.length,
    });

    try {
      // Perform optimization
      const optimizedOrder = await this.callMapboxOptimizationAPI(
        data.jobs,
        data.start_location,
        data.end_location
      );

      // Create waypoints in optimized order
      const waypoints: Omit<RouteWaypoint, 'id' | 'created_at' | 'updated_at'>[] = optimizedOrder.map(
        (job, index) => ({
          tenant_id: data.tenant_id,
          route_id: route.id,
          job_id: job.job_id,
          waypoint_type: 'job',
          sequence: index + 1,
          address: job.address,
          latitude: job.latitude,
          longitude: job.longitude,
          status: 'pending',
          travel_time_mins: job.travel_time_mins,
          distance_km: job.distance_km,
        })
      );

      const createdWaypoints = await this.waypointRepo.createMany(waypoints);

      // Calculate totals
      const total_distance_km = optimizedOrder.reduce((sum, job) => sum + (job.distance_km || 0), 0);
      const total_duration_mins = optimizedOrder.reduce((sum, job) => sum + (job.travel_time_mins || 0), 0);

      // Update route with totals
      await this.routeRepo.update(route.id, {
        total_distance_km,
        estimated_duration_mins: total_duration_mins,
      });

      return {
        route_id: route.id,
        optimized_waypoints: createdWaypoints,
        total_distance_km,
        total_duration_mins,
        optimization_savings: optimizedOrder[0]?.optimization_savings,
      };
    } catch (error) {
      // Cleanup on failure
      await this.routeRepo.delete(route.id);
      throw error;
    }
  }

  /**
   * Re-optimize an existing route
   */
  async reoptimizeRoute(routeId: string): Promise<OptimizationResult> {
    const route = await this.routeRepo.findById(routeId);
    if (!route) {
      throw new Error('Route not found');
    }

    // Check daily optimization limit
    await this.enforceOptimizationLimit(route.assigned_to, route.route_date);

    const waypoints = await this.waypointRepo.findByRouteId(routeId);
    if (waypoints.length === 0) {
      throw new Error('No waypoints to optimize');
    }

    // Convert waypoints to jobs
    const jobs: OptimizationJob[] = waypoints
      .filter((wp) => wp.waypoint_type === 'job' && wp.job_id)
      .map((wp) => ({
        job_id: wp.job_id!,
        latitude: wp.latitude,
        longitude: wp.longitude,
        address: wp.address,
      }));

    // Perform optimization
    const optimizedOrder = await this.callMapboxOptimizationAPI(jobs);

    // Update waypoint sequences
    const waypointIdOrder = optimizedOrder.map((job) => {
      const wp = waypoints.find((w) => w.job_id === job.job_id);
      return wp!.id;
    });

    await this.waypointRepo.reorderSequence(routeId, waypointIdOrder);

    // Refresh waypoints
    const updatedWaypoints = await this.waypointRepo.findByRouteId(routeId);

    // Calculate new totals
    const total_distance_km = optimizedOrder.reduce((sum, job) => sum + (job.distance_km || 0), 0);
    const total_duration_mins = optimizedOrder.reduce((sum, job) => sum + (job.travel_time_mins || 0), 0);

    await this.routeRepo.update(routeId, {
      total_distance_km,
      estimated_duration_mins: total_duration_mins,
      optimization_used: true,
    });

    return {
      route_id: routeId,
      optimized_waypoints: updatedWaypoints,
      total_distance_km,
      total_duration_mins,
      optimization_savings: optimizedOrder[0]?.optimization_savings,
    };
  }

  /**
   * Get greedy (non-optimized) route order
   * Used when optimization limit is reached
   */
  async createGreedyRoute(data: {
    tenant_id: string;
    assigned_to: string;
    route_date: string;
    jobs: OptimizationJob[];
    start_location?: { latitude: number; longitude: number };
  }): Promise<OptimizationResult> {
    // Create the route
    const route = await this.routeRepo.create({
      tenant_id: data.tenant_id,
      assigned_to: data.assigned_to,
      route_date: data.route_date,
      status: 'draft',
      optimization_used: false,
      total_jobs: data.jobs.length,
    });

    // Use greedy nearest-neighbor algorithm
    const orderedJobs = this.greedyNearestNeighbor(data.jobs, data.start_location);

    // Create waypoints
    const waypoints: Omit<RouteWaypoint, 'id' | 'created_at' | 'updated_at'>[] = orderedJobs.map(
      (job, index) => ({
        tenant_id: data.tenant_id,
        route_id: route.id,
        job_id: job.job_id,
        waypoint_type: 'job',
        sequence: index + 1,
        address: job.address,
        latitude: job.latitude,
        longitude: job.longitude,
        status: 'pending',
      })
    );

    const createdWaypoints = await this.waypointRepo.createMany(waypoints);

    // Calculate distances using Haversine
    const total_distance_km = this.calculateTotalDistance(orderedJobs);

    await this.routeRepo.update(route.id, { total_distance_km });

    return {
      route_id: route.id,
      optimized_waypoints: createdWaypoints,
      total_distance_km,
      total_duration_mins: 0, // Unknown for greedy routes
    };
  }

  /**
   * Check if dispatcher has reached optimization limit for the day
   */
  async checkOptimizationLimit(dispatcherId: string, date: string): Promise<{
    limit_reached: boolean;
    uses_today: number;
    limit: number;
  }> {
    const today = date.split('T')[0];
    const count = await this.routeRepo.countOptimizationsForDispatcher(dispatcherId, today);

    return {
      limit_reached: count >= this.MAX_OPTIMIZATIONS_PER_DISPATCHER_PER_DAY,
      uses_today: count,
      limit: this.MAX_OPTIMIZATIONS_PER_DISPATCHER_PER_DAY,
    };
  }

  /**
   * Enforce optimization limit (throw error if exceeded)
   */
  private async enforceOptimizationLimit(dispatcherId: string, date: string): Promise<void> {
    const check = await this.checkOptimizationLimit(dispatcherId, date);

    if (check.limit_reached) {
      throw new Error(
        `Daily optimization limit reached (${check.limit}/day). Please use manual routing or wait until tomorrow.`
      );
    }
  }

  /**
   * Call Mapbox Optimization API
   * NOTE: This is a placeholder. Real implementation would use @mapbox/mapbox-sdk
   */
  private async callMapboxOptimizationAPI(
    jobs: OptimizationJob[],
    start?: { latitude: number; longitude: number },
    end?: { latitude: number; longitude: number }
  ): Promise<
    Array<
      OptimizationJob & {
        travel_time_mins?: number;
        distance_km?: number;
        optimization_savings?: { distance_saved_km: number; time_saved_mins: number };
      }
    >
  > {
    // TODO: Implement real Mapbox API call
    // For now, return jobs in original order with estimated values
    console.warn('Mapbox Optimization API not yet integrated. Using placeholder.');

    return jobs.map((job, index) => ({
      ...job,
      travel_time_mins: 15, // Placeholder
      distance_km: 5, // Placeholder
      optimization_savings: index === 0 ? { distance_saved_km: 10, time_saved_mins: 30 } : undefined,
    }));
  }

  /**
   * Greedy nearest-neighbor algorithm for route ordering
   */
  private greedyNearestNeighbor(
    jobs: OptimizationJob[],
    start?: { latitude: number; longitude: number }
  ): OptimizationJob[] {
    if (jobs.length === 0) return [];

    const remaining = [...jobs];
    const ordered: OptimizationJob[] = [];
    let current = start || { latitude: jobs[0].latitude, longitude: jobs[0].longitude };

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      remaining.forEach((job, index) => {
        const distance = this.haversineDistance(
          current.latitude,
          current.longitude,
          job.latitude,
          job.longitude
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      const nearest = remaining.splice(nearestIndex, 1)[0];
      ordered.push(nearest);
      current = { latitude: nearest.latitude, longitude: nearest.longitude };
    }

    return ordered;
  }

  /**
   * Calculate total distance for a route using Haversine
   */
  private calculateTotalDistance(jobs: OptimizationJob[]): number {
    let total = 0;

    for (let i = 0; i < jobs.length - 1; i++) {
      total += this.haversineDistance(
        jobs[i].latitude,
        jobs[i].longitude,
        jobs[i + 1].latitude,
        jobs[i + 1].longitude
      );
    }

    return total;
  }

  /**
   * Haversine distance formula (km)
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
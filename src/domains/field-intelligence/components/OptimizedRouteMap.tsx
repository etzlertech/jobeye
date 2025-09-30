/**
 * @file src/domains/field-intelligence/components/OptimizedRouteMap.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Interactive Mapbox route visualization with optimization display
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface JobLocation {
  jobId: string;
  jobName: string;
  latitude: number;
  longitude: number;
  sequence?: number;
}

interface RouteData {
  jobs: JobLocation[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  routeGeometry?: string; // encoded polyline
}

interface OptimizedRouteMapProps {
  scheduleId: string;
  userId: string;
  scheduledDate: string;
  onRouteClick?: (jobId: string) => void;
  className?: string;
}

/**
 * OptimizedRouteMap - Interactive Mapbox route visualization
 *
 * Features:
 * - Mapbox GL JS integration
 * - Route polyline overlay
 * - Job markers with sequence
 * - Distance and duration display
 * - Interactive job selection
 *
 * @example
 * ```tsx
 * <OptimizedRouteMap
 *   scheduleId={schedule.id}
 *   userId={user.id}
 *   scheduledDate="2025-09-30"
 *   onRouteClick={(jobId) => console.log('Job clicked:', jobId)}
 * />
 * ```
 */
export function OptimizedRouteMap({
  scheduleId,
  userId,
  scheduledDate,
  onRouteClick,
  className = '',
}: OptimizedRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    fetchRouteData();
  }, [scheduleId]);

  useEffect(() => {
    if (routeData && mapContainerRef.current && !mapRef.current) {
      initializeMap();
    }
  }, [routeData]);

  useEffect(() => {
    if (mapLoaded && routeData) {
      renderRoute();
    }
  }, [mapLoaded, routeData]);

  const fetchRouteData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/field-intelligence/routing/optimize?userId=${userId}&scheduledDate=${scheduledDate}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch route data');
      }

      const data = await response.json();

      if (data.data && data.data.optimizedJobs) {
        const jobs: JobLocation[] = data.data.optimizedJobs.map((job: any, index: number) => ({
          jobId: job.jobId,
          jobName: job.jobName || `Job ${index + 1}`,
          latitude: job.latitude,
          longitude: job.longitude,
          sequence: index + 1,
        }));

        setRouteData({
          jobs,
          totalDistanceMeters: data.data.totalDistanceMeters || 0,
          totalDurationSeconds: data.data.totalDurationSeconds || 0,
          routeGeometry: data.data.routeGeometry,
        });
      }
    } catch (err: any) {
      logger.error('Failed to fetch route data', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    if (!routeData || routeData.jobs.length === 0) return;

    // Note: In production, you would use actual Mapbox GL JS
    // For now, we'll create a placeholder that simulates the interface
    logger.info('Initializing map', {
      jobCount: routeData.jobs.length,
      bounds: calculateBounds(routeData.jobs),
    });

    setMapLoaded(true);
  };

  const renderRoute = () => {
    if (!routeData) return;

    logger.info('Rendering route on map', {
      jobCount: routeData.jobs.length,
      totalDistance: routeData.totalDistanceMeters,
    });

    // In production, this would add:
    // - Polyline for route
    // - Markers for each job with sequence numbers
    // - Start/end markers
    // - Click handlers for job selection
  };

  const calculateBounds = (jobs: JobLocation[]) => {
    const lats = jobs.map((j) => j.latitude);
    const lngs = jobs.map((j) => j.longitude);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  };

  const formatDistance = (meters: number) => {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(1)} mi`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const handleJobClick = (jobId: string) => {
    logger.info('Job marker clicked', { jobId });
    if (onRouteClick) {
      onRouteClick(jobId);
    }
  };

  if (loading) {
    return (
      <div className={`optimized-route-map ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded-lg" style={{ height: '400px' }}>
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`optimized-route-map ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchRouteData}
            className="mt-2 text-red-700 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!routeData || routeData.jobs.length === 0) {
    return (
      <div className={`optimized-route-map ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No route data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`optimized-route-map ${className}`}>
      {/* Route Stats */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Optimized Route</h3>
            <p className="text-sm text-gray-600">
              {routeData.jobs.length} stops • {formatDistance(routeData.totalDistanceMeters)} • {formatDuration(routeData.totalDurationSeconds)}
            </p>
          </div>
          <button
            onClick={fetchRouteData}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Refresh Route
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="bg-gray-100 border border-gray-300 rounded-lg overflow-hidden relative"
        style={{ height: '400px' }}
      >
        {/* Placeholder for Mapbox GL JS */}
        {/* In production, Mapbox GL would render here */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
          <div className="text-center p-6">
            <svg
              className="mx-auto h-16 w-16 text-blue-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <p className="text-gray-700 font-medium">Interactive Map Placeholder</p>
            <p className="text-sm text-gray-500 mt-1">
              Mapbox GL JS would render the optimized route here
            </p>
          </div>
        </div>

        {/* Job Markers Overlay (simulated) */}
        <div className="absolute top-4 left-4 space-y-2 max-h-80 overflow-y-auto">
          {routeData.jobs.map((job) => (
            <button
              key={job.jobId}
              onClick={() => handleJobClick(job.jobId)}
              className="bg-white border-2 border-blue-500 rounded-lg shadow-lg px-3 py-2 text-left hover:bg-blue-50 transition-colors block w-48"
            >
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {job.sequence}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {job.jobName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {job.latitude.toFixed(4)}, {job.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Route Legend */}
      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Start</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Job Stop</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>End</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-8 h-0.5 bg-blue-600"></div>
            <span>Route</span>
          </div>
        </div>
      </div>
    </div>
  );
}
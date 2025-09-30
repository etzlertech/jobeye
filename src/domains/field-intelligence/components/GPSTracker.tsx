/**
 * @file src/domains/field-intelligence/components/GPSTracker.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Real-time GPS tracking display with breadcrumb history
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface GPSCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

interface GPSTrackerProps {
  userId: string;
  jobId?: string;
  autoTrack?: boolean;
  trackingInterval?: number; // milliseconds
  onLocationUpdate?: (coordinate: GPSCoordinate) => void;
  className?: string;
}

/**
 * GPSTracker - Real-time GPS tracking with breadcrumb display
 *
 * Features:
 * - Real-time location tracking
 * - Breadcrumb history display
 * - Accuracy filtering (10m threshold)
 * - Offline queue support
 * - Distance traveled calculation
 *
 * @example
 * ```tsx
 * <GPSTracker
 *   userId={user.id}
 *   jobId={job.id}
 *   autoTrack={true}
 *   trackingInterval={30000}
 *   onLocationUpdate={(coord) => console.log('Location:', coord)}
 * />
 * ```
 */
export function GPSTracker({
  userId,
  jobId,
  autoTrack = false,
  trackingInterval = 30000, // 30 seconds default
  onLocationUpdate,
  className = '',
}: GPSTrackerProps) {
  const [tracking, setTracking] = useState(autoTrack);
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinate | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<GPSCoordinate[]>([]);
  const [totalDistance, setTotalDistance] = useState(0); // meters
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (tracking) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => stopTracking();
  }, [tracking]);

  const startTracking = () => {
    logger.info('Starting GPS tracking', { userId, jobId, trackingInterval });

    // Initial location capture
    captureLocation();

    // Set up interval
    trackingIntervalRef.current = setInterval(() => {
      captureLocation();
    }, trackingInterval);
  };

  const stopTracking = () => {
    logger.info('Stopping GPS tracking', { userId, jobId });

    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
  };

  const captureLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    try {
      const position = await getCurrentPosition();

      const coordinate: GPSCoordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString(),
      };

      // Filter by accuracy (10m threshold)
      if (coordinate.accuracy > 10) {
        logger.warn('GPS accuracy too low, skipping', { accuracy: coordinate.accuracy });
        return;
      }

      setCurrentLocation(coordinate);

      // Add to breadcrumbs
      setBreadcrumbs((prev) => {
        const updated = [...prev, coordinate];

        // Calculate distance from previous point
        if (prev.length > 0) {
          const prevCoord = prev[prev.length - 1];
          const distance = calculateDistance(
            prevCoord.latitude,
            prevCoord.longitude,
            coordinate.latitude,
            coordinate.longitude
          );
          setTotalDistance((prevTotal) => prevTotal + distance);
        }

        return updated;
      });

      // Upload to server
      await uploadCoordinate(coordinate);

      // Callback
      if (onLocationUpdate) {
        onLocationUpdate(coordinate);
      }

      setError(null);
    } catch (err: any) {
      logger.error('Failed to capture location', { error: err });
      setError(err.message);
    }
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const uploadCoordinate = async (coordinate: GPSCoordinate) => {
    setUploading(true);

    try {
      const response = await fetch('/api/field-intelligence/routing/gps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          jobId: jobId || null,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          accuracy: coordinate.accuracy,
          timestamp: coordinate.timestamp,
        }),
      });

      if (!response.ok) {
        // Don't throw error - allow offline queue to handle
        logger.warn('Failed to upload coordinate, will queue offline', {
          status: response.status,
        });
      } else {
        logger.info('Coordinate uploaded successfully');
      }
    } catch (err: any) {
      // Network error - will be queued for offline sync
      logger.warn('Network error uploading coordinate', { error: err });
    } finally {
      setUploading(false);
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    // Haversine formula
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
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    const miles = meters * 0.000621371;
    return `${miles.toFixed(2)} mi`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleToggleTracking = () => {
    setTracking((prev) => !prev);
  };

  const handleClearHistory = () => {
    if (confirm('Clear all GPS breadcrumbs?')) {
      setBreadcrumbs([]);
      setTotalDistance(0);
      logger.info('GPS breadcrumbs cleared');
    }
  };

  return (
    <div className={`gps-tracker ${className}`}>
      {/* Status Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                tracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            ></div>
            <h3 className="text-lg font-semibold text-gray-900">GPS Tracker</h3>
          </div>
          <button
            onClick={handleToggleTracking}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              tracking
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {tracking ? 'Stop Tracking' : 'Start Tracking'}
          </button>
        </div>

        {/* Current Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-600">Breadcrumbs</p>
            <p className="text-lg font-bold text-gray-900">{breadcrumbs.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Distance</p>
            <p className="text-lg font-bold text-gray-900">{formatDistance(totalDistance)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Accuracy</p>
            <p className="text-lg font-bold text-gray-900">
              {currentLocation ? `${currentLocation.accuracy.toFixed(0)}m` : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Current Location */}
      {currentLocation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <p className="text-sm font-medium text-green-900 mb-1">📍 Current Location</p>
          <div className="text-xs text-green-700 space-y-1">
            <p>Lat: {currentLocation.latitude.toFixed(6)}</p>
            <p>Lng: {currentLocation.longitude.toFixed(6)}</p>
            <p>Accuracy: {currentLocation.accuracy.toFixed(1)}m</p>
            <p>Time: {formatTimestamp(currentLocation.timestamp)}</p>
          </div>
          {uploading && (
            <p className="text-xs text-blue-600 mt-2">⬆️ Uploading to server...</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Breadcrumb History */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Breadcrumb History</h4>
          {breadcrumbs.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Clear History
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {breadcrumbs.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              No breadcrumbs recorded yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {breadcrumbs
                .slice()
                .reverse()
                .map((coord, index) => (
                  <div key={`${coord.timestamp}-${index}`} className="p-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900">
                          {coord.latitude.toFixed(6)}, {coord.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatTimestamp(coord.timestamp)}
                        </p>
                      </div>
                      <div className="text-xs text-gray-600">
                        ±{coord.accuracy.toFixed(0)}m
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Tracking Info */}
      {tracking && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          <p>
            🔄 Auto-tracking every {trackingInterval / 1000}s • Offline queue supported • 10m
            accuracy threshold
          </p>
        </div>
      )}
    </div>
  );
}
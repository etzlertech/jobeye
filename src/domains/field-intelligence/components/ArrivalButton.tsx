/**
 * @file src/domains/field-intelligence/components/ArrivalButton.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Job arrival button with automatic geofence detection
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface ArrivalButtonProps {
  userId: string;
  jobId: string;
  propertyId?: string;
  onArrival?: (arrivalId: string) => void;
  className?: string;
}

interface ArrivalStatus {
  hasArrived: boolean;
  arrivalData?: {
    arrivalId: string;
    arrivedAt: string;
    detectionMethod: 'GEOFENCE' | 'MANUAL' | 'GPS';
  };
}

/**
 * ArrivalButton - Log job arrival with geofence detection
 *
 * Features:
 * - Automatic geofence check
 * - Manual arrival logging
 * - Arrival status display
 * - Photo proof support (optional)
 *
 * @example
 * ```tsx
 * <ArrivalButton
 *   userId={user.id}
 *   jobId={job.id}
 *   propertyId={job.property_id}
 *   onArrival={(arrivalId) => console.log('Arrived:', arrivalId)}
 * />
 * ```
 */
export function ArrivalButton({
  userId,
  jobId,
  propertyId,
  onArrival,
  className = '',
}: ArrivalButtonProps) {
  const [arrivalStatus, setArrivalStatus] = useState<ArrivalStatus>({
    hasArrived: false,
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check arrival status on mount
  useEffect(() => {
    checkArrivalStatus();
  }, [userId, jobId]);

  // Auto-check geofence every 30 seconds
  useEffect(() => {
    if (arrivalStatus.hasArrived || !propertyId) return;

    const interval = setInterval(() => {
      checkGeofence();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [arrivalStatus.hasArrived, propertyId]);

  const checkArrivalStatus = async () => {
    try {
      const response = await fetch(
        `/api/field-intelligence/workflows/arrivals?userId=${userId}&jobId=${jobId}`
      );

      if (!response.ok) {
        throw new Error('Failed to check arrival status');
      }

      const data = await response.json();

      if (data.data) {
        setArrivalStatus({
          hasArrived: true,
          arrivalData: {
            arrivalId: data.data.arrivalId,
            arrivedAt: data.data.arrivedAt,
            detectionMethod: data.data.detectionMethod,
          },
        });
      }
    } catch (err: any) {
      logger.error('Failed to check arrival status', { error: err });
    }
  };

  const getGeolocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        { enableHighAccuracy: true }
      );
    });
  };

  const checkGeofence = async () => {
    if (!propertyId || checking) return;

    setChecking(true);

    try {
      const location = await getGeolocation();

      // Check if within geofence
      const response = await fetch(
        '/api/field-intelligence/routing/geofence/check',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            propertyId,
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check geofence');
      }

      const data = await response.json();

      // If arrival detected, log it
      if (data.data.eventDetected === 'ARRIVAL') {
        await logArrival(location, 'GEOFENCE');
      }
    } catch (err: any) {
      logger.error('Geofence check failed', { error: err });
    } finally {
      setChecking(false);
    }
  };

  const handleManualArrival = async () => {
    setLoading(true);
    setError(null);

    try {
      const location = await getGeolocation();
      await logArrival(location, 'MANUAL');
    } catch (err: any) {
      logger.error('Manual arrival failed', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logArrival = async (
    location: { latitude: number; longitude: number },
    detectionMethod: 'GEOFENCE' | 'MANUAL' | 'GPS'
  ) => {
    const response = await fetch(
      '/api/field-intelligence/workflows/arrivals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          jobId,
          latitude: location.latitude,
          longitude: location.longitude,
          detectionMethod,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to log arrival');
    }

    const data = await response.json();

    logger.info('Arrival logged successfully', {
      arrivalId: data.data.arrivalId,
      userId,
      jobId,
      detectionMethod,
    });

    setArrivalStatus({
      hasArrived: true,
      arrivalData: {
        arrivalId: data.data.arrivalId,
        arrivedAt: data.data.arrivedAt,
        detectionMethod: data.data.detectionMethod,
      },
    });

    if (onArrival) {
      onArrival(data.data.arrivalId);
    }
  };

  const formatArrivalTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDetectionMethodLabel = (method: string) => {
    switch (method) {
      case 'GEOFENCE':
        return '📍 Auto-detected';
      case 'MANUAL':
        return '👆 Manual';
      case 'GPS':
        return '🛰️ GPS';
      default:
        return method;
    }
  };

  return (
    <div className={`arrival-button ${className}`}>
      {error && (
        <div className="error-message text-red-600 text-sm mb-2">
          {error}
        </div>
      )}

      {arrivalStatus.hasArrived ? (
        <div className="arrival-status bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-2xl">✓</span>
            <div>
              <p className="font-medium">Arrived at Job Site</p>
              <p className="text-sm text-green-600">
                {arrivalStatus.arrivalData &&
                  formatArrivalTime(arrivalStatus.arrivalData.arrivedAt)}
                {' • '}
                {arrivalStatus.arrivalData &&
                  getDetectionMethodLabel(
                    arrivalStatus.arrivalData.detectionMethod
                  )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="arrival-controls">
          <button
            onClick={handleManualArrival}
            disabled={loading || checking}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging Arrival...' : 'Log Arrival'}
          </button>

          {checking && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              🔍 Checking geofence...
            </p>
          )}

          {propertyId && !checking && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              Automatic arrival detection active
            </p>
          )}
        </div>
      )}
    </div>
  );
}
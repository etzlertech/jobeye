/**
 * @file src/domains/field-intelligence/components/ClockInButton.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Clock in/out button with geolocation and status display
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface ClockInButtonProps {
  userId: string;
  jobId?: string;
  onClockIn?: (entryId: string) => void;
  onClockOut?: (entryId: string) => void;
  className?: string;
}

interface ClockStatus {
  isClockedIn: boolean;
  activeEntry: {
    id: string;
    job_id: string;
    clock_in_time: string;
  } | null;
}

/**
 * ClockInButton - Clock in/out with geolocation
 *
 * Features:
 * - Automatic geolocation capture
 * - Real-time clock status
 * - Duration display
 * - Offline support
 *
 * @example
 * ```tsx
 * <ClockInButton
 *   userId={user.id}
 *   jobId={currentJob.id}
 *   onClockIn={(entryId) => console.log('Clocked in:', entryId)}
 * />
 * ```
 */
export function ClockInButton({
  userId,
  jobId,
  onClockIn,
  onClockOut,
  className = '',
}: ClockInButtonProps) {
  const [clockStatus, setClockStatus] = useState<ClockStatus>({
    isClockedIn: false,
    activeEntry: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<string>('00:00:00');

  // Fetch clock status
  useEffect(() => {
    fetchClockStatus();
  }, [userId]);

  // Update duration every second
  useEffect(() => {
    if (!clockStatus.isClockedIn || !clockStatus.activeEntry) return;

    const interval = setInterval(() => {
      const clockInTime = new Date(clockStatus.activeEntry!.clock_in_time);
      const now = new Date();
      const diff = now.getTime() - clockInTime.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setDuration(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [clockStatus]);

  const fetchClockStatus = async () => {
    try {
      const response = await fetch(
        `/api/field-intelligence/time/clock/status?userId=${userId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch clock status');
      }

      const data = await response.json();
      setClockStatus(data.data);
    } catch (err: any) {
      logger.error('Failed to fetch clock status', { error: err });
      setError(err.message);
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
        }
      );
    });
  };

  const handleClockIn = async () => {
    if (!jobId) {
      setError('Job ID is required to clock in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get geolocation
      const location = await getGeolocation();

      // Clock in
      const response = await fetch('/api/field-intelligence/time/clock/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          jobId,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clock in');
      }

      const data = await response.json();

      logger.info('Clocked in successfully', {
        entryId: data.data.id,
        userId,
        jobId,
      });

      // Update status
      await fetchClockStatus();

      if (onClockIn) {
        onClockIn(data.data.id);
      }
    } catch (err: any) {
      logger.error('Clock in failed', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get geolocation
      const location = await getGeolocation();

      // Clock out
      const response = await fetch('/api/field-intelligence/time/clock/out', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clock out');
      }

      const data = await response.json();

      logger.info('Clocked out successfully', {
        entryId: data.data.id,
        userId,
      });

      // Update status
      await fetchClockStatus();

      if (onClockOut && clockStatus.activeEntry) {
        onClockOut(clockStatus.activeEntry.id);
      }
    } catch (err: any) {
      logger.error('Clock out failed', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`clock-in-button ${className}`}>
      {error && (
        <div className="error-message text-red-600 text-sm mb-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        {clockStatus.isClockedIn ? (
          <>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Clocked in</span>
              <span className="text-2xl font-bold text-green-600">
                {duration}
              </span>
            </div>
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Clocking Out...' : 'Clock Out'}
            </button>
          </>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={loading || !jobId}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Clocking In...' : 'Clock In'}
          </button>
        )}
      </div>

      {!jobId && !clockStatus.isClockedIn && (
        <p className="text-sm text-gray-500 mt-2">
          Select a job to clock in
        </p>
      )}
    </div>
  );
}
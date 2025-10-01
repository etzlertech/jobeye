/**
 * @file useCameraPermissions.ts
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose Camera permission management with manual fallback
 * @complexity_budget 150
 */

import { useState, useEffect, useCallback } from 'react';

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface CameraPermissionsResult {
  /** Current permission state */
  permission: PermissionState;
  /** Whether camera is currently active */
  isActive: boolean;
  /** Request camera permissions */
  requestPermission: () => Promise<boolean>;
  /** Error message if permission fails */
  error: string | null;
  /** Whether device supports camera */
  isSupported: boolean;
}

/**
 * Hook for managing camera permissions with MediaDevices API
 * Falls back to manual checklist if camera denied/unsupported
 */
export function useCameraPermissions(): CameraPermissionsResult {
  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  // Check if MediaDevices API is supported
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setPermission('unsupported');
      setError('Camera not supported on this device');
    }
  }, []);

  // Request camera permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    try {
      setError(null);

      // Request rear camera with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Rear camera for equipment scanning
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      // Permission granted - stop stream (will be restarted by camera component)
      stream.getTracks().forEach(track => track.stop());

      setPermission('granted');
      setIsActive(false);
      return true;

    } catch (err: any) {
      console.error('[useCameraPermissions] Permission error:', err);

      // Map error types to permission states
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermission('denied');
        setError('Camera permission denied. Please enable in browser settings or use manual checklist.');
      } else if (err.name === 'NotFoundError') {
        setPermission('unsupported');
        setError('No camera found on device. Please use manual checklist.');
      } else if (err.name === 'NotReadableError') {
        setPermission('denied');
        setError('Camera is in use by another application.');
      } else {
        setPermission('denied');
        setError(`Camera error: ${err.message}`);
      }

      return false;
    }
  }, [isSupported]);

  // Check permission status on mount (if Permissions API available)
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.permissions) {
      return;
    }

    navigator.permissions
      .query({ name: 'camera' as PermissionName })
      .then(permissionStatus => {
        setPermission(permissionStatus.state as PermissionState);

        // Listen for permission changes
        permissionStatus.onchange = () => {
          setPermission(permissionStatus.state as PermissionState);
        };
      })
      .catch(() => {
        // Permissions API not supported - will check on requestPermission
        console.warn('[useCameraPermissions] Permissions API not available');
      });
  }, []);

  return {
    permission,
    isActive,
    requestPermission,
    error,
    isSupported,
  };
}

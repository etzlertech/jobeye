/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/register-sw.ts
 * phase: 3
 * domain: scheduling
 * purpose: Register and manage service worker lifecycle
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 150
 * state_machine: none
 * estimated_llm_cost: 0.001
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/core/logger/voice-logger"
 *   external: none
 *   supabase: none
 * exports:
 *   - registerServiceWorker
 *   - unregisterServiceWorker
 *   - getServiceWorkerStatus
 * voice_considerations:
 *   - Announce offline/online status changes
 * test_requirements:
 *   coverage: 80%
 *   test_file: src/__tests__/scheduling/unit/register-sw.test.ts
 * tasks:
 *   - Register service worker
 *   - Handle updates
 *   - Monitor status
 *   - Communicate with worker
 */

import { logger } from '@/core/logger/voice-logger';

export interface ServiceWorkerStatus {
  registered: boolean;
  ready: boolean;
  updateAvailable: boolean;
  offline: boolean;
}

let swRegistration: ServiceWorkerRegistration | null = null;
let statusCallbacks: Array<(status: ServiceWorkerStatus) => void> = [];

export async function registerServiceWorker(
  onStatusChange?: (status: ServiceWorkerStatus) => void
): Promise<ServiceWorkerRegistration | null> {
  if (onStatusChange) {
    statusCallbacks.push(onStatusChange);
  }

  if (!('serviceWorker' in navigator)) {
    logger.warn('Service Worker not supported');
    return null;
  }

  if (typeof window === 'undefined') {
    return null; // Server-side rendering
  }

  try {
    // Register the service worker
    swRegistration = await navigator.serviceWorker.register('/sw-scheduling.js', {
      scope: '/'
    });

    logger.info('Service Worker registered', {
      scope: swRegistration.scope,
      metadata: { voice: { message: 'Offline support enabled' } }
    });

    // Handle updates
    swRegistration.addEventListener('updatefound', () => {
      const newWorker = swRegistration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          notifyStatusChange({ updateAvailable: true });
          logger.info('Service Worker updated', {
            metadata: { voice: { message: 'App updated, refresh for latest version' } }
          });
        }
      });
    });

    // Handle messages from service worker
    navigator.serviceWorker.addEventListener('message', handleWorkerMessage);

    // Monitor online/offline status
    window.addEventListener('online', () => {
      notifyStatusChange({ offline: false });
      logger.info('Back online', {
        metadata: { voice: { message: 'Connection restored' } }
      });
    });

    window.addEventListener('offline', () => {
      notifyStatusChange({ offline: true });
      logger.info('Gone offline', {
        metadata: { voice: { message: 'Working offline' } }
      });
    });

    // Initial status
    notifyStatusChange({
      registered: true,
      ready: true,
      updateAvailable: false,
      offline: !navigator.onLine
    });

    // Request periodic sync for background updates
    if ('periodicSync' in swRegistration) {
      try {
        await (swRegistration as any).periodicSync.register('scheduling-background-sync', {
          minInterval: 60 * 60 * 1000 // 1 hour
        });
        logger.info('Periodic sync registered');
      } catch (error) {
        logger.warn('Periodic sync registration failed', { error });
      }
    }

    return swRegistration;
  } catch (error) {
    logger.error('Service Worker registration failed', { error });
    notifyStatusChange({
      registered: false,
      ready: false,
      updateAvailable: false,
      offline: false
    });
    return null;
  }
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (!swRegistration) {
    return false;
  }

  try {
    const success = await swRegistration.unregister();
    if (success) {
      logger.info('Service Worker unregistered');
      swRegistration = null;
      notifyStatusChange({
        registered: false,
        ready: false,
        updateAvailable: false,
        offline: false
      });
    }
    return success;
  } catch (error) {
    logger.error('Failed to unregister Service Worker', { error });
    return false;
  }
}

export function getServiceWorkerStatus(): ServiceWorkerStatus {
  return {
    registered: !!swRegistration,
    ready: !!swRegistration?.active,
    updateAvailable: !!swRegistration?.waiting,
    offline: !navigator.onLine
  };
}

export function sendMessageToServiceWorker(message: any): void {
  if (!swRegistration?.active) {
    logger.warn('No active service worker to send message to');
    return;
  }

  swRegistration.active.postMessage(message);
}

export function checkForUpdates(): void {
  if (swRegistration) {
    swRegistration.update().catch(error => {
      logger.error('Failed to check for updates', { error });
    });
  }
}

export function skipWaiting(): void {
  sendMessageToServiceWorker({ type: 'SKIP_WAITING' });
}

export function clearServiceWorkerCache(): void {
  sendMessageToServiceWorker({ type: 'CLEAR_CACHE' });
}

export function cacheResources(urls: string[]): void {
  sendMessageToServiceWorker({ type: 'CACHE_RESOURCES', urls });
}

function handleWorkerMessage(event: MessageEvent): void {
  const { data } = event;
  
  logger.debug('Message from Service Worker', { type: data.type });

  switch (data.type) {
    case 'OFFLINE_REQUEST_QUEUED':
      logger.info('Request queued for offline sync', {
        url: data.url,
        metadata: { voice: { message: 'Saved for when online' } }
      });
      break;

    case 'SYNC_STARTED':
      logger.info('Sync started', {
        metadata: { voice: { message: 'Syncing data' } }
      });
      break;

    case 'SYNC_COMPLETED':
      logger.info('Sync completed', {
        metadata: { voice: { message: 'All data synced' } }
      });
      break;

    case 'SYNC_FAILED':
      logger.error('Sync failed', {
        error: data.error,
        metadata: { voice: { message: 'Sync failed, will retry' } }
      });
      break;
  }

  // Notify listeners about sync events
  if (data.type.includes('SYNC')) {
    notifyStatusChange(getServiceWorkerStatus());
  }
}

function notifyStatusChange(partialStatus?: Partial<ServiceWorkerStatus>): void {
  const currentStatus = getServiceWorkerStatus();
  const status = { ...currentStatus, ...partialStatus };
  
  statusCallbacks.forEach(callback => {
    try {
      callback(status);
    } catch (error) {
      logger.error('Status callback error', { error });
    }
  });
}

// Auto-register on import in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    registerServiceWorker().catch(error => {
      logger.error('Auto service worker registration failed', { error });
    });
  });
}
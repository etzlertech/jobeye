/**
 * @file /src/lib/offline/index.ts
 * @purpose Export offline utilities
 * @phase 3
 * @domain Core Infrastructure
 * @complexity_budget 50
 * @test_coverage 100%
 */

export { offlineDB } from './offline-db';
export type { OfflineQueueItem, CachedEntity } from './offline-db';

export { syncManager } from './sync-manager';
export type { SyncResult } from './sync-manager';

// Utility function to check online status
export function isOnline(): boolean {
  return navigator.onLine;
}

// Utility function to register service worker
export async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}
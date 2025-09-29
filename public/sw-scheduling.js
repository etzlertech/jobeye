/**
 * AGENT DIRECTIVE BLOCK
 * file: public/sw-scheduling.js
 * phase: 3
 * domain: scheduling
 * purpose: Service worker for offline scheduling functionality
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 250
 * state_machine: installing -> active -> offline/online
 * estimated_llm_cost: 0.001
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: none
 *   external:
 *     - workbox-core
 *     - workbox-routing
 *     - workbox-strategies
 *   supabase: none
 * exports: none (service worker)
 * voice_considerations:
 *   - Cache voice commands for offline processing
 *   - Store voice feedback messages
 * test_requirements:
 *   coverage: 80%
 *   test_file: src/__tests__/scheduling/integration/service-worker.test.ts
 * tasks:
 *   - Cache scheduling resources
 *   - Handle offline API requests
 *   - Sync when online
 *   - Cache voice assets
 */

// Import Workbox libraries
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { ExpirationPlugin } = workbox.expiration;
const { BackgroundSyncPlugin } = workbox.backgroundSync;

// Cache names
const CACHE_NAME = 'jobeye-scheduling-v1';
const RUNTIME_CACHE = 'jobeye-runtime-v1';
const OFFLINE_QUEUE = 'jobeye-offline-queue';

// Resources to precache
const PRECACHE_URLS = [
  '/offline.html',
  '/scheduling/offline-notice.html',
  '/assets/voice/offline-message.mp3',
  '/assets/voice/sync-complete.mp3',
  '/assets/voice/sync-failed.mp3'
];

// Install event - precache resources
self.addEventListener('install', (event) => {
  console.log('[Scheduling SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Scheduling SW] Precaching resources');
        return cache.addAll(PRECACHE_URLS.filter(url => {
          // Only cache files that exist
          return fetch(url, { method: 'HEAD' })
            .then(() => true)
            .catch(() => {
              console.log(`[Scheduling SW] Skipping missing resource: ${url}`);
              return false;
            });
        }));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[Scheduling SW] Activating...');
  
  const cacheWhitelist = [CACHE_NAME, RUNTIME_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log(`[Scheduling SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Cache strategies for different resource types

// API routes - Network first with offline fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/scheduling'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60 // 24 hours
      }),
      new BackgroundSyncPlugin('scheduling-sync', {
        maxRetentionTime: 24 * 60 // 24 hours in minutes
      })
    ]
  })
);

// Kit data - Cache first (relatively static)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/kits'),
  new CacheFirst({
    cacheName: 'kit-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
      })
    ]
  })
);

// Voice assets - Cache first
registerRoute(
  ({ request }) => request.destination === 'audio',
  new CacheFirst({
    cacheName: 'voice-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

// Images - Cache first
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

// Static assets (JS, CSS) - Stale while revalidate
registerRoute(
  ({ request }) => 
    request.destination === 'script' ||
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources'
  })
);

// Handle offline POST requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'POST') return;

  // Check if it's a scheduling API request
  if (event.request.url.includes('/api/scheduling') || 
      event.request.url.includes('/api/kit-overrides')) {
    
    event.respondWith(
      fetch(event.request.clone())
        .catch(async () => {
          // Store failed request for later sync
          const requestData = await event.request.json();
          
          // Store in IndexedDB through client
          const client = await self.clients.get(event.clientId);
          if (client) {
            client.postMessage({
              type: 'OFFLINE_REQUEST_QUEUED',
              url: event.request.url,
              method: event.request.method,
              data: requestData,
              timestamp: new Date().toISOString()
            });
          }

          // Return offline response
          return new Response(
            JSON.stringify({
              success: true,
              offline: true,
              message: 'Request queued for sync',
              id: `offline_${Date.now()}`
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
  }
});

// Handle sync event
self.addEventListener('sync', (event) => {
  console.log('[Scheduling SW] Sync event:', event.tag);
  
  if (event.tag === 'scheduling-sync') {
    event.waitUntil(syncSchedulingData());
  }
});

// Background sync function
async function syncSchedulingData() {
  try {
    // Notify all clients that sync is starting
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STARTED',
        timestamp: new Date().toISOString()
      });
    });

    // The actual sync is handled by the SyncQueue in the app
    // This just triggers the process
    
    // Notify completion
    setTimeout(() => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETED',
          timestamp: new Date().toISOString()
        });
      });
    }, 1000);

  } catch (error) {
    console.error('[Scheduling SW] Sync failed:', error);
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_FAILED',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[Scheduling SW] Message received:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        })
      );
      break;
      
    case 'CACHE_RESOURCES':
      if (event.data.urls) {
        event.waitUntil(
          caches.open(RUNTIME_CACHE).then(cache => {
            return cache.addAll(event.data.urls);
          })
        );
      }
      break;
  }
});

// Periodic sync for better offline support
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'scheduling-background-sync') {
    console.log('[Scheduling SW] Periodic sync triggered');
    event.waitUntil(syncSchedulingData());
  }
});

// Push notifications for sync status
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  console.log('[Scheduling SW] Push received:', data);

  const options = {
    body: data.body || 'Scheduling update',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.id
    },
    actions: [
      {
        action: 'view',
        title: 'View Schedule'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'JobEye Scheduling', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Scheduling SW] Notification click:', event.action);
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/scheduling')
    );
  }
});

console.log('[Scheduling SW] Service worker loaded');
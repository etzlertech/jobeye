/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /public/sw.js
 * phase: 3
 * domain: pwa
 * purpose: Enhanced Service Worker for PWA with offline sync and caching
 * spec_ref: 007-mvp-intent-driven/contracts/pwa-service-worker.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['installing', 'waiting', 'active', 'syncing'],
 *   transitions: [
 *     'installing->waiting: installComplete()',
 *     'waiting->active: activate()',
 *     'active->syncing: backgroundSync()',
 *     'syncing->active: syncComplete()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "serviceWorker": "$0.00 (no AI operations)"
 * }
 * offline_capability: CORE
 * dependencies: {
 *   internal: [],
 *   external: [],
 *   supabase: []
 * }
 * exports: []
 * voice_considerations: Cache voice recordings and transcripts for offline use
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/pwa/service-worker.test.js'
 * }
 * tasks: [
 *   'Implement cache strategies for different resource types',
 *   'Add background sync for offline operations',
 *   'Cache critical app shell and pages',
 *   'Handle voice recordings and image uploads offline'
 * ]
 */

// Service Worker for JobEye MVP Intent-Driven Mobile App
// Version: 2.0.0 - Enhanced with advanced offline capabilities

const CACHE_NAME = 'jobeye-mvp-v2';
const OFFLINE_CACHE_NAME = 'jobeye-offline-v2';
const SYNC_CACHE_NAME = 'jobeye-sync-v2';
const VOICE_CACHE_NAME = 'jobeye-voice-v2';
const IMAGE_CACHE_NAME = 'jobeye-images-v2';

const OFFLINE_URL = '/offline.html';

// Critical resources to cache immediately
const STATIC_CACHE_URLS = [
  '/',
  '/crew',
  '/supervisor', 
  '/admin',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Runtime cache patterns
const RUNTIME_CACHE_PATTERNS = [
  { pattern: /^\/api\/crew\//, cacheName: 'api-crew' },
  { pattern: /^\/api\/supervisor\//, cacheName: 'api-supervisor' },
  { pattern: /^\/api\/intent\//, cacheName: 'api-intent' },
  { pattern: /\.(png|jpg|jpeg|gif|webp|svg)$/, cacheName: 'images' },
  { pattern: /\.(mp3|wav|ogg|m4a)$/, cacheName: 'voice' }
];

// Background sync tags
const SYNC_TAGS = {
  OFFLINE_OPERATIONS: 'offline-operations',
  VOICE_UPLOADS: 'voice-uploads',
  IMAGE_UPLOADS: 'image-uploads',
  DATA_SYNC: 'data-sync'
};

// Cache size limits
const CACHE_LIMITS = {
  'api-crew': 50,
  'api-supervisor': 50,
  'api-intent': 100,
  'images': 200,
  'voice': 50
};

// Install event - cache static assets and initialize caches
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2.0.0...');
  
  event.waitUntil(
    Promise.all([
      // Cache critical static assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      }),
      
      // Initialize specialized caches
      caches.open(OFFLINE_CACHE_NAME),
      caches.open(SYNC_CACHE_NAME),
      caches.open(VOICE_CACHE_NAME),
      caches.open(IMAGE_CACHE_NAME)
    ])
  );
  
  // Force immediate activation
  self.skipWaiting();
});

// Activate event - clean up old caches and initialize background sync
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v2.0.0...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        const validCaches = [
          CACHE_NAME, OFFLINE_CACHE_NAME, SYNC_CACHE_NAME, 
          VOICE_CACHE_NAME, IMAGE_CACHE_NAME
        ];
        return Promise.all(
          cacheNames
            .filter((cacheName) => !validCaches.includes(cacheName))
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      
      // Initialize background sync
      initializeBackgroundSync()
    ])
  );
  
  // Take control of all clients immediately
  self.clients.claim();
});

// Enhanced fetch event handler with intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests and extension requests
  if (!request.url.startsWith('http') || url.pathname.startsWith('/_next/webpack-hmr')) {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (request.method === 'GET') {
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(handleApiRequest(request));
    } else if (isImageRequest(request)) {
      event.respondWith(handleImageRequest(request));
    } else if (isVoiceRequest(request)) {
      event.respondWith(handleVoiceRequest(request));
    } else if (isStaticAsset(url.pathname)) {
      event.respondWith(handleStaticAssetRequest(request));
    } else {
      event.respondWith(handlePageRequest(request));
    }
  } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    event.respondWith(handleMutationRequest(request));
  }
});

// Handle API requests with intelligent caching and offline queueing
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const cacheName = getCacheNameForPattern(url.pathname);
  
  try {
    // Network first for API requests
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName || CACHE_NAME);
      cache.put(request, networkResponse.clone());
      
      // Limit cache size
      if (cacheName && CACHE_LIMITS[cacheName]) {
        await limitCacheSize(cacheName, CACHE_LIMITS[cacheName]);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for API request:', error);
    
    // For GET requests, try cache
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Add offline indicator header
        const response = cachedResponse.clone();
        response.headers.set('X-Served-From-Cache', 'true');
        return response;
      }
    }
    
    // Return offline response
    return new Response(
      JSON.stringify({
        error: 'Network unavailable',
        offline: true,
        message: 'This request will be retried when connection is restored'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle page requests with cache-first for app shell
async function handlePageRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Cache-first for app shell pages
    if (isAppShellPage(url.pathname)) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Update cache in background
        updateCacheInBackground(request);
        return cachedResponse;
      }
    }
    
    // Network first for other pages
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for page request:', error);
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    
    return new Response('Network error', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Handle mutation requests with offline queueing
async function handleMutationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for mutation request, queueing:', error);
    
    // Queue the request for background sync
    await queueRequestForSync(request);
    
    // Return optimistic response
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: 'Request queued for sync when connection is restored',
        queued: true
      }),
      {
        status: 202,
        statusText: 'Accepted',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
  try {
    // Check cache first for images
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(IMAGE_CACHE_NAME, CACHE_LIMITS.images);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to load image:', error);
    
    // Return cached response or placeholder
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('', { status: 404 });
  }
}

// Handle voice recording requests
async function handleVoiceRequest(request) {
  try {
    // Voice recordings are typically large, try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(VOICE_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(VOICE_CACHE_NAME, CACHE_LIMITS.voice);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to load voice recording:', error);
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('', { status: 404 });
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAssetRequest(request) {
  try {
    // Cache first for static assets
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to load static asset:', error);
    return new Response('', { status: 404 });
  }
}

// Enhanced background sync event handler
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.OFFLINE_OPERATIONS:
      event.waitUntil(syncOfflineOperations());
      break;
    case SYNC_TAGS.VOICE_UPLOADS:
      event.waitUntil(syncVoiceUploads());
      break;
    case SYNC_TAGS.IMAGE_UPLOADS:
      event.waitUntil(syncImageUploads());
      break;
    case SYNC_TAGS.DATA_SYNC:
      event.waitUntil(syncData());
      break;
    default:
      // Legacy support
      if (event.tag === 'sync-offline-queue') {
        event.waitUntil(syncOfflineOperations());
      }
  }
});

// Enhanced message handler for client communication
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'QUEUE_OFFLINE_OPERATION':
      queueOfflineOperation(payload);
      break;
    case 'CACHE_VOICE_RECORDING':
      cacheVoiceRecording(payload);
      break;
    case 'CACHE_IMAGE':
      cacheImage(payload);
      break;
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
  }
});

// Queue offline operations for background sync
async function queueRequestForSync(request) {
  const operation = {
    id: generateId(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: request.method !== 'GET' ? await request.text() : null,
    timestamp: Date.now()
  };
  
  const cache = await caches.open(SYNC_CACHE_NAME);
  const key = `sync-${operation.id}`;
  
  await cache.put(
    key,
    new Response(JSON.stringify(operation), {
      headers: { 'Content-Type': 'application/json' }
    })
  );
  
  // Register background sync
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    const registration = await self.registration;
    await registration.sync.register(SYNC_TAGS.OFFLINE_OPERATIONS);
  }
}

// Sync offline operations when connection is restored
async function syncOfflineOperations() {
  console.log('[SW] Syncing offline operations...');
  
  const cache = await caches.open(SYNC_CACHE_NAME);
  const requests = await cache.keys();
  const syncRequests = requests.filter(req => req.url.includes('sync-'));
  
  for (const request of syncRequests) {
    try {
      const response = await cache.match(request);
      const operation = await response.json();
      
      // Reconstruct and execute the request
      const originalRequest = new Request(operation.url, {
        method: operation.method,
        headers: operation.headers,
        body: operation.body
      });
      
      const result = await fetch(originalRequest);
      
      if (result.ok) {
        // Remove from sync queue
        await cache.delete(request);
        console.log('[SW] Successfully synced operation:', operation.id);
      } else {
        console.log('[SW] Failed to sync operation:', operation.id, result.status);
      }
    } catch (error) {
      console.log('[SW] Error syncing operation:', error);
    }
  }
}

// Sync voice uploads
async function syncVoiceUploads() {
  console.log('[SW] Syncing voice uploads...');
  // Voice files are handled through regular sync operations
  await syncOfflineOperations();
}

// Sync image uploads  
async function syncImageUploads() {
  console.log('[SW] Syncing image uploads...');
  // Image files are handled through regular sync operations
  await syncOfflineOperations();
}

// Sync general data
async function syncData() {
  console.log('[SW] Syncing data...');
  await syncOfflineOperations();
}

// Utility functions
function isAppShellPage(pathname) {
  const appShellPages = ['/', '/crew', '/supervisor', '/admin'];
  return appShellPages.includes(pathname) || pathname.startsWith('/_next/static');
}

function isImageRequest(request) {
  return request.destination === 'image' || 
         request.url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);
}

function isVoiceRequest(request) {
  return request.url.includes('voice') || 
         request.url.match(/\.(mp3|wav|ogg|m4a)$/i);
}

function isStaticAsset(pathname) {
  return pathname.startsWith('/_next/static') || 
         pathname.match(/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)$/i);
}

function getCacheNameForPattern(pathname) {
  for (const pattern of RUNTIME_CACHE_PATTERNS) {
    if (pattern.pattern.test(pathname)) {
      return pattern.cacheName;
    }
  }
  return null;
}

async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    // Remove oldest entries (FIFO)
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

async function updateCacheInBackground(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response);
    }
  } catch (error) {
    // Silent fail for background updates
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function initializeBackgroundSync() {
  // Register for background sync on installation
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    console.log('[SW] Background sync is supported');
  }
}

async function queueOfflineOperation(operation) {
  const cache = await caches.open(SYNC_CACHE_NAME);
  const key = `operation-${generateId()}`;
  
  await cache.put(
    key,
    new Response(JSON.stringify(operation), {
      headers: { 'Content-Type': 'application/json' }
    })
  );
}

async function cacheVoiceRecording(data) {
  const cache = await caches.open(VOICE_CACHE_NAME);
  const response = new Response(data.blob, {
    headers: { 'Content-Type': 'audio/wav' }
  });
  
  await cache.put(`voice-${data.id}`, response);
}

async function cacheImage(data) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const response = new Response(data.blob, {
    headers: { 'Content-Type': data.type }
  });
  
  await cache.put(`image-${data.id}`, response);
}

async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    status[name] = keys.length;
  }
  
  return status;
}
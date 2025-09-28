/**
 * AGENT DIRECTIVE BLOCK
 * file: src/components/providers/pwa-provider.tsx
 * phase: 5
 * domain: shared-components
 * purpose: PWA provider for service worker registration and offline support
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 150
 * dependencies:
 *   - internal: None
 *   - external: react, next
 * exports: PWAProvider
 * voice_considerations:
 *   - Announce offline/online status changes via voice
 * offline_capability: REQUIRED
 * test_requirements:
 *   - coverage: 85%
 *   - test_file: src/components/providers/__tests__/pwa-provider.test.tsx
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface PWAContextType {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  installPrompt: (() => void) | null;
  registration: ServiceWorkerRegistration | null;
}

const PWAContext = createContext<PWAContextType>({
  isOnline: true,
  isInstallable: false,
  isInstalled: false,
  installPrompt: null,
  registration: null
});

export const usePWA = () => useContext(PWAContext);

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<(() => void) | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Register service worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      registerServiceWorker();
    }

    // Set up online/offline detection
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when back online
      if (registration?.sync) {
        registration.sync.register('sync-offline-operations');
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set up install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [registration]);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js');
      setRegistration(reg);

      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('New service worker available');
            }
          });
        }
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'sync-complete') {
          console.log('Offline sync completed:', event.data.data);
        }
      });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        isInstallable,
        isInstalled,
        installPrompt: isInstallable ? handleInstallClick : null,
        registration
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
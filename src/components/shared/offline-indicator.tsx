/**
 * AGENT DIRECTIVE BLOCK
 * file: src/components/shared/offline-indicator.tsx
 * phase: 5
 * domain: shared-components
 * purpose: Offline status indicator with voice announcements
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 100
 * dependencies:
 *   - internal: usePWA hook
 *   - external: react
 * exports: OfflineIndicator
 * voice_considerations:
 *   - Announce connection status changes
 *   - Provide voice feedback for sync status
 * offline_capability: REQUIRED
 * test_requirements:
 *   - coverage: 85%
 *   - test_file: src/components/shared/__tests__/offline-indicator.test.tsx
 */

'use client';

import { useEffect, useState } from 'react';
import { usePWA } from '@/components/providers/pwa-provider';

export function OfflineIndicator() {
  const { isOnline } = usePWA();
  const [showIndicator, setShowIndicator] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Show indicator when offline
    setShowIndicator(!isOnline);

    // Announce status change
    if (!isOnline && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('You are now offline. Changes will be saved locally.');
      speechSynthesis.speak(utterance);
    }

    // Trigger sync when back online
    if (isOnline && showIndicator) {
      setIsSyncing(true);
      syncOfflineData();
    }
  }, [isOnline]);

  const syncOfflineData = async () => {
    try {
      const response = await fetch('/api/sync/offline-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: ['all'] })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Announce sync result
        if ('speechSynthesis' in window) {
          const message = result.success
            ? 'All offline changes have been synced'
            : 'Some offline changes could not be synced';
          const utterance = new SpeechSynthesisUtterance(message);
          speechSynthesis.speak(utterance);
        }
      }
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setShowIndicator(false), 3000);
    }
  };

  if (!showIndicator) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg
          ${isOnline ? 'bg-green-500' : 'bg-orange-500'} text-white
        `}
      >
        {!isOnline && (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
            <span className="font-medium">Offline Mode</span>
          </>
        )}
        
        {isOnline && isSyncing && (
          <>
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="font-medium">Syncing...</span>
          </>
        )}
        
        {isOnline && !isSyncing && (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-medium">Back Online</span>
          </>
        )}
      </div>
    </div>
  );
}
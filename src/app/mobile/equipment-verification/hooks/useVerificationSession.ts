/**
 * @file useVerificationSession.ts
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose Verification session state management and workflow orchestration
 * @complexity_budget 300
 */

import { useState, useCallback, useEffect } from 'react';
import {
  VerificationWorkflowService,
  type VerificationSession,
  type EquipmentChecklistItem,
  type DetectionResult,
} from '../services/verification-workflow.service';
import type { DetectedItem } from '@/domains/vision/types';

export type VerificationMode = 'camera' | 'manual';
export type SessionStatus = 'initializing' | 'detecting' | 'processing' | 'complete' | 'failed';

export interface VerificationSessionHookResult {
  /** Current session ID */
  sessionId: string | null;
  /** Job ID being verified */
  jobId: string | null;
  /** Equipment checklist */
  checklist: EquipmentChecklistItem[];
  /** Current mode (camera or manual) */
  mode: VerificationMode;
  /** Current session status */
  status: SessionStatus;
  /** Error message if session fails */
  error: string | null;
  /** Retry count for detections */
  retryCount: number;
  /** Initialize verification session */
  initSession: (jobId: string, companyId: string) => Promise<void>;
  /** Update checklist with detected items */
  updateChecklist: (detectedItems: DetectedItem[]) => void;
  /** Complete verification session */
  completeSession: (photo: ImageData, detectedItems: DetectedItem[]) => Promise<boolean>;
  /** Switch to manual mode */
  switchToManual: () => void;
  /** Manually toggle item verified state (manual mode only) */
  toggleItemVerified: (itemId: string) => void;
  /** Increment retry count */
  incrementRetries: () => void;
  /** Reset retry count */
  resetRetries: () => void;
  /** Check if all required items verified */
  isComplete: boolean;
}

/**
 * Hook for managing verification session lifecycle
 * Integrates with VerificationWorkflowService for orchestration
 */
export function useVerificationSession(): VerificationSessionHookResult {
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [mode, setMode] = useState<VerificationMode>('camera');
  const [status, setStatus] = useState<SessionStatus>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const workflowService = new VerificationWorkflowService();

  /**
   * Initialize verification session
   */
  const initSession = useCallback(
    async (jobId: string, companyId: string): Promise<void> => {
      try {
        setStatus('initializing');
        setError(null);

        console.log('[useVerificationSession] Initializing session', { jobId, companyId });

        const newSession = await workflowService.startVerification(jobId, companyId);
        setSession(newSession);
        setStatus('detecting');

        console.log('[useVerificationSession] Session initialized', {
          sessionId: newSession.sessionId,
          checklistSize: newSession.checklist.length,
        });

      } catch (err: any) {
        console.error('[useVerificationSession] Failed to initialize session:', err);
        setError(err.message || 'Failed to start verification');
        setStatus('failed');
      }
    },
    []
  );

  /**
   * Update checklist with detected items (auto-verify in camera mode)
   */
  const updateChecklist = useCallback((detectedItems: DetectedItem[]) => {
    if (!session) {
      return;
    }

    const detectedNames = detectedItems
      .filter(item => item.confidence_score >= 0.7)
      .map(item => item.class_name);

    const updatedChecklist = session.checklist.map(item => {
      // Only auto-verify in camera mode
      if (mode === 'camera' && detectedNames.includes(item.name)) {
        return { ...item, verified: true };
      }
      return item;
    });

    setSession({
      ...session,
      checklist: updatedChecklist,
    });

    console.log('[useVerificationSession] Checklist updated', {
      detectedCount: detectedNames.length,
      verifiedCount: updatedChecklist.filter(i => i.verified).length,
      totalCount: updatedChecklist.length,
    });
  }, [session, mode]);

  /**
   * Manually toggle item verified state (manual mode only)
   */
  const toggleItemVerified = useCallback((itemId: string) => {
    if (!session || mode !== 'manual') {
      return;
    }

    const updatedChecklist = session.checklist.map(item =>
      item.id === itemId ? { ...item, verified: !item.verified } : item
    );

    setSession({
      ...session,
      checklist: updatedChecklist,
    });

    console.log('[useVerificationSession] Item toggled', { itemId });
  }, [session, mode]);

  /**
   * Complete verification session
   */
  const completeSession = useCallback(
    async (photo: ImageData, detectedItems: DetectedItem[]): Promise<boolean> => {
      if (!session) {
        console.error('[useVerificationSession] Cannot complete - no active session');
        return false;
      }

      try {
        setStatus('processing');
        setError(null);

        console.log('[useVerificationSession] Completing session', {
          sessionId: session.sessionId,
        });

        const result = await workflowService.completeVerification(
          session,
          photo,
          detectedItems
        );

        setStatus('complete');

        console.log('[useVerificationSession] Session completed', {
          verificationId: result.verificationId,
          verified: result.verified,
          offlineQueued: result.offlineQueued,
          missingItems: result.missingItems,
        });

        return result.verified;

      } catch (err: any) {
        console.error('[useVerificationSession] Failed to complete session:', err);
        setError(err.message || 'Failed to save verification');
        setStatus('failed');
        return false;
      }
    },
    [session]
  );

  /**
   * Switch to manual mode (camera unavailable/denied)
   */
  const switchToManual = useCallback(() => {
    console.log('[useVerificationSession] Switching to manual mode');
    setMode('manual');
    setStatus('detecting'); // Reset to detecting for manual verification
  }, []);

  /**
   * Increment retry count
   */
  const incrementRetries = useCallback(() => {
    setRetryCount(prev => {
      const newCount = prev + 1;
      console.log('[useVerificationSession] Retry count incremented', { count: newCount });
      return newCount;
    });
  }, []);

  /**
   * Reset retry count
   */
  const resetRetries = useCallback(() => {
    setRetryCount(0);
  }, []);

  /**
   * Check if all required items verified
   */
  const isComplete = session
    ? session.checklist
        .filter(item => item.required)
        .every(item => item.verified)
    : false;

  return {
    sessionId: session?.sessionId || null,
    jobId: session?.jobId || null,
    checklist: session?.checklist || [],
    mode,
    status,
    error,
    retryCount,
    initSession,
    updateChecklist,
    completeSession,
    switchToManual,
    toggleItemVerified,
    incrementRetries,
    resetRetries,
    isComplete,
  };
}

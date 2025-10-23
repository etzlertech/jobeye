/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/crew/load-verify/page.tsx
 * phase: 3
 * domain: crew
 * purpose: Load verification page with camera-based equipment detection
 * spec_ref: 007-mvp-intent-driven/contracts/crew-ui.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['job_selection', 'camera_active', 'detection_running', 'results_review', 'verification_complete'],
 *   transitions: [
 *     'job_selection->camera_active: selectJob()',
 *     'camera_active->detection_running: capturePhoto()',
 *     'detection_running->results_review: detectionComplete()',
 *     'results_review->camera_active: retakePhoto()',
 *     'results_review->verification_complete: confirmVerification()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "visionDetection": "$0.03-0.05 per photo (VLM)",
 *   "localYOLO": "$0.00 (local inference)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/components/camera/CameraCapture',
 *     '@/components/ui/ButtonLimiter',
 *     '@/components/ui/ItemChecklist',
 *     '@/domains/crew/services/crew-workflow.service'
 *   ],
 *   external: ['react', 'next/navigation'],
 *   supabase: ['jobs', 'equipment']
 * }
 * exports: ['default']
 * voice_considerations: Voice commands for hands-free verification workflow
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/crew-load-verification-flow.test.ts'
 * }
 * tasks: [
 *   'Create job selection interface',
 *   'Implement camera-based equipment detection',
 *   'Show verification results with confidence scores',
 *   'Allow manual equipment checklist override'
 * ]
 */

'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  AlertCircle,
  Package,
  RefreshCw,
  Play,
  X,
  Eye,
  RotateCcw,
  Brain,
  Zap,
  Clock,
  Shield
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { ItemChecklist } from '@/components/ui/ItemChecklist';
import { LoadItemStateManager } from '@/domains/crew/lib/load-item-state-manager';
import { getLoadVerificationSyncService } from '@/domains/crew/services/load-verification-sync.service';
import { OfflineDatabase } from '@/lib/offline/offline-db';
import { createBrowserClient } from '@/lib/supabase/client';
import { JobLoadRepository } from '@/domains/crew/repositories/job-load.repository';

interface Job {
  id: string;
  customerName: string;
  propertyAddress: string;
  scheduledTime: string;
  status: string;
  requiredEquipment: Array<{
    id: string;
    name: string;
    category: string;
    required: boolean;
  }>;
  loadVerified: boolean;
}

interface DetectionResult {
  id: string;
  name: string;
  confidence: number;
  detected: boolean;
  category: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface VerificationResult {
  verified: boolean;
  method: 'ai_vision' | 'manual' | 'hybrid';
  confidence: number;
  detectedItems: DetectionResult[];
  missingItems: string[];
  verifiedItems: string[];
  photoUrl?: string;
  processingTime: number;
  cost: number;
}

function CrewLoadVerifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams?.get('jobId');
  const { actions, addAction, clearActions } = useButtonActions();

  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(preselectedJobId);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationStep, setVerificationStep] = useState<'job_selection' | 'camera' | 'processing' | 'results' | 'manual'>('job_selection');

  // Camera and detection state
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  // Manual verification state
  const [manualItems, setManualItems] = useState<Record<string, boolean>>({});
  const [showManualMode, setShowManualMode] = useState(false);

  // Offline state
  const [offlineMode, setOfflineMode] = useState(typeof window !== 'undefined' ? !navigator.onLine : false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Setup button actions
  useEffect(() => {
    clearActions();

    if (verificationStep === 'job_selection') {
      addAction({
        id: 'back',
        label: 'Back',
        priority: 'medium',
        icon: ArrowLeft,
        onClick: () => router.back(),
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });

      if (selectedJob) {
        addAction({
          id: 'start-verification',
          label: 'Start Verification',
          priority: 'critical',
          icon: Camera,
          onClick: () => {
            setVerificationStep('camera');
            setShowCamera(true);
          },
          className: 'bg-emerald-600 text-white hover:bg-emerald-700'
        });

        addAction({
          id: 'manual-mode',
          label: 'Manual Check',
          priority: 'high',
          icon: CheckCircle,
          onClick: () => {
            setVerificationStep('manual');
            setShowManualMode(true);
          },
          className: 'bg-blue-600 text-white hover:bg-blue-700'
        });
      }
    } else if (verificationStep === 'camera') {
      addAction({
        id: 'cancel-camera',
        label: 'Cancel',
        priority: 'high',
        icon: X,
        onClick: () => {
          setShowCamera(false);
          setVerificationStep('job_selection');
        },
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    } else if (verificationStep === 'results') {
      addAction({
        id: 'retake-photo',
        label: 'Retake',
        priority: 'high',
        icon: RotateCcw,
        onClick: () => {
          setVerificationStep('camera');
          setShowCamera(true);
          setVerificationResult(null);
          setCapturedImage(null);
        },
        className: 'bg-orange-600 text-white hover:bg-orange-700'
      });

      addAction({
        id: 'manual-override',
        label: 'Manual Check',
        priority: 'high',
        icon: Eye,
        onClick: () => {
          setVerificationStep('manual');
          setShowManualMode(true);
        },
        className: 'bg-blue-600 text-white hover:bg-blue-700'
      });

      addAction({
        id: 'confirm-verification',
        label: 'Done',
        priority: 'critical',
        icon: CheckCircle,
        onClick: handleConfirmVerification,
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });
    } else if (verificationStep === 'manual') {
      addAction({
        id: 'back-to-results',
        label: 'Back',
        priority: 'high',
        icon: ArrowLeft,
        onClick: () => {
          setShowManualMode(false);
          setVerificationStep(verificationResult ? 'results' : 'job_selection');
        },
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });

      addAction({
        id: 'confirm-manual',
        label: 'Done',
        priority: 'critical',
        icon: CheckCircle,
        onClick: handleManualVerification,
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });
    }
  }, [verificationStep, selectedJob, verificationResult, clearActions, addAction]);

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  // Initialize offline sync and network listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncService = getLoadVerificationSyncService();

    // Start auto-sync
    syncService.startAutoSync(30000); // Sync every 30 seconds

    // Update pending count
    const updatePendingCount = async () => {
      const count = await syncService.getPendingCount();
      setPendingSyncCount(count);
    };

    // Initial count
    updatePendingCount();

    // Network event listeners
    const handleOnline = () => {
      setOfflineMode(false);
      updatePendingCount();
    };

    const handleOffline = () => {
      setOfflineMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic pending count update
    const intervalId = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
      syncService.stopAutoSync();
    };
  }, []);

  // Auto-select job if provided in URL
  useEffect(() => {
    if (preselectedJobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === preselectedJobId);
      if (job) {
        // Use handleJobSelect to load saved states
        handleJobSelect(job);
      }
    }
  }, [preselectedJobId, jobs]);

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/crew/jobs');
      const data = await response.json();

      // Filter to only unverified jobs
      const unverifiedJobs = (data.jobs || []).filter((job: Job) => !job.loadVerified);
      setJobs(unverifiedJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJobSelect = async (job: Job) => {
    setSelectedJob(job);
    setSelectedJobId(job.id);

    try {
      // Fetch current item states from database
      const response = await fetch(`/api/crew/jobs/${job.id}/load-items`);
      const data = await response.json();

      if (data.success && data.items) {
        // Initialize with actual saved states
        const initialState: Record<string, boolean> = {};

        data.items.forEach((item: any) => {
          // Mark as checked if verified or loaded
          initialState[item.id] = item.status === 'verified' || item.status === 'loaded';
        });

        console.log('[LoadVerify] Loaded item states:', initialState);
        setManualItems(initialState);
      } else {
        // Fallback: Initialize all as unchecked
        const initialState: Record<string, boolean> = {};
        job.requiredEquipment.forEach(item => {
          initialState[item.id] = false;
        });
        setManualItems(initialState);
      }
    } catch (error) {
      console.error('[LoadVerify] Failed to load item states:', error);

      // Fallback: Initialize all as unchecked
      const initialState: Record<string, boolean> = {};
      job.requiredEquipment.forEach(item => {
        initialState[item.id] = false;
      });
      setManualItems(initialState);
    }
  };

  const handleCameraCapture = async (imageBlob: Blob, imageUrl: string) => {
    if (!selectedJob) return;

    setIsProcessing(true);
    setVerificationStep('processing');
    setCapturedImage(imageUrl);

    try {
      const startTime = Date.now();

      // Call load verification API
      const formData = new FormData();
      formData.append('photo', imageBlob, 'load-verification.jpg');
      formData.append('jobId', selectedJob.id);

      const response = await fetch(`/api/crew/jobs/${selectedJob.id}/load-verify`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        const processingTime = Date.now() - startTime;

        // Transform API result to our interface
        const verificationResult: VerificationResult = {
          verified: result.verification.verified,
          method: result.verification.method,
          confidence: result.verification.confidence || 0,
          detectedItems: result.verification.detectedItems?.map((item: any) => ({
            id: item.id || item.name,
            name: item.name,
            confidence: item.confidence || 0,
            detected: true,
            category: item.category || 'equipment',
            bbox: item.bbox
          })) || [],
          missingItems: result.verification.missingItems || [],
          verifiedItems: result.verification.verifiedItems || [],
          photoUrl: result.verification.photoUrl,
          processingTime,
          cost: result.verification.cost || 0
        };

        // 🆕 AUTO-SAVE detected items immediately
        try {
          const supabase = createBrowserClient();
          const loadRepo = new JobLoadRepository(supabase as any);
          const offlineDB = OfflineDatabase.getInstance();
          const stateManager = new LoadItemStateManager(
            selectedJob.id,
            loadRepo,
            offlineDB
          );

          // Build item updates from detection results
          const detectedItemIds = verificationResult.detectedItems.map(item => item.id);
          const allItems = selectedJob.requiredEquipment;

          const itemUpdates = allItems.map(item => ({
            itemId: item.id,
            status: detectedItemIds.includes(item.id) ? 'verified' as const : 'missing' as const,
          }));

          const saveResult = await stateManager.batchUpdateItems(itemUpdates);

          if (saveResult.offline) {
            console.log('[LoadVerify] Changes saved offline - will sync when online');
          } else {
            console.log('[LoadVerify] Changes saved successfully');
          }
        } catch (saveError) {
          console.error('[LoadVerify] Failed to auto-save detection results:', saveError);
          // Don't block the UI if auto-save fails
        }

        setVerificationResult(verificationResult);
        setVerificationStep('results');
        setShowCamera(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setVerificationStep('camera');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!verificationResult || !selectedJob) return;

    try {
      // Mark job as verified
      const response = await fetch(`/api/crew/jobs/${selectedJob.id}/verify-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified: verificationResult.verified,
          method: verificationResult.method,
          detectedItems: verificationResult.detectedItems,
          missingItems: verificationResult.missingItems
        })
      });

      if (response.ok) {
        router.push('/crew');
      }
    } catch (error) {
      console.error('Failed to confirm verification:', error);
    }
  };

  const handleManualVerification = async () => {
    if (!selectedJob) return;

    const verifiedItems = Object.entries(manualItems)
      .filter(([_, checked]) => checked)
      .map(([itemId, _]) => {
        const item = selectedJob.requiredEquipment.find(eq => eq.id === itemId);
        return item?.name || itemId;
      });

    const missingItems = selectedJob.requiredEquipment
      .filter(item => !manualItems[item.id])
      .map(item => item.name);

    try {
      const response = await fetch(`/api/crew/jobs/${selectedJob.id}/verify-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified: missingItems.length === 0,
          method: 'manual',
          verifiedItems,
          missingItems
        })
      });

      if (response.ok) {
        router.push('/crew');
      }
    } catch (error) {
      console.error('Failed to save manual verification:', error);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading jobs...</p>
          </div>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 0 0.5rem;
            box-sizing: border-box;
          }
        `}</style>
      </div>
    );
  }

  // Camera view
  if (showCamera) {
    return (
      <div className="min-h-screen bg-black">
        <CameraCapture
          onCapture={handleCameraCapture}
          maxFps={1}
          showIntentOverlay={false}
          className="h-screen"
        />

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-white">
              <Brain className="w-12 h-12 animate-pulse mx-auto mb-4" style={{ color: '#FFD700' }} />
              <p className="text-lg font-medium mb-2">Analyzing Equipment...</p>
              <p className="text-sm text-gray-300">Using AI vision to detect items</p>
            </div>
          </div>
        )}

        {/* Instructions overlay */}
        {!isProcessing && (
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black to-transparent">
            <div className="text-center text-white">
              <Package className="w-8 h-8 mx-auto mb-2" style={{ color: '#FFD700' }} />
              <p className="text-lg font-medium">Position Equipment in Frame</p>
              <p className="text-sm text-gray-300">Ensure all items are clearly visible</p>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
          <ButtonLimiter
            actions={actions}
            maxVisibleButtons={4}
            showVoiceButton={false}
            className="justify-center"
          />
        </div>
      </div>
    );
  }

  // Manual verification mode
  if (showManualMode && selectedJob) {
    return (
      <div className="mobile-container">
        {/* Header */}
        <div className="header-bar">
          <button
            type="button"
            onClick={() => {
              setShowManualMode(false);
              setVerificationStep(verificationResult ? 'results' : 'job_selection');
            }}
            className="icon-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Manual Equipment Check</h1>
        </div>

        {/* Offline Indicator */}
        {offlineMode && (
          <div className="offline-banner">
            <AlertCircle className="w-4 h-4" />
            <span>Offline - changes will sync when online</span>
            {pendingSyncCount > 0 && (
              <span className="pending-count">{pendingSyncCount} pending</span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Job Info */}
            <div className="info-card">
              <h2 className="text-lg font-semibold mb-2">{selectedJob.customerName}</h2>
              <p className="text-gray-400 text-sm">{selectedJob.propertyAddress}</p>
              <p className="text-gray-500 text-xs mt-1">Scheduled: {formatTime(selectedJob.scheduledTime)}</p>
            </div>

            {/* Checklist */}
            <div className="checklist-card">
              <h3 className="text-base font-semibold mb-3">Check off items as you verify:</h3>
              <ItemChecklist
                items={selectedJob.requiredEquipment.map(item => ({
                  id: item.id,
                  name: item.name,
                  category: item.category,
                  required: item.required,
                  checked: manualItems[item.id] || false
                }))}
                onChange={async (itemId, checked) => {
                  // Update local state immediately (optimistic update)
                  setManualItems(prev => ({
                    ...prev,
                    [itemId]: checked
                  }));

                  // 🆕 AUTO-SAVE to database
                  try {
                    const supabase = createBrowserClient();
                    const loadRepo = new JobLoadRepository(supabase as any);
                    const offlineDB = OfflineDatabase.getInstance();
                    const stateManager = new LoadItemStateManager(
                      selectedJob.id,
                      loadRepo,
                      offlineDB
                    );

                    const status = checked ? 'verified' : 'pending';
                    const result = await stateManager.updateItemState(itemId, status);

                    if (result.offline) {
                      console.log('[LoadVerify] Item state saved offline');
                    } else {
                      console.log('[LoadVerify] Item state saved');
                    }
                  } catch (error) {
                    console.error('[LoadVerify] Failed to auto-save item state:', error);
                    // Don't block the UI if auto-save fails
                  }
                }}
                title=""
              />
            </div>

            {/* Actions */}
            <div className="actions-section">
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={false}
                className="justify-center"
              />
            </div>
          </div>
        </div>

        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 0 0.5rem;
            box-sizing: border-box;
          }

          .header-bar {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            border-bottom: 1px solid #333;
            background: rgba(0, 0, 0, 0.9);
          }

          .icon-button {
            padding: 0.375rem;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .icon-button:hover {
            background: rgba(255, 215, 0, 0.2);
            border-color: #FFD700;
          }

          .info-card {
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }

          .checklist-card {
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }

          .actions-section {
            padding: 1rem 0;
          }
        `}</style>
      </div>
    );
  }

  // Verification results view
  if (verificationStep === 'results' && verificationResult && selectedJob) {
    return (
      <div className="mobile-container">
        {/* Header */}
        <div className="header-bar">
          <button
            type="button"
            onClick={() => {
              setVerificationStep('job_selection');
              setVerificationResult(null);
              setCapturedImage(null);
            }}
            className="icon-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Verification Results</h1>
          <div className={`status-badge ${verificationResult.verified ? 'complete' : 'missing'}`}>
            {verificationResult.verified ? 'Complete' : 'Missing'}
          </div>
        </div>

        {/* Offline Indicator */}
        {offlineMode && (
          <div className="offline-banner">
            <AlertCircle className="w-4 h-4" />
            <span>Offline - changes will sync when online</span>
            {pendingSyncCount > 0 && (
              <span className="pending-count">{pendingSyncCount} pending</span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Photo */}
            {capturedImage && (
              <div className="photo-card">
                <h2 className="text-base font-semibold mb-3">Captured Image</h2>
                <img
                  src={capturedImage}
                  alt="Equipment verification"
                  className="photo-image"
                />
              </div>
            )}

            {/* Detected Items */}
            {verificationResult.detectedItems.length > 0 && (
              <div className="results-card">
                <h3 className="text-base font-semibold mb-3 text-green-400">Detected Items</h3>
                <div className="space-y-2">
                  {verificationResult.detectedItems.map((item, index) => (
                    <div key={index} className="detected-item">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-400">
                          Confidence: {Math.round(item.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Items */}
            {verificationResult.missingItems.length > 0 && (
              <div className="results-card">
                <h3 className="text-base font-semibold mb-3 text-red-400">Missing Items</h3>
                <div className="space-y-2">
                  {verificationResult.missingItems.map((item, index) => (
                    <div key={index} className="missing-item">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <p className="font-medium">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="stats-card">
              <h3 className="text-base font-semibold mb-3">Verification Stats</h3>
              <div className="space-y-3">
                <div className="stat-row">
                  <Brain className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-gray-400">Method</p>
                    <p className="font-medium capitalize">{verificationResult.method.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="stat-row">
                  <Clock className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="text-xs text-gray-400">Processing Time</p>
                    <p className="font-medium">{verificationResult.processingTime}ms</p>
                  </div>
                </div>

                <div className="stat-row">
                  <Zap className="w-5 h-5" style={{ color: '#FFD700' }} />
                  <div>
                    <p className="text-xs text-gray-400">Overall Confidence</p>
                    <p className="font-medium">{Math.round(verificationResult.confidence * 100)}%</p>
                  </div>
                </div>

                <div className="stat-row">
                  <Shield className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-xs text-gray-400">Cost</p>
                    <p className="font-medium">${verificationResult.cost.toFixed(4)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Job Info */}
            <div className="job-info-card">
              <h3 className="text-base font-semibold mb-3">Job Details</h3>
              <div className="space-y-1">
                <p className="font-medium">{selectedJob.customerName}</p>
                <p className="text-sm text-gray-400">{selectedJob.propertyAddress}</p>
                <p className="text-sm text-gray-400">Time: {formatTime(selectedJob.scheduledTime)}</p>
                <p className="text-sm text-gray-400">
                  Equipment: {selectedJob.requiredEquipment.length} items
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="actions-section">
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={false}
                className="justify-center"
              />
            </div>
          </div>
        </div>

        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 0 0.5rem;
            box-sizing: border-box;
          }

          .header-bar {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            border-bottom: 1px solid #333;
            background: rgba(0, 0, 0, 0.9);
          }

          .icon-button {
            padding: 0.375rem;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .icon-button:hover {
            background: rgba(255, 215, 0, 0.2);
            border-color: #FFD700;
          }

          .status-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: auto;
          }

          .status-badge.complete {
            background: rgba(34, 197, 94, 0.2);
            color: #86efac;
          }

          .status-badge.missing {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
          }

          .photo-card {
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }

          .photo-image {
            width: 100%;
            height: 12rem;
            object-fit: cover;
            border-radius: 0.5rem;
          }

          .results-card {
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }

          .detected-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            border-radius: 0.5rem;
          }

          .missing-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 0.5rem;
          }

          .stats-card {
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }

          .stat-row {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .job-info-card {
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }

          .actions-section {
            padding: 1rem 0;
          }
        `}</style>
      </div>
    );
  }

  // Main job selection view
  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="header-bar">
        <button
          type="button"
          onClick={() => router.back()}
          className="icon-button"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Load Verification</h1>
      </div>

      {/* Offline Indicator */}
      {offlineMode && (
        <div className="offline-banner">
          <AlertCircle className="w-4 h-4" />
          <span>Offline - changes will sync when online</span>
          {pendingSyncCount > 0 && (
            <span className="pending-count">{pendingSyncCount} pending</span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Job Selection */}
          <div className="jobs-section">
            <div className="section-header">
              <h2 className="text-lg font-semibold">Select Job to Verify</h2>
              <span className="count-badge">{jobs.length}</span>
            </div>

            {jobs.length > 0 ? (
              <div className="space-y-3">
                {jobs.map(job => (
                  <div
                    key={job.id}
                    className={`job-card ${selectedJobId === job.id ? 'selected' : ''}`}
                    onClick={() => handleJobSelect(job)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{job.customerName}</h3>
                        <p className="text-sm text-gray-400 truncate mt-1">{job.propertyAddress}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>Time: {formatTime(job.scheduledTime)}</span>
                          <span>Equipment: {job.requiredEquipment.length} items</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <Package className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-orange-400 font-medium">Unverified</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-400">All jobs have verified loads</p>
              </div>
            )}
          </div>

          {/* Selected Job Details */}
          {selectedJob && (
            <div className="equipment-section">
              <h3 className="text-base font-semibold mb-3">Required Equipment</h3>
              <div className="space-y-2">
                {selectedJob.requiredEquipment.map(item => (
                  <div key={item.id} className="equipment-item">
                    <Package className="w-4 h-4 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{item.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="instructions-card">
            <h3 className="font-medium mb-2" style={{ color: '#FFD700' }}>How it works</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>1. Select a job to verify</li>
              <li>2. Use camera for AI detection</li>
              <li>3. Or manually check items</li>
              <li>4. Confirm verification</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="actions-section">
            <ButtonLimiter
              actions={actions}
              maxVisibleButtons={4}
              showVoiceButton={false}
              className="justify-center"
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 0.5rem;
          box-sizing: border-box;
        }

        .header-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .icon-button {
          padding: 0.375rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-button:hover {
          background: rgba(255, 215, 0, 0.2);
          border-color: #FFD700;
        }

        .jobs-section {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 1rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .job-card {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.15);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .job-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 215, 0, 0.3);
        }

        .job-card.selected {
          background: rgba(255, 215, 0, 0.1);
          border-color: #FFD700;
        }

        .empty-state {
          text-align: center;
          padding: 2rem 1rem;
        }

        .equipment-section {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
        }

        .equipment-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 0.375rem;
        }

        .instructions-card {
          padding: 1rem;
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.75rem;
        }

        .actions-section {
          padding: 1rem 0;
        }

        .offline-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(234, 179, 8, 0.1);
          border-bottom: 1px solid rgba(234, 179, 8, 0.3);
          color: #fbbf24;
          font-size: 0.875rem;
        }

        .pending-count {
          margin-left: auto;
          padding: 0.25rem 0.5rem;
          background: rgba(234, 179, 8, 0.2);
          border-radius: 0.375rem;
          font-weight: 600;
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}

// Loading component for Suspense boundary
function LoadingFallback() {
  return (
    <div className="mobile-container">
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 0.5rem;
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}

// Main export with Suspense boundary
export default function CrewLoadVerifyPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CrewLoadVerifyPageContent />
    </Suspense>
  );
}

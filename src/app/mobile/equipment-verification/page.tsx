'use client';

/**
 * @file page.tsx
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose Main equipment verification page integrating camera, detection, and checklist
 * @complexity_budget 200
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCameraPermissions } from './hooks/useCameraPermissions';
import { useVLMDetection } from './hooks/useVLMDetection';
import { useVerificationSession } from './hooks/useVerificationSession';
import { CameraFeed } from './components/CameraFeed';
import { DetectionOverlay } from './components/DetectionOverlay';
import { EquipmentChecklist } from './components/EquipmentChecklist';
import { ManualChecklistFallback } from './components/ManualChecklistFallback';
import { OfflineQueueStatus } from './components/OfflineQueueStatus';
import { getOfflineQueue } from '@/domains/vision/lib/offline-queue';

/**
 * Equipment Verification Page Content
 *
 * Workflow:
 * 1. Extract job_id from URL params
 * 2. Initialize verification session
 * 3. Request camera permissions
 * 4. Start YOLO detection at 1fps if camera granted
 * 5. Auto-update checklist from detections
 * 6. Trigger VLM fallback if confidence <70% or retries >=3
 * 7. Complete verification and save (Supabase or offline queue)
 */
function EquipmentVerificationContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams?.get('job_id') || 'demo-job';
  const companyId = searchParams?.get('company_id') || 'demo-company';

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showFailureAnimation, setShowFailureAnimation] = useState(false);

  // Hooks
  const camera = useCameraPermissions();
  const session = useVerificationSession();

  // VLM-first detection (replaces YOLO)
  const vlm = useVLMDetection({
    expectedItems: session.checklist.map(item => item.name),
    enabled: camera.permission === 'granted',
    targetFps: 1.0, // Start at 1fps, can increase to 2.0 if needed
  });

  const offlineQueue = getOfflineQueue();

  // Initialize session on mount
  useEffect(() => {
    session.initSession(jobId, companyId);
  }, [jobId, companyId]);

  // Request camera on mount
  useEffect(() => {
    if (camera.isSupported) {
      camera.requestPermission();
    } else {
      session.switchToManual();
    }
  }, [camera.isSupported]);

  // Handle camera permission granted
  useEffect(() => {
    const requestStream = async () => {
      if (camera.permission === 'granted') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        setVideoStream(stream);
      }
    };

    requestStream().catch(err => {
      console.error('[EquipmentVerificationPage] Failed to get stream:', err);
      session.switchToManual();
    });
  }, [camera.permission]);

  // Handle camera denied - switch to manual
  useEffect(() => {
    if (camera.permission === 'denied' || camera.permission === 'unsupported') {
      session.switchToManual();
    }
  }, [camera.permission]);

  // Start VLM detection when video stream ready
  useEffect(() => {
    if (videoStream && videoRef.current) {
      vlm.startDetection(videoRef.current);
    }

    return () => {
      vlm.stopDetection();
    };
  }, [videoStream]);

  // Update checklist from VLM detections with haptic feedback
  useEffect(() => {
    if (vlm.detectionResults.length > 0) {
      session.updateChecklist(vlm.detectionResults);

      // Haptic feedback on successful detection
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  }, [vlm.detectionResults]);

  // Update offline queue count
  useEffect(() => {
    const updateQueueCount = async () => {
      const pending = await offlineQueue.getPending();
      setQueueCount(pending.length);
    };

    updateQueueCount();
    const interval = setInterval(updateQueueCount, 5000);

    return () => clearInterval(interval);
  }, []);

  // Play success audio beep
  const playSuccessBeep = () => {
    if (typeof window === 'undefined' || !window.AudioContext) return;

    try {
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.frequency.value = 800; // 800Hz
      gainNode.gain.value = 0.5; // 50% volume
      oscillator.type = 'sine';

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 100); // 100ms duration
    } catch (error) {
      console.warn('[Audio] Failed to play beep:', error);
    }
  };

  // Handle verification completion
  const handleComplete = async () => {
    if (!session.isComplete) {
      setShowFailureAnimation(true);
      setTimeout(() => setShowFailureAnimation(false), 500);
      return;
    }

    if (session.mode === 'camera' && videoRef.current) {
      // Capture final photo
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const success = await session.completeSession(imageData, vlm.detectionResults);

        if (success) {
          // Success feedback
          setShowSuccessAnimation(true);
          playSuccessBeep();
          if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
          setTimeout(() => setShowSuccessAnimation(false), 1000);
        } else {
          // Queued for offline sync
          setShowSuccessAnimation(true);
          setTimeout(() => setShowSuccessAnimation(false), 1000);
        }
      }
    } else {
      // Manual mode - no photo
      const emptyImageData = new ImageData(1, 1);
      const success = await session.completeSession(emptyImageData, []);

      if (success) {
        setShowSuccessAnimation(true);
        playSuccessBeep();
        if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
        setTimeout(() => setShowSuccessAnimation(false), 1000);
      } else {
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 1000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Equipment Verification</h1>
        <p className="text-sm text-gray-600">Job ID: {jobId}</p>
      </div>

      {/* Offline Queue Status */}
      <OfflineQueueStatus
        queueCount={queueCount}
        isOnline={offlineQueue.getIsOnline()}
      />

      {/* Camera Mode */}
      {session.mode === 'camera' && videoStream && (
        <div className="space-y-4">
          {/* Camera Feed with Detection Overlay */}
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video bg-black rounded-lg"
            />
            <DetectionOverlay
              detectedItems={vlm.detectionResults}
              videoWidth={videoRef.current?.videoWidth || 0}
              videoHeight={videoRef.current?.videoHeight || 0}
            />
          </div>

          {/* Detection Status */}
          <div className="bg-white rounded-lg shadow-md p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">VLM Detection:</span>
              <span className={vlm.isProcessing ? 'text-blue-600 animate-pulse' : 'text-green-600'}>
                {vlm.isProcessing ? 'Analyzing...' : 'Ready'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Actual FPS:</span>
              <span className="text-gray-900 font-medium">
                {vlm.actualFps.toFixed(2)} fps
              </span>
            </div>

            {vlm.rateLimitStats && (
              <div className="pt-2 border-t border-gray-200 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Today:</span>
                  <span className="text-gray-700">
                    {vlm.rateLimitStats.dailyCount}/{vlm.rateLimitStats.dailyLimit} requests
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Cost:</span>
                  <span className="text-gray-700">
                    ${vlm.rateLimitStats.estimatedDailyCost.toFixed(2)}/day
                  </span>
                </div>
                {vlm.rateLimitStats.remainingToday < 20 && (
                  <div className="text-xs text-yellow-700 font-medium">
                    ⚠️ {vlm.rateLimitStats.remainingToday} requests remaining
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Equipment Checklist */}
          <EquipmentChecklist
            checklist={session.checklist}
            detectedItems={vlm.detectionResults}
            mode="camera"
          />
        </div>
      )}

      {/* Manual Mode */}
      {session.mode === 'manual' && (
        <div className="space-y-4">
          <ManualChecklistFallback
            checklist={session.checklist}
            onToggleItem={session.toggleItemVerified}
          />
        </div>
      )}

      {/* Complete Button */}
      <div className="mt-6">
        <button
          onClick={handleComplete}
          disabled={!session.isComplete || session.status === 'processing'}
          className="w-full py-4 bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
        >
          {session.status === 'processing' ? 'Saving...' : 'Complete Verification'}
        </button>
      </div>

      {/* Error Display */}
      {(session.error || camera.error || vlm.error) && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            {session.error || camera.error || vlm.error}
          </p>
        </div>
      )}

      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 animate-fade-in">
          <div className="bg-white rounded-full p-8 animate-scale-in">
            <svg
              className="w-24 h-24 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Failure Animation Overlay */}
      {showFailureAnimation && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 animate-shake">
          <div className="bg-white rounded-full p-8">
            <svg
              className="w-24 h-24 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0.5);
          }
          to {
            transform: scale(1);
          }
        }

        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-10px);
          }
          75% {
            transform: translateX(10px);
          }
        }

        .animate-fade-in {
          animation: fade-in 300ms ease-out;
        }

        .animate-scale-in {
          animation: scale-in 300ms ease-out;
        }

        .animate-shake {
          animation: shake 200ms ease-in-out;
        }
      `}</style>
    </div>
  );
}

/**
 * Loading fallback component
 */
function EquipmentVerificationLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Equipment Verification</h1>
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow-md p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main export wrapped with Suspense boundary
 */
export default function EquipmentVerificationPage() {
  return (
    <Suspense fallback={<EquipmentVerificationLoading />}>
      <EquipmentVerificationContent />
    </Suspense>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type ChecklistStatus = 'pending' | 'loaded' | 'verified' | 'missing';
type ChecklistAutoStatus = ChecklistStatus | 'wrong_container' | 'low_confidence';

interface ChecklistItemView {
  id: string;
  itemName: string;
  itemType: 'equipment' | 'material';
  quantity: number;
  status: ChecklistStatus;
  autoStatus?: ChecklistAutoStatus | null;
  autoConfidence?: number | null;
  containerName?: string | null;
  manualOverrideStatus?: ChecklistStatus | null;
  manualOverrideReason?: string | null;
}

interface ReconciliationUpdate {
  checklistItemId: string;
  autoStatus: ChecklistAutoStatus;
  confidence: number | null;
  finalStatus: ChecklistStatus;
  manualOverrideApplied: boolean;
}

const overrideOptions: Array<{ value: ChecklistStatus | 'clear'; label: string }> = [
  { value: 'clear', label: 'No override' },
  { value: 'pending', label: 'Mark Pending' },
  { value: 'loaded', label: 'Mark Loaded' },
  { value: 'verified', label: 'Mark Verified' },
  { value: 'missing', label: 'Mark Missing' },
];

export default function LoadCapturePage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItemView[]>([]);

  useEffect(() => {
    if (!jobId) return;

    const fetchInitialState = async () => {
      try {
        const response = await fetch(`/api/vision/load-verifications?jobId=${jobId}`);
        if (!response.ok) {
          throw new Error('Failed to load checklist state');
        }
        const data = await response.json();
        setChecklistItems(data.checklistItems || []);
      } catch (error) {
        console.error(error);
        setErrorMessage('Unable to load checklist for this job.');
      }
    };

    fetchInitialState();
  }, [jobId]);

  useEffect(() => {
    const initialiseStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setMediaStream(stream);
      } catch (error) {
        console.error('Failed to access camera', error);
        setErrorMessage('Camera access denied. Please enable camera permissions.');
      }
    };

    initialiseStream();

    return () => {
      setIsCapturing(false);
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isCapturing || !jobId) return;

    const interval = window.setInterval(() => {
      captureFrame();
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCapturing, jobId]);

  const mergeReconciliation = useCallback((updates: ReconciliationUpdate[]) => {
    setChecklistItems(prevItems =>
      prevItems.map(item => {
        const update = updates.find(u => u.checklistItemId === item.id);
        if (!update) return item;

        return {
          ...item,
          autoStatus: update.autoStatus,
          autoConfidence: update.confidence,
          status: update.finalStatus,
        };
      })
    );
  }, []);

  const captureFrame = useCallback(async () => {
    if (!jobId || isUploading) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

    try {
      setIsUploading(true);
      const response = await fetch('/api/vision/load-verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          imageBase64: dataUrl,
          frameIndex,
          frameTimestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      if (result.reconciliation?.updatedItems) {
        mergeReconciliation(result.reconciliation.updatedItems as ReconciliationUpdate[]);
      }

      setStatusMessage(`Frame ${frameIndex + 1} processed`);
      setErrorMessage(null);
      setFrameIndex(prev => prev + 1);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to process frame. Please check your connection.');
    } finally {
      setIsUploading(false);
    }
  }, [frameIndex, isUploading, jobId, mergeReconciliation]);

  const toggleCapture = () => {
    if (!mediaStream) {
      setErrorMessage('Camera not available.');
      return;
    }
    setIsCapturing(prev => !prev);
  };

  const handleManualOverride = async (itemId: string, status: ChecklistStatus | 'clear') => {
    try {
      const reason = status !== 'clear' ? window.prompt('Provide a reason for this override (optional):') ?? '' : null;
      const response = await fetch('/api/vision/load-verifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checklistItemId: itemId,
          manualOverrideStatus: status,
          manualOverrideReason: reason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply override');
      }

      const data = await response.json();
      const updated = data.checklistItem as ChecklistItemView;

      setChecklistItems(prevItems =>
        prevItems.map(item => (item.id === updated.id ? { ...item, ...updated } : item))
      );

      setStatusMessage('Manual override applied.');
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to apply manual override.');
    }
  };

  const renderStatusBadge = (item: ChecklistItemView) => {
    const status = item.manualOverrideStatus || item.status;
    const mismatch = item.autoStatus === 'wrong_container' || item.autoStatus === 'low_confidence';

    const baseClass =
      status === 'verified'
        ? 'bg-green-100 text-green-700'
        : status === 'missing'
        ? 'bg-red-100 text-red-700'
        : status === 'loaded'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-700';

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${baseClass}`}>
        {status}
        {mismatch ? ' ⚠️' : ''}
      </span>
    );
  };

  if (!jobId) {
    return (
      <div className="p-8">
        <p className="text-red-500">Missing job identifier.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Load Verification Capture</h1>
          <p className="text-sm text-slate-400">
            Job ID: <span className="font-mono">{jobId}</span>
          </p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-800">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-sm text-white">
                  Uploading frame…
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="flex items-center justify-between">
              <button
                onClick={toggleCapture}
                className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                  isCapturing ? 'bg-red-500 hover:bg-red-400' : 'bg-blue-500 hover:bg-blue-400'
                }`}
              >
                {isCapturing ? 'Stop Capture' : 'Start Capture'}
              </button>
              <div className="text-xs text-slate-400 space-x-4">
                <span>Frame #{frameIndex}</span>
                <span>{isCapturing ? '1 FPS streaming' : 'Paused'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4">Checklist Status</h2>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
              {checklistItems.map(item => (
                <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.itemName}</p>
                      <p className="text-xs text-slate-400">
                        {item.itemType} • Qty {item.quantity}
                        {item.containerName ? ` • ${item.containerName}` : ''}
                      </p>
                    </div>
                    {renderStatusBadge(item)}
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                    <span>Auto: {item.autoStatus ?? 'pending'}</span>
                    {typeof item.autoConfidence === 'number' && (
                      <span>Confidence: {(item.autoConfidence * 100).toFixed(0)}%</span>
                    )}
                    {item.manualOverrideStatus && <span>Override: {item.manualOverrideStatus}</span>}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <select
                      className="bg-slate-800 border border-slate-700 rounded-md text-xs px-2 py-1"
                      value={item.manualOverrideStatus ?? 'clear'}
                      onChange={event => handleManualOverride(item.id, event.target.value as ChecklistStatus | 'clear')}
                    >
                      {overrideOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {item.manualOverrideReason && (
                      <span className="text-[10px] text-amber-300">
                        Reason: {item.manualOverrideReason}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {checklistItems.length === 0 && (
                <div className="text-sm text-slate-500">No checklist items configured for this job.</div>
              )}
            </div>
          </div>
        </section>

        {(statusMessage || errorMessage) && (
          <div className="text-sm">
            {statusMessage && <p className="text-emerald-400">{statusMessage}</p>}
            {errorMessage && <p className="text-red-400">{errorMessage}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

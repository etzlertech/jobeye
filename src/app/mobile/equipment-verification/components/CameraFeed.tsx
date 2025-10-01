/**
 * @file CameraFeed.tsx
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose Camera video feed with photo capture
 * @complexity_budget 200
 */

'use client';

import { useEffect, useRef, useState } from 'react';

export interface CameraFeedProps {
  /** MediaStream from camera */
  stream: MediaStream | null;
  /** Callback when photo captured */
  onCapture: (photo: Blob) => void;
  /** Whether capture button is enabled */
  captureEnabled?: boolean;
}

/**
 * Camera video feed component with photo capture functionality
 */
export function CameraFeed({ stream, onCapture, captureEnabled = true }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);

  // Attach stream to video element
  useEffect(() => {
    if (!videoRef.current || !stream) {
      setIsStreamReady(false);
      return;
    }

    const video = videoRef.current;

    video.srcObject = stream;
    video.play().catch(err => {
      console.error('[CameraFeed] Failed to play video:', err);
    });

    const handleLoadedMetadata = () => {
      setIsStreamReady(true);
      console.log('[CameraFeed] Stream ready', {
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [stream]);

  // Capture photo from video frame
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isStreamReady) {
      console.error('[CameraFeed] Cannot capture - video not ready');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to match video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[CameraFeed] Failed to get canvas context');
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log('[CameraFeed] Photo captured', {
            size: blob.size,
            type: blob.type,
          });
          onCapture(blob);
        } else {
          console.error('[CameraFeed] Failed to create blob from canvas');
        }
      },
      'image/jpeg',
      0.8
    );
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading spinner */}
      {!isStreamReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-sm">Loading camera...</div>
        </div>
      )}

      {/* Capture button */}
      {isStreamReady && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <button
            onClick={capturePhoto}
            disabled={!captureEnabled}
            className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Capture photo"
          >
            <div className="w-full h-full rounded-full bg-blue-500 scale-75 transition-transform active:scale-50" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Get video element ref for external use (e.g., YOLO detection)
 */
export function getCameraVideoElement(cameraFeedRef: React.RefObject<HTMLVideoElement>): HTMLVideoElement | null {
  return cameraFeedRef.current;
}

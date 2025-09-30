/**
 * @file /src/domains/vision/components/CameraCapture.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose Camera capture component for kit verification
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface CameraCaptureProps {
  onCapture: (imageData: ImageData) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export default function CameraCapture({ onCapture, onError, className = '' }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (err: any) {
      const errorMsg = err.name === 'NotAllowedError'
        ? 'Camera access denied. Please enable camera permissions.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Failed to access camera: ${err.message}`;

      setError(errorMsg);
      if (onError) {
        onError(new Error(errorMsg));
      }
    }
  }, [facingMode, onError]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get ImageData from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    onCapture(imageData);
  }, [onCapture]);

  // Toggle camera facing mode (front/back)
  const toggleCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className={`camera-capture ${className}`}>
      <div className="camera-preview relative rounded-lg overflow-hidden bg-gray-900">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />

        {!isStreaming && !error && (
          <div className="flex items-center justify-center min-h-[400px] bg-gray-800">
            <p className="text-gray-400">Camera not started</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center min-h-[400px] bg-red-900/20">
            <div className="text-center p-4">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Hidden canvas for capturing images */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera controls overlay */}
        {isStreaming && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              onClick={toggleCamera}
              className="px-4 py-2 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 backdrop-blur-sm"
              title="Switch Camera"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={capturePhoto}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Capture Photo
            </button>

            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 backdrop-blur-sm"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Control buttons when camera is off */}
      {!isStreaming && !error && (
        <div className="mt-4">
          <button
            onClick={startCamera}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Start Camera
          </button>
        </div>
      )}
    </div>
  );
}
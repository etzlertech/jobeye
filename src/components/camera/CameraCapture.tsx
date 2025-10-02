/**
 * @file /src/components/camera/CameraCapture.tsx
 * @purpose Camera capture component with 1fps throttling for intent recognition
 * @phase 3
 * @domain UI Components
 * @complexity_budget 300
 * @test_coverage 80%
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, Loader } from 'lucide-react';

export interface CameraCaptureProps {
  onCapture: (imageBlob: Blob, imageUrl: string) => void;
  onIntentDetected?: (intent: string, confidence: number) => void;
  maxFps?: number;
  className?: string;
}

export function CameraCapture({
  onCapture,
  onIntentDetected,
  maxFps = 1,
  className = ''
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);

  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Calculate frame interval from FPS
  const frameInterval = 1000 / maxFps;

  /**
   * Start camera stream
   */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setHasPermission(true);
        setIsActive(true);
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      setHasPermission(false);
    }
  }, []);

  /**
   * Stop camera stream
   */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsActive(false);
    setIsCapturing(false);
  }, []);

  /**
   * Capture frame from video stream
   */
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage(imageUrl);
          onCapture(blob, imageUrl);
        }
      },
      'image/jpeg',
      0.9
    );
  }, [isCapturing, onCapture]);

  /**
   * Frame capture loop with FPS throttling
   */
  const captureLoop = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastCaptureTimeRef.current;

    if (elapsed > frameInterval) {
      captureFrame();
      lastCaptureTimeRef.current = now - (elapsed % frameInterval);
    }

    if (isCapturing) {
      animationFrameRef.current = requestAnimationFrame(captureLoop);
    }
  }, [captureFrame, frameInterval, isCapturing]);

  /**
   * Start continuous capture
   */
  const startCapture = useCallback(() => {
    setIsCapturing(true);
    setCapturedImage(null);
    lastCaptureTimeRef.current = Date.now();
    captureLoop();
  }, [captureLoop]);

  /**
   * Stop continuous capture
   */
  const stopCapture = useCallback(() => {
    setIsCapturing(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * Handle single capture
   */
  const handleSingleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage(imageUrl);
          onCapture(blob, imageUrl);
          stopCamera();
        }
      },
      'image/jpeg',
      0.9
    );
  }, [onCapture, stopCamera]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  }, [stopCamera, capturedImage]);

  // UI States
  if (hasPermission === false) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">Camera access is required</p>
        <button
          onClick={startCamera}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Grant Access
        </button>
      </div>
    );
  }

  if (capturedImage && !isActive) {
    return (
      <div className={`relative ${className}`}>
        <img
          src={capturedImage}
          alt="Captured"
          className="w-full h-full object-cover rounded-lg"
        />
        <button
          onClick={() => {
            setCapturedImage(null);
            startCamera();
          }}
          className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ display: isActive ? 'block' : 'none' }}
      />

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Controls Overlay */}
      {!isActive ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={startCamera}
            className="flex flex-col items-center p-8 bg-white rounded-lg shadow-xl"
          >
            <Camera className="w-16 h-16 text-emerald-600 mb-2" />
            <span className="text-gray-700">Start Camera</span>
          </button>
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-center gap-4">
            {/* Single Capture Button */}
            <button
              onClick={handleSingleCapture}
              className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100"
            >
              <Camera className="w-6 h-6 text-gray-800" />
            </button>

            {/* Continuous Capture Toggle */}
            <button
              onClick={isCapturing ? stopCapture : startCapture}
              className={`p-4 rounded-full shadow-lg ${
                isCapturing
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
            >
              {isCapturing ? (
                <Loader className="w-6 h-6 text-white animate-spin" />
              ) : (
                <CheckCircle className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={stopCamera}
              className="p-4 bg-gray-800 rounded-full shadow-lg hover:bg-gray-700"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* FPS Indicator */}
          {isCapturing && (
            <div className="text-center mt-2">
              <span className="text-white text-sm">
                Capturing at {maxFps} FPS
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
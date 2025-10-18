/**
 * @file /src/components/camera/SimpleCameraCapture.tsx
 * @purpose Lightweight reusable camera capture component for mobile workflows
 * @domain camera
 * @phase 3
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';

export interface SimpleCameraCaptureResult {
  imageUrl: string;
  blob: Blob;
}

export interface SimpleCameraCaptureProps {
  onCapture: (result: SimpleCameraCaptureResult) => void;
  onCancel: () => void;
  facingMode?: 'environment' | 'user';
  className?: string;
}

const decodeBase64 = (value: string): string => {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(value);
  }

  if (typeof globalThis !== 'undefined') {
    const globalAtob = (globalThis as { atob?: (data: string) => string }).atob;
    if (typeof globalAtob === 'function') {
      return globalAtob(value);
    }
  }

  throw new Error('Base64 decoding is not supported in this environment');
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = decodeBase64(base64);
  const len = binary.length;
  const buffer = new Uint8Array(len);

  for (let i = 0; i < len; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }

  return new Blob([buffer], { type: mime });
};

export function SimpleCameraCapture({
  onCapture,
  onCancel,
  facingMode = 'environment',
  className = ''
}: SimpleCameraCaptureProps) {
  const [isBusy, setIsBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
      onCancel();
    }
  }, [facingMode, onCancel]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsBusy(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (!context) return;
    context.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const blob = dataUrlToBlob(dataUrl);
    onCapture({ imageUrl: dataUrl, blob });
    setIsBusy(false);
  };

  return (
    <div className={`flex-1 flex flex-col bg-black ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 text-white">
        <button
          type="button"
          onClick={() => {
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
              streamRef.current = null;
            }
            onCancel();
          }}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <span className="text-sm text-gray-400">Camera Preview</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain bg-black"
        />
      </div>

      <div className="p-4 flex items-center justify-center gap-4 bg-black border-t border-gray-800">
        <button
          type="button"
          onClick={handleCapture}
          disabled={isBusy}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-golden text-black font-semibold disabled:opacity-60"
        >
          {isBusy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" />
              Capture
            </>
          )}
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default SimpleCameraCapture;

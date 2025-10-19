// --- AGENT DIRECTIVE BLOCK ---
// file: /src/components/tasks/TaskImageUpload.tsx
// phase: 3.4
// domain: tasks
// purpose: Reusable image capture/upload component for workflow tasks and templates
// spec_ref: specs/013-lets-plan-to/spec.md
// version: 2025-10-20
// complexity_budget: 300 LoC
// offline_capability: PARTIAL
//
// dependencies:
//   internal:
//     - /src/utils/image-processor
//   external:
//     - lucide-react: ^0.426.0
//
// exports:
//   - TaskImageUpload: component - Capture/upload task images (thumbnail/medium/full)
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - src/__tests__/components/tasks/TaskImageUpload.test.tsx
//
// tasks:
//   1. Provide camera + file upload UX mirroring item image flow
//   2. Emit processed images for API consumption
//   3. Respect disabled/read-only state
// --- END DIRECTIVE BLOCK ---

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Check, Loader2 } from 'lucide-react';
import { imageProcessor, type ProcessedImages } from '@/utils/image-processor';

interface TaskImageUploadProps {
  onImageCapture: (images: ProcessedImages) => void;
  currentImageUrl?: string;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  onRemove?: () => void;
}

type Mode = 'preview' | 'camera' | 'upload';

export function TaskImageUpload({
  onImageCapture,
  currentImageUrl,
  disabled = false,
  label = 'Task Image',
  helperText = 'Capture a new photo or upload one from your device. JPEG/PNG only.',
  onRemove,
}: TaskImageUploadProps) {
  const [mode, setMode] = useState<Mode>('preview');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (mode === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [mode]);

  useEffect(() => {
    setPreviewUrl(currentImageUrl ?? null);
  }, [currentImageUrl]);

  const startCamera = useCallback(async () => {
    if (disabled) return;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Camera API is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;
      setMode('camera');
    } catch (error) {
      console.error('Camera access error:', error);
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            alert('Camera access denied. Please allow camera permissions and try again.');
            break;
          case 'NotFoundError':
            alert('No camera found on this device.');
            break;
          default:
            alert(`Camera error: ${error.message}`);
        }
      } else {
        alert('Unable to access camera. Please check permissions.');
      }
    }
  }, [disabled]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setMode('preview');
  }, []);

  const processAndEmit = useCallback(
    async (source: string | Blob | File) => {
      setIsProcessing(true);
      try {
        const processedImages = await imageProcessor.processImage(source);
        setPreviewUrl(processedImages.medium);
        onImageCapture(processedImages);
        setMode('preview');
      } catch (error) {
        console.error('Image processing error:', error);
        alert(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [onImageCapture]
  );

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const xOffset = (video.videoWidth - size) / 2;
    const yOffset = (video.videoHeight - size) / 2;

    canvas.width = 2048;
    canvas.height = 2048;

    ctx.drawImage(
      video,
      xOffset,
      yOffset,
      size,
      size,
      0,
      0,
      2048,
      2048
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 1);
    stopCamera();
    await processAndEmit(dataUrl);
  }, [processAndEmit, stopCamera]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }

      if (
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        file.name.toLowerCase().endsWith('.heic')
      ) {
        alert('HEIC/HEIF format is not supported. Please convert to JPEG or PNG.');
        return;
      }

      await processAndEmit(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processAndEmit]
  );

  const clearImage = useCallback(() => {
    setPreviewUrl(null);
    onRemove?.();
  }, [onRemove]);

  return (
    <div className="w-full">
      <label className="block text-lg font-semibold mb-2">{label}</label>
      <p className="text-sm text-gray-500 mb-4">{helperText}</p>

      {mode === 'preview' && (
        <div className="relative">
              {previewUrl ? (
                <div className="relative w-full max-w-sm mx-auto">
                  <img
                    src={previewUrl}
                    alt="Task preview"
                    className="w-full h-auto rounded-lg shadow-md"
                  />
                  {!disabled && onRemove && (
                    <button
                      type="button"
                      onClick={clearImage}
                      aria-label="Remove image"
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
            </div>
          ) : (
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={startCamera}
                disabled={disabled}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!disabled) setMode('upload');
                }}
                disabled={disabled}
                className="flex items-center gap-2 px-6 py-3 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5" />
                Upload File
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'camera' && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-w-sm mx-auto rounded-lg shadow-md"
          />

          <div className="flex justify-center gap-4 mt-4">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="flex items-center gap-2 px-6 py-3 border border-gray-400 text-gray-600 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <div className="flex flex-col items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            aria-label="Task image file input"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            Select Image
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Cancel
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

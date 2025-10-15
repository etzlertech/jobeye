'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Check, Loader2 } from 'lucide-react';
import { imageProcessor, type ProcessedImages } from '@/utils/image-processor';

interface ItemImageUploadProps {
  onImageCapture: (images: ProcessedImages) => void;
  currentImageUrl?: string;
  disabled?: boolean;
}

export function ItemImageUpload({ onImageCapture, currentImageUrl, disabled }: ItemImageUploadProps) {
  const [mode, setMode] = useState<'preview' | 'camera' | 'upload'>('preview');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Attach stream to video element when camera mode is activated
  useEffect(() => {
    if (mode === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      console.log('Stream attached to video element');
    }
  }, [mode]);

  // Start camera
  const startCamera = useCallback(async () => {
    console.log('Starting camera...');
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera API is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      
      console.log('Got camera stream:', stream);
      
      streamRef.current = stream;
      setMode('camera');
      console.log('Camera mode set, waiting for video element...');
    } catch (error) {
      console.error('Camera access error:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('Camera access denied. Please allow camera permissions and try again.');
        } else if (error.name === 'NotFoundError') {
          alert('No camera found on this device.');
        } else {
          alert(`Camera error: ${error.message}`);
        }
      } else {
        alert('Unable to access camera. Please check permissions.');
      }
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setMode('preview');
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) return;

      // Get the smaller dimension to create a square
      const size = Math.min(video.videoWidth, video.videoHeight);
      const xOffset = (video.videoWidth - size) / 2;
      const yOffset = (video.videoHeight - size) / 2;

      // Set canvas to capture at high resolution (matching our largest size)
      canvas.width = 2048;
      canvas.height = 2048;

      // Draw cropped square image
      context.drawImage(
        video,
        xOffset, yOffset, size, size,  // Source (crop to square)
        0, 0, 2048, 2048               // Destination (high res for processing)
      );

      const imageDataUrl = canvas.toDataURL('image/jpeg', 1.0);
      console.log('Captured image data URL length:', imageDataUrl.length);
      
      // Process to create all three sizes
      console.log('Starting image processing...');
      const processedImages = await imageProcessor.processImage(imageDataUrl);
      console.log('Image processing complete:', {
        thumbnailLength: processedImages.thumbnail.length,
        mediumLength: processedImages.medium.length,
        fullLength: processedImages.full.length
      });
      
      setPreviewUrl(processedImages.medium);
      stopCamera();
      console.log('Calling onImageCapture callback...');
      onImageCapture(processedImages);
    } catch (error) {
      console.error('Error capturing photo:', error);
      alert(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [onImageCapture, stopCamera]);

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Check for HEIC/HEIF format
    if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
      alert('HEIC/HEIF format is not supported. Please convert to JPEG or PNG first. You can use online converters or export from Photos app as JPEG.');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('Processing file:', file.name, file.type, file.size);
      
      // Process to create all three sizes
      const processedImages = await imageProcessor.processImage(file);
      
      setPreviewUrl(processedImages.medium);
      setMode('preview');
      onImageCapture(processedImages);
    } catch (error) {
      console.error('Error processing image:', error);
      alert(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onImageCapture]);

  return (
    <div className="w-full">
      <label className="block text-lg font-semibold mb-2">Item Image</label>
      
      {mode === 'preview' && (
        <div className="relative">
          {previewUrl ? (
            <div className="relative w-full max-w-sm mx-auto">
              <img 
                src={previewUrl} 
                alt="Item preview" 
                className="w-full h-auto rounded-lg shadow-md"
              />
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  onImageCapture({ thumbnail: '', medium: '', full: '' });
                }}
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => {
                  console.log('Take Photo button clicked');
                  startCamera();
                }}
                disabled={disabled}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5" />
                Upload Image
              </button>
            </div>
          )}
          
          {!previewUrl && (
            <p className="text-sm text-gray-500 text-center mt-2">
              Supported formats: JPEG, PNG, GIF, WebP
            </p>
          )}
        </div>
      )}

      {mode === 'camera' && (
        <div className="relative w-full max-w-sm mx-auto">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            className="w-full rounded-lg shadow-md"
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              type="button"
              onClick={capturePhoto}
              className="bg-blue-500 text-white p-4 rounded-full hover:bg-blue-600 transition"
            >
              <Camera className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-red-500 text-white p-4 rounded-full hover:bg-red-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileUpload}
        className="hidden"
      />

      <canvas ref={canvasRef} className="hidden" />
      
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
            <p className="text-gray-700">Processing image...</p>
            <p className="text-sm text-gray-500">Creating optimized versions</p>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check } from 'lucide-react';

interface ItemImageUploadProps {
  onImageCapture: (imageDataUrl: string) => void;
  currentImageUrl?: string;
}

export default function ItemImageUpload({ onImageCapture, currentImageUrl }: ItemImageUploadProps) {
  const [mode, setMode] = useState<'preview' | 'camera' | 'upload'>('preview');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setMode('camera');
      }
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Unable to access camera. Please check permissions.');
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
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;

    // Get the smaller dimension to create a square
    const size = Math.min(video.videoWidth, video.videoHeight);
    const xOffset = (video.videoWidth - size) / 2;
    const yOffset = (video.videoHeight - size) / 2;

    // Set canvas to square
    canvas.width = 512;
    canvas.height = 512;

    // Draw cropped square image
    context.drawImage(
      video,
      xOffset, yOffset, size, size,  // Source (crop to square)
      0, 0, 512, 512                  // Destination (512x512)
    );

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreviewUrl(imageDataUrl);
    stopCamera();
    onImageCapture(imageDataUrl);
  }, [onImageCapture, stopCamera]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Get the smaller dimension to create a square
        const size = Math.min(img.width, img.height);
        const xOffset = (img.width - size) / 2;
        const yOffset = (img.height - size) / 2;

        // Set canvas to square
        canvas.width = 512;
        canvas.height = 512;

        // Draw cropped square image
        context.drawImage(
          img,
          xOffset, yOffset, size, size,  // Source (crop to square)
          0, 0, 512, 512                  // Destination (512x512)
        );

        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setPreviewUrl(imageDataUrl);
        setMode('preview');
        onImageCapture(imageDataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
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
                  onImageCapture('');
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
                onClick={startCamera}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
              >
                <Upload className="w-5 h-5" />
                Upload Image
              </button>
            </div>
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
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
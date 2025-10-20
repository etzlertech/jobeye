'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, ArrowLeft } from 'lucide-react';

interface SimpleCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageUrl: string, imageBlob: Blob) => void;
}

export function SimpleCameraModal({ isOpen, onClose, onCapture }: SimpleCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
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
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access denied. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to blob and pass to parent
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          onCapture(imageUrl, blob);
          stopCamera();
          onClose();
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleBack = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="camera-modal-overlay">
      {/* Camera Preview */}
      <div className="camera-preview-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
        />

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Error Message */}
        {error && (
          <div className="camera-error">
            <p>{error}</p>
            <button onClick={handleBack} className="error-back-btn">
              Go Back
            </button>
          </div>
        )}

        {/* Bottom Controls */}
        {isCameraReady && !error && (
          <div className="camera-controls">
            {/* Back Button - Bottom Left */}
            <button
              onClick={handleBack}
              className="camera-back-btn"
            >
              <ArrowLeft className="w-6 h-6" />
              <span>Back</span>
            </button>

            {/* Capture Button - Bottom Right */}
            <button
              onClick={handleCapture}
              className="camera-capture-btn"
            >
              <Camera className="w-8 h-8" />
              <span className="capture-label">CAPTURE</span>
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .camera-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #000;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .camera-preview-container {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 375px;
          margin: 0 auto;
          background: #000;
        }

        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-error {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          padding: 2rem;
          background: rgba(0, 0, 0, 0.9);
          border-radius: 1rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .camera-error p {
          color: #fca5a5;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }

        .error-back-btn {
          padding: 0.75rem 1.5rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
        }

        .camera-controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 2rem 1rem;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .camera-back-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.75rem;
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(10px);
        }

        .camera-back-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }

        .camera-capture-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1.5rem;
          background: #FFD700;
          border: 4px solid #FFC700;
          border-radius: 1rem;
          color: #000;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 8px 24px rgba(255, 215, 0, 0.4);
        }

        .camera-capture-btn:active {
          transform: scale(0.95);
          box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
        }

        .capture-label {
          font-size: 0.75rem;
          letter-spacing: 0.1em;
        }
      `}</style>
    </div>
  );
}

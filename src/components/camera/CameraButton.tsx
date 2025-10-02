/**
 * @file /src/components/camera/CameraButton.tsx
 * @purpose Simple camera button for quick capture
 * @phase 3
 * @domain UI Components
 * @complexity_budget 150
 * @test_coverage 80%
 */

'use client';

import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { CameraCapture } from './CameraCapture';

export interface CameraButtonProps {
  onCapture: (blob: Blob, url: string) => void;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CameraButton({
  onCapture,
  label = 'Take Photo',
  className = '',
  size = 'md'
}: CameraButtonProps) {
  const [showCamera, setShowCamera] = useState(false);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const handleCapture = (blob: Blob, url: string) => {
    onCapture(blob, url);
    setShowCamera(false);
  };

  if (showCamera) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <CameraCapture
          onCapture={handleCapture}
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowCamera(true)}
      className={`
        inline-flex items-center gap-2 
        bg-emerald-600 text-white 
        rounded-lg font-medium
        hover:bg-emerald-700 
        focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
        transition-colors
        ${sizeClasses[size]}
        ${className}
      `}
    >
      <Camera className="w-5 h-5" />
      {label}
    </button>
  );
}
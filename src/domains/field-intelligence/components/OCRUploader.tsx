/**
 * @file src/domains/field-intelligence/components/OCRUploader.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Document upload component with real-time OCR processing
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 */

'use client';

import { useState } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface ExtractedData {
  customerName?: string;
  propertyAddress?: string;
  phone?: string;
  email?: string;
  serviceType?: string;
  requestedDate?: string;
  notes?: string;
}

interface OCRResult {
  documentId: string;
  extractedData: ExtractedData;
  confidence: number;
  costUSD: number;
  processingTimeMs: number;
}

interface OCRUploaderProps {
  userId: string;
  onExtracted?: (data: ExtractedData) => void;
  onDocumentSaved?: (documentId: string) => void;
  className?: string;
}

/**
 * OCRUploader - Document upload with OCR processing
 *
 * Features:
 * - Drag & drop file upload
 * - Real-time OCR processing with GPT-4V
 * - Structured data extraction
 * - Photo preview
 * - Cost tracking
 *
 * @example
 * ```tsx
 * <OCRUploader
 *   userId={user.id}
 *   onExtracted={(data) => console.log('Extracted:', data)}
 *   onDocumentSaved={(id) => console.log('Document saved:', id)}
 * />
 * ```
 */
export function OCRUploader({
  userId,
  onExtracted,
  onDocumentSaved,
  className = '',
}: OCRUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setProcessing(true);
    setError(null);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(selectedFile);

      // Call OCR API
      const response = await fetch('/api/field-intelligence/intake/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          documentType: 'intake_request',
          imageBase64: base64,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'OCR processing failed');
      }

      const data = await response.json();

      const ocrResult: OCRResult = {
        documentId: data.data.documentId,
        extractedData: data.data.extractedData,
        confidence: data.data.confidence,
        costUSD: data.data.costUSD,
        processingTimeMs: data.data.processingTimeMs,
      };

      setResult(ocrResult);

      logger.info('OCR processing completed', {
        documentId: ocrResult.documentId,
        confidence: ocrResult.confidence,
        costUSD: ocrResult.costUSD,
        userId,
      });

      if (onExtracted) {
        onExtracted(ocrResult.extractedData);
      }

      if (onDocumentSaved) {
        onDocumentSaved(ocrResult.documentId);
      }
    } catch (err: any) {
      logger.error('OCR upload failed', { error: err });
      setError(err.message);
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(amount);
  };

  return (
    <div className={`ocr-uploader ${className}`}>
      {!selectedFile ? (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            id="ocr-file-input"
          />
          <label htmlFor="ocr-file-input" className="cursor-pointer">
            <div className="text-gray-600">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-3"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-lg font-medium mb-1">Drag & drop an image here</p>
              <p className="text-sm text-gray-500">or click to browse</p>
              <p className="text-xs text-gray-400 mt-2">Supports JPG, PNG (max 10MB)</p>
            </div>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          {previewUrl && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <img
                src={previewUrl}
                alt="Document preview"
                className="w-full h-auto max-h-96 object-contain bg-gray-50"
              />
            </div>
          )}

          {/* File Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Processing Status */}
          {processing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <p className="font-medium text-blue-900">Processing with OCR...</p>
                  <p className="text-sm text-blue-700">Extracting data from document</p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* OCR Result */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-green-900">✓ Data Extracted Successfully</p>
                <div className="text-xs text-green-700">
                  {result.confidence}% confidence • {formatCurrency(result.costUSD)} • {result.processingTimeMs}ms
                </div>
              </div>

              <div className="bg-white border border-green-200 rounded p-3 space-y-2 text-sm">
                {result.extractedData.customerName && (
                  <div>
                    <span className="font-medium text-gray-700">Customer:</span>{' '}
                    <span className="text-gray-900">{result.extractedData.customerName}</span>
                  </div>
                )}
                {result.extractedData.propertyAddress && (
                  <div>
                    <span className="font-medium text-gray-700">Address:</span>{' '}
                    <span className="text-gray-900">{result.extractedData.propertyAddress}</span>
                  </div>
                )}
                {result.extractedData.phone && (
                  <div>
                    <span className="font-medium text-gray-700">Phone:</span>{' '}
                    <span className="text-gray-900">{result.extractedData.phone}</span>
                  </div>
                )}
                {result.extractedData.email && (
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>{' '}
                    <span className="text-gray-900">{result.extractedData.email}</span>
                  </div>
                )}
                {result.extractedData.serviceType && (
                  <div>
                    <span className="font-medium text-gray-700">Service:</span>{' '}
                    <span className="text-gray-900">{result.extractedData.serviceType}</span>
                  </div>
                )}
                {result.extractedData.requestedDate && (
                  <div>
                    <span className="font-medium text-gray-700">Requested Date:</span>{' '}
                    <span className="text-gray-900">{result.extractedData.requestedDate}</span>
                  </div>
                )}
                {result.extractedData.notes && (
                  <div>
                    <span className="font-medium text-gray-700">Notes:</span>{' '}
                    <span className="text-gray-900">{result.extractedData.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Button */}
          {!result && (
            <button
              onClick={handleUploadAndProcess}
              disabled={uploading || processing}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Upload & Process with OCR'}
            </button>
          )}

          {/* Upload Another */}
          {result && (
            <button
              onClick={handleReset}
              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
            >
              Upload Another Document
            </button>
          )}
        </div>
      )}
    </div>
  );
}
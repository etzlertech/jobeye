/**
 * @file src/domains/field-intelligence/components/CompletionVerifier.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Job completion verification with AI photo validation
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 250 LoC
 */

'use client';

import { useState } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface PhotoProof {
  photoUrl: string;
  description?: string;
}

interface VerificationResult {
  verificationId: string;
  verified: boolean;
  confidence: number;
  qualityScore: number;
  issues: string[];
  suggestions: string[];
}

interface CompletionVerifierProps {
  jobId: string;
  userId: string;
  onVerified?: (result: VerificationResult) => void;
  className?: string;
}

/**
 * CompletionVerifier - AI-powered job completion verification
 *
 * Features:
 * - Multi-photo upload
 * - AI quality scoring
 * - Issue detection
 * - Supervisor notifications
 * - Verification status display
 *
 * @example
 * ```tsx
 * <CompletionVerifier
 *   jobId={job.id}
 *   userId={user.id}
 *   onVerified={(result) => console.log('Verified:', result)}
 * />
 * ```
 */
export function CompletionVerifier({
  jobId,
  userId,
  onVerified,
  className = '',
}: CompletionVerifierProps) {
  const [photos, setPhotos] = useState<PhotoProof[]>([]);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const newPhotos: PhotoProof[] = [];

      for (const file of Array.from(files)) {
        // Convert to base64 for preview
        const base64 = await fileToBase64(file);
        newPhotos.push({
          photoUrl: base64,
          description: file.name,
        });
      }

      setPhotos((prev) => [...prev, ...newPhotos]);
      logger.info('Photos uploaded', { count: newPhotos.length, jobId });
    } catch (err: any) {
      logger.error('Failed to upload photos', { error: err });
      setError('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleVerify = async () => {
    if (photos.length === 0) {
      setError('Please upload at least one photo');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const response = await fetch(
        '/api/field-intelligence/workflows/verify-completion',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            userId,
            photos: photos.map((p) => p.photoUrl),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      const data = await response.json();

      const verificationResult: VerificationResult = {
        verificationId: data.data.verificationId,
        verified: data.data.verified,
        confidence: data.data.confidence,
        qualityScore: data.data.qualityScore,
        issues: data.data.issues || [],
        suggestions: data.data.suggestions || [],
      };

      setResult(verificationResult);

      logger.info('Completion verified', {
        verificationId: verificationResult.verificationId,
        verified: verificationResult.verified,
        qualityScore: verificationResult.qualityScore,
      });

      if (onVerified) {
        onVerified(verificationResult);
      }
    } catch (err: any) {
      logger.error('Verification failed', { error: err });
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className={`completion-verifier ${className}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Completion Verification</h3>

        {/* Photo Upload */}
        {!result && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Completion Photos *
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-gray-400 block"
            >
              <span className="text-sm text-gray-600">
                {uploading ? 'Uploading...' : 'Click to upload photos'}
              </span>
            </label>
          </div>
        )}

        {/* Photo Grid */}
        {photos.length > 0 && !result && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img
                  src={photo.photoUrl}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border border-gray-300"
                />
                <button
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Verify Button */}
        {!result && photos.length > 0 && (
          <button
            onClick={handleVerify}
            disabled={verifying || uploading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? 'Verifying with AI...' : `Verify Completion (${photos.length} photos)`}
          </button>
        )}

        {/* Verification Result */}
        {result && (
          <div className="space-y-3">
            {/* Overall Result */}
            <div
              className={`border-2 rounded-lg p-4 ${
                result.verified ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">{result.verified ? '✓' : '✗'}</div>
                <div className="flex-1">
                  <p className={`font-semibold text-lg ${result.verified ? 'text-green-800' : 'text-red-800'}`}>
                    {result.verified ? 'Job Verified' : 'Verification Failed'}
                  </p>
                  <p className={`text-sm ${result.verified ? 'text-green-700' : 'text-red-700'}`}>
                    Confidence: {result.confidence}%
                  </p>
                </div>
              </div>
            </div>

            {/* Quality Score */}
            <div className={`border rounded-lg p-3 ${getQualityColor(result.qualityScore)}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Quality Score</span>
                <span className="text-2xl font-bold">{result.qualityScore}/100</span>
              </div>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                <p className="font-medium text-yellow-900 mb-2">Issues Detected:</p>
                <ul className="space-y-1">
                  {result.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-yellow-800">
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                <p className="font-medium text-blue-900 mb-2">Suggestions:</p>
                <ul className="space-y-1">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-blue-800">
                      • {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Supervisor Notification */}
            {!result.verified && (
              <div className="bg-gray-50 border border-gray-300 rounded p-2 text-xs text-gray-700">
                📧 Supervisor has been notified for manual review
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
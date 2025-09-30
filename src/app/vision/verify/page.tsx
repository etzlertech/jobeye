/**
 * @file /src/app/vision/verify/page.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose Main kit verification page integrating camera, verification, and cost components
 * @complexity_budget 400
 * @test_coverage ≥80%
 */

'use client';

import { useState, useEffect } from 'react';
import CameraCapture from '@/domains/vision/components/CameraCapture';
import VerificationDisplay from '@/domains/vision/components/VerificationDisplay';
import CostDashboard from '@/domains/vision/components/CostDashboard';
import VerificationHistory from '@/domains/vision/components/VerificationHistory';
import BatchVerification from '@/domains/vision/components/BatchVerification';
import OfflineQueueStatus from '@/domains/vision/components/OfflineQueueStatus';
import { getOfflineQueue } from '@/domains/vision/lib/offline-queue';

interface VerificationResult {
  verificationId: string;
  verificationResult: 'complete' | 'incomplete' | 'failed';
  processingMethod: 'local_yolo' | 'cloud_vlm';
  confidenceScore: number;
  detectedItems: Array<{
    itemType: string;
    confidence: number;
    matchStatus: 'matched' | 'unmatched' | 'uncertain';
  }>;
  missingItems: string[];
  unexpectedItems: string[];
  costUsd: number;
  processingTimeMs: number;
}

export default function VerifyKitPage() {
  const [activeTab, setActiveTab] = useState<'verify' | 'batch' | 'queue' | 'history' | 'costs'>('verify');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Mock data - in production, these would come from auth/context
  const companyId = 'company-123';
  const kitId = 'kit-456';
  const expectedItems = ['wrench', 'hammer', 'screwdriver', 'pliers'];

  // Initialize offline queue and auto-sync
  useEffect(() => {
    const queue = getOfflineQueue();
    queue.startAutoSync(30000); // Sync every 30 seconds

    const checkOnline = () => {
      setIsOnline(queue.getIsOnline());
    };

    checkOnline();
    const interval = setInterval(checkOnline, 1000);

    return () => {
      clearInterval(interval);
      queue.stopAutoSync();
    };
  }, []);

  const handleCapture = async (imageData: ImageData) => {
    try {
      setIsProcessing(true);
      setError(null);
      setResult(null);

      // Check if offline - queue verification if needed
      if (!isOnline) {
        const queue = getOfflineQueue();
        await queue.enqueue({
          kitId,
          companyId,
          imageData,
          expectedItems,
          maxBudgetUsd: 10.0,
          maxRequestsPerDay: 100
        });

        setError('Network offline - verification queued for later');
        return;
      }

      // Call verification API
      const response = await fetch('/api/vision/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          kitId,
          companyId,
          imageData: Array.from(imageData.data), // Convert to array for JSON
          expectedItems,
          maxBudgetUsd: 10.0,
          maxRequestsPerDay: 100
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      const data = await response.json();
      setResult(data.data);
    } catch (err: any) {
      // Network error - queue for offline
      if (!navigator.onLine || err.message.includes('fetch')) {
        try {
          const queue = getOfflineQueue();
          await queue.enqueue({
            kitId,
            companyId,
            imageData,
            expectedItems,
            maxBudgetUsd: 10.0,
            maxRequestsPerDay: 100
          });
          setError('Network error - verification queued for later');
        } catch (queueError: any) {
          setError(`Failed to queue verification: ${queueError.message}`);
        }
      } else {
        setError(err.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Kit Verification</h1>
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-yellow-800">Offline Mode</span>
              </div>
            )}
          </div>
          <p className="text-gray-600">
            Use your camera to verify kit contents with AI-powered detection
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'verify'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Verify Kit
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'batch'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Batch Verify
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'queue'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Offline Queue
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('costs')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'costs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Costs & Budget
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'verify' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Camera */}
            <div>
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Capture Image</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Kit ID:</strong> {kitId}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Expected Items:</strong> {expectedItems.join(', ')}
                  </p>
                </div>
                <CameraCapture
                  onCapture={handleCapture}
                  onError={(err) => setError(err.message)}
                />
              </div>

              {isProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <p className="text-blue-800">Processing verification...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                  <button
                    onClick={handleReset}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {/* Right Column - Results */}
            <div>
              {result ? (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Verification Results</h2>
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      New Verification
                    </button>
                  </div>
                  <VerificationDisplay {...result} kitId={kitId} companyId={companyId} />
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-center py-12">
                    <svg
                      className="mx-auto h-16 w-16 text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <p className="text-gray-600">
                      Capture an image to start verification
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <BatchVerification companyId={companyId} />
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <OfflineQueueStatus />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <VerificationHistory companyId={companyId} kitId={kitId} />
          </div>
        )}

        {activeTab === 'costs' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <CostDashboard companyId={companyId} />
          </div>
        )}
      </div>
    </div>
  );
}
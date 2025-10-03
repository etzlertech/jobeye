/**
 * @file /src/domains/vision/components/VerificationHistory.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose List of historical verifications with filtering
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Verification {
  id: string;
  kit_id: string;
  verification_result: 'complete' | 'incomplete' | 'failed';
  processing_method: 'local_yolo' | 'cloud_vlm';
  confidence_score: number;
  processing_time_ms: number;
  verified_at: string;
}

interface VerificationHistoryProps {
  tenantId: string;
  kitId?: string;
  limit?: number;
  className?: string;
}

export default function VerificationHistory({
  tenantId,
  kitId,
  limit = 20,
  className = ''
}: VerificationHistoryProps) {
  const router = useRouter();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'complete' | 'incomplete' | 'failed'>('all');

  const fetchVerifications = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        tenantId,
        limit: limit.toString()
      });

      if (kitId) {
        params.append('kitId', kitId);
      }

      if (filter !== 'all') {
        params.append('verificationResult', filter);
      }

      const res = await fetch(`/api/vision/verifications?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch verifications');
      }

      const data = await res.json();
      setVerifications(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, [tenantId, kitId, filter, limit]);

  const handleViewDetails = (id: string) => {
    router.push(`/vision/verifications/${id}`);
  };

  const resultColors = {
    complete: 'text-green-700 bg-green-100',
    incomplete: 'text-yellow-700 bg-yellow-100',
    failed: 'text-red-700 bg-red-100'
  };

  const resultIcons = {
    complete: '✓',
    incomplete: '⚠',
    failed: '✗'
  };

  if (isLoading) {
    return (
      <div className={`verification-history ${className}`}>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`verification-history ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchVerifications}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`verification-history ${className}`}>
      {/* Header with Filters */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Verification History</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('complete')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'complete'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Complete
          </button>
          <button
            onClick={() => setFilter('incomplete')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'incomplete'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Incomplete
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Verification List */}
      {verifications.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No verifications found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map((verification) => (
            <div
              key={verification.id}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewDetails(verification.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${resultColors[verification.verification_result]}`}>
                    {resultIcons[verification.verification_result]} {verification.verification_result}
                  </span>
                  <div>
                    <p className="font-medium">Kit ID: {verification.kit_id}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(verification.verified_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-semibold">
                    {(verification.confidence_score * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {verification.processing_method === 'local_yolo' ? 'YOLO' : 'VLM'} · {verification.processing_time_ms}ms
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-4 text-center">
        <button
          onClick={fetchVerifications}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}
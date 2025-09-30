/**
 * @file src/domains/field-intelligence/components/LeadScoreCard.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Lead scoring visualization with factor breakdown
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 250 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface LeadScoreFactors {
  completenessScore: number;
  serviceValueScore: number;
  propertyTypeScore: number;
  urgencyScore: number;
  historicalScore: number;
}

interface LeadScoreData {
  requestId: string;
  totalScore: number;
  factors: LeadScoreFactors;
  recommendation: 'HIGH_PRIORITY' | 'MEDIUM_PRIORITY' | 'LOW_PRIORITY';
}

interface LeadScoreCardProps {
  requestId: string;
  className?: string;
}

/**
 * LeadScoreCard - Lead scoring visualization
 *
 * Features:
 * - Overall score display (0-100)
 * - Factor breakdown with weights
 * - Visual score indicator
 * - Priority recommendation
 * - Score explanation
 *
 * @example
 * ```tsx
 * <LeadScoreCard
 *   requestId={request.id}
 * />
 * ```
 */
export function LeadScoreCard({ requestId, className = '' }: LeadScoreCardProps) {
  const [scoreData, setScoreData] = useState<LeadScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeadScore();
  }, [requestId]);

  const fetchLeadScore = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/field-intelligence/intake/requests?requestId=${requestId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch lead score');
      }

      const data = await response.json();

      if (data.data && data.data.leadScore !== undefined) {
        // Extract score data from response
        const scoreData: LeadScoreData = {
          requestId,
          totalScore: data.data.leadScore || 0,
          factors: data.data.scoreFactors || {
            completenessScore: 0,
            serviceValueScore: 0,
            propertyTypeScore: 0,
            urgencyScore: 0,
            historicalScore: 0,
          },
          recommendation: getRecommendation(data.data.leadScore || 0),
        };
        setScoreData(scoreData);
      }
    } catch (err: any) {
      logger.error('Failed to fetch lead score', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendation = (score: number): LeadScoreData['recommendation'] => {
    if (score >= 70) return 'HIGH_PRIORITY';
    if (score >= 40) return 'MEDIUM_PRIORITY';
    return 'LOW_PRIORITY';
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-green-600';
    if (score >= 40) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getRecommendationBadge = (recommendation: LeadScoreData['recommendation']) => {
    switch (recommendation) {
      case 'HIGH_PRIORITY':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'MEDIUM_PRIORITY':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW_PRIORITY':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const getFactorLabel = (key: keyof LeadScoreFactors) => {
    switch (key) {
      case 'completenessScore':
        return 'Data Completeness';
      case 'serviceValueScore':
        return 'Service Value';
      case 'propertyTypeScore':
        return 'Property Type';
      case 'urgencyScore':
        return 'Urgency';
      case 'historicalScore':
        return 'Historical';
      default:
        return key;
    }
  };

  if (loading) {
    return (
      <div className={`lead-score-card ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`lead-score-card ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className={`lead-score-card ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-600 text-sm">No lead score available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`lead-score-card ${className}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Lead Score</h3>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${getRecommendationBadge(
              scoreData.recommendation
            )}`}
          >
            {scoreData.recommendation.replace('_', ' ')}
          </span>
        </div>

        {/* Overall Score */}
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <svg className="w-32 h-32 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#e5e7eb"
                strokeWidth="8"
                fill="none"
              />
              {/* Score circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(scoreData.totalScore / 100) * 352} 352`}
                className={getScoreColor(scoreData.totalScore)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className={`text-3xl font-bold ${getScoreColor(scoreData.totalScore)}`}>
                  {scoreData.totalScore}
                </p>
                <p className="text-xs text-gray-500">out of 100</p>
              </div>
            </div>
          </div>
        </div>

        {/* Factor Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Score Factors</h4>
          {Object.entries(scoreData.factors).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-700">{getFactorLabel(key as keyof LeadScoreFactors)}</span>
                <span className="font-medium text-gray-900">{value}/20</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getScoreBgColor(
                    (value / 20) * 100
                  )}`}
                  style={{ width: `${(value / 20) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Score Explanation */}
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700">
          <p className="font-medium mb-1">Score Breakdown:</p>
          <ul className="space-y-1 text-gray-600">
            <li>• Data Completeness: Contact info and details provided</li>
            <li>• Service Value: Estimated revenue potential</li>
            <li>• Property Type: Commercial vs residential scoring</li>
            <li>• Urgency: Requested timeline and priority</li>
            <li>• Historical: Past customer relationship value</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
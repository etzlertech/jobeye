/**
 * @file src/domains/field-intelligence/components/DuplicateWarning.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Duplicate request alert with match details
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

'use client';

interface DuplicateMatch {
  requestId: string;
  customerName: string;
  propertyAddress: string;
  phone?: string;
  email?: string;
  similarityScore: number;
  createdAt: string;
  status: string;
}

interface DuplicateWarningProps {
  matches: DuplicateMatch[];
  onViewRequest?: (requestId: string) => void;
  onProceedAnyway?: () => void;
  className?: string;
}

/**
 * DuplicateWarning - Alert for potential duplicate requests
 *
 * Features:
 * - Similarity score display
 * - Match details with contact info
 * - View original request link
 * - Proceed anyway option
 * - Color-coded severity
 *
 * @example
 * ```tsx
 * <DuplicateWarning
 *   matches={duplicateMatches}
 *   onViewRequest={(id) => router.push(`/requests/${id}`)}
 *   onProceedAnyway={() => setShowWarning(false)}
 * />
 * ```
 */
export function DuplicateWarning({
  matches,
  onViewRequest,
  onProceedAnyway,
  className = '',
}: DuplicateWarningProps) {
  const getSeverityLevel = (score: number) => {
    if (score >= 90) return 'CRITICAL';
    if (score >= 80) return 'HIGH';
    if (score >= 70) return 'MEDIUM';
    return 'LOW';
  };

  const getSeverityColor = (score: number) => {
    const severity = getSeverityLevel(score);
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-400 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 border-orange-400 text-orange-800';
      case 'MEDIUM':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'LOW':
        return 'bg-blue-100 border-blue-400 text-blue-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-red-600 bg-red-100';
    if (score >= 80) return 'text-orange-600 bg-orange-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-blue-600 bg-blue-100';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!matches || matches.length === 0) {
    return null;
  }

  const highestScore = Math.max(...matches.map((m) => m.similarityScore));
  const overallSeverity = getSeverityLevel(highestScore);

  return (
    <div className={`duplicate-warning ${className}`}>
      <div
        className={`border-2 rounded-lg p-4 ${getSeverityColor(highestScore)}`}
        role="alert"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 text-2xl">
            {overallSeverity === 'CRITICAL' || overallSeverity === 'HIGH' ? '🚨' : '⚠️'}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">
              {overallSeverity === 'CRITICAL'
                ? 'Critical: Duplicate Request Detected'
                : 'Potential Duplicate Request'}
            </h3>
            <p className="text-sm mt-1">
              Found {matches.length} similar {matches.length === 1 ? 'request' : 'requests'} in
              the system. Please review before proceeding.
            </p>
          </div>
        </div>

        {/* Matches List */}
        <div className="space-y-2 mb-3">
          {matches.map((match) => (
            <div
              key={match.requestId}
              className="bg-white border border-gray-300 rounded-lg p-3 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{match.customerName}</p>
                  <p className="text-sm text-gray-600">{match.propertyAddress}</p>
                  {match.phone && (
                    <p className="text-xs text-gray-500 mt-1">Phone: {match.phone}</p>
                  )}
                  {match.email && (
                    <p className="text-xs text-gray-500">Email: {match.email}</p>
                  )}
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(match.similarityScore)}`}>
                  {Math.round(match.similarityScore)}% match
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="text-gray-600">
                  <span className="font-medium">Created:</span> {formatDate(match.createdAt)}
                  {' • '}
                  <span className="font-medium">Status:</span>{' '}
                  <span className="capitalize">{match.status.toLowerCase()}</span>
                </div>
                {onViewRequest && (
                  <button
                    onClick={() => onViewRequest(match.requestId)}
                    className="text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    View Request
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Warning Message */}
        {overallSeverity === 'CRITICAL' && (
          <div className="bg-red-50 border border-red-300 rounded p-2 mb-3 text-xs text-red-800">
            <p className="font-medium">⚠️ High confidence duplicate detected!</p>
            <p className="mt-1">
              This appears to be a near-exact match of an existing request. Creating a duplicate
              may cause scheduling conflicts and customer confusion.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          {onProceedAnyway && (
            <button
              onClick={onProceedAnyway}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm font-medium"
            >
              Proceed Anyway
            </button>
          )}
          {onViewRequest && matches.length === 1 && (
            <button
              onClick={() => onViewRequest(matches[0].requestId)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            >
              Review Existing Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
/**
 * @file /src/domains/vision/components/VerificationDisplay.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose Display verification results with detected items
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

'use client';

import { useState, useEffect } from 'react';
import { getPDFExportService } from '../services/pdf-export.service';
import { getVoiceNarrationService } from '../services/voice-narration.service';

interface DetectedItem {
  itemType: string;
  confidence: number;
  matchStatus: 'matched' | 'unmatched' | 'uncertain';
}

interface VerificationDisplayProps {
  verificationId: string;
  verificationResult: 'complete' | 'incomplete' | 'failed';
  processingMethod: 'local_yolo' | 'cloud_vlm';
  confidenceScore: number;
  detectedItems: DetectedItem[];
  missingItems: string[];
  unexpectedItems: string[];
  costUsd: number;
  processingTimeMs: number;
  kitId?: string;
  companyId?: string;
  className?: string;
}

export default function VerificationDisplay({
  verificationId,
  verificationResult,
  processingMethod,
  confidenceScore,
  detectedItems,
  missingItems,
  unexpectedItems,
  costUsd,
  processingTimeMs,
  kitId = 'unknown',
  companyId = 'unknown',
  className = ''
}: VerificationDisplayProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const voiceService = getVoiceNarrationService();

  // Check voice support on mount
  useEffect(() => {
    setVoiceSupported(voiceService.isSupported());
  }, []);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdfService = getPDFExportService();
      const blob = await pdfService.generateReport(
        {
          verificationId,
          verificationResult,
          processingMethod,
          confidenceScore,
          detectedItems,
          missingItems,
          unexpectedItems,
          costUsd,
          processingTimeMs,
          kitId,
          companyId
        },
        {
          includeTimestamp: true,
          includeCompanyLogo: false
        }
      );

      const filename = `verification-${kitId}-${new Date().toISOString().split('T')[0]}.html`;
      pdfService.downloadPDF(blob, filename);
    } catch (error: any) {
      alert(`Failed to export PDF: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNarrate = async (full: boolean = true) => {
    if (!voiceSupported) {
      alert('Voice narration is not supported in your browser');
      return;
    }

    try {
      setIsNarrating(true);
      setIsPaused(false);

      const result = {
        verificationId,
        verificationResult,
        processingMethod,
        confidenceScore,
        detectedItems,
        missingItems,
        unexpectedItems,
        costUsd,
        processingTimeMs,
        kitId,
        companyId
      };

      if (full) {
        await voiceService.narrateResult(result);
      } else {
        await voiceService.narrateQuickSummary(result);
      }

    } catch (error: any) {
      console.error('Narration failed:', error);
    } finally {
      setIsNarrating(false);
      setIsPaused(false);
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      voiceService.resume();
      setIsPaused(false);
    } else {
      voiceService.pause();
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    voiceService.stop();
    setIsNarrating(false);
    setIsPaused(false);
  };

  // Result color coding
  const resultColors = {
    complete: 'text-green-600 bg-green-50 border-green-200',
    incomplete: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    failed: 'text-red-600 bg-red-50 border-red-200'
  };

  const resultIcons = {
    complete: '✓',
    incomplete: '⚠',
    failed: '✗'
  };

  // Match status colors
  const matchColors = {
    matched: 'bg-green-100 text-green-800',
    uncertain: 'bg-yellow-100 text-yellow-800',
    unmatched: 'bg-red-100 text-red-800'
  };

  return (
    <div className={`verification-display space-y-6 ${className}`}>
      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mb-4">
        {voiceSupported && !isNarrating && (
          <>
            <button
              onClick={() => handleNarrate(false)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              Quick Summary
            </button>
            <button
              onClick={() => handleNarrate(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              Full Narration
            </button>
          </>
        )}

        {isNarrating && (
          <>
            <button
              onClick={handlePauseResume}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium flex items-center gap-2"
            >
              {isPaused ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pause
                </>
              )}
            </button>
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop
            </button>
          </>
        )}

        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isExporting ? 'Exporting...' : 'Export Report'}
        </button>
      </div>

      {/* Overall Result */}
      <div className={`p-6 rounded-lg border-2 ${resultColors[verificationResult]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{resultIcons[verificationResult]}</span>
            <div>
              <h2 className="text-2xl font-bold capitalize">{verificationResult}</h2>
              <p className="text-sm opacity-75">
                Processed with {processingMethod === 'local_yolo' ? 'Local YOLO' : 'Cloud VLM'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{(confidenceScore * 100).toFixed(1)}%</div>
            <p className="text-sm opacity-75">Confidence</p>
          </div>
        </div>
      </div>

      {/* Processing Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Processing Time</p>
          <p className="text-lg font-semibold">{processingTimeMs}ms</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Cost</p>
          <p className="text-lg font-semibold">${costUsd.toFixed(4)}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Items Detected</p>
          <p className="text-lg font-semibold">{detectedItems.length}</p>
        </div>
      </div>

      {/* Detected Items */}
      {detectedItems.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Detected Items</h3>
          <div className="space-y-2">
            {detectedItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{item.itemType}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${matchColors[item.matchStatus]}`}>
                    {item.matchStatus}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{(item.confidence * 100).toFixed(1)}%</div>
                  <p className="text-xs text-gray-500">confidence</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing Items */}
      {missingItems.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-4">
            Missing Items ({missingItems.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {missingItems.map((item, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Unexpected Items */}
      {unexpectedItems.length > 0 && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-4">
            Unexpected Items ({unexpectedItems.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {unexpectedItems.map((item, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>Summary:</strong> Detected {detectedItems.filter(i => i.matchStatus === 'matched').length} matching items
          {missingItems.length > 0 && `, ${missingItems.length} missing`}
          {unexpectedItems.length > 0 && `, ${unexpectedItems.length} unexpected`}.
          {' '}Verification {verificationResult}.
        </p>
      </div>
    </div>
  );
}
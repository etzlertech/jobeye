/**
 * @file src/domains/safety/services/safety-verification.helpers.ts
 * @phase 3
 * @domain safety
 * @purpose Helper utilities for SafetyVerificationService.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T064
 * @complexity_budget 150 LoC
 * @dependencies
 *   internal:
 *     - ./safety-verification.types
 * @exports
 *   - matchDetectionsToChecklist
 *   - summarizeDetections
 *   - clampConfidence
 * @voice_considerations
 *   - Helpers surface matched/missing labels for voice feedback.
 * END AGENT DIRECTIVE BLOCK
 */

import type { SafetyChecklistItem, SafetyDetection } from './safety-verification.types';

export function matchDetectionsToChecklist(
  detections: SafetyDetection[],
  checklist: SafetyChecklistItem,
  confidenceThreshold: number
): {
  matched: SafetyDetection[];
  missing: string[];
  bestConfidence: number;
} {
  const required = new Set(checklist.requiredLabels.map((label) => label.toLowerCase()));
  const matched: SafetyDetection[] = [];

  for (const detection of detections) {
    const normalized = detection.label.toLowerCase();
    if (required.has(normalized) && detection.confidence >= confidenceThreshold) {
      matched.push(detection);
      required.delete(normalized);
    }
  }

  const missing = Array.from(required.values());
  const bestConfidence = matched.reduce(
    (max, detection) => (detection.confidence > max ? detection.confidence : max),
    0
  );

  return {
    matched,
    missing,
    bestConfidence,
  };
}

export function summarizeDetections(detections: SafetyDetection[]): string {
  return detections
    .slice(0, 5)
    .map((detection) => detection.label + ' (' + Math.round(detection.confidence * 100) + '%)')
    .join(', ');
}

export function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

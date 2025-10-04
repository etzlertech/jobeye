/**
 * @file src/__tests__/safety/safety-verification.service.test.ts
 * @description Unit tests for SafetyVerificationService verifying YOLO-only and fallback flows.
 * END AGENT DIRECTIVE BLOCK
 */

import { SafetyVerificationService } from '@/domains/safety/services/safety-verification.service';
import type {
  SafetyChecklistItem,
  SafetyVerificationDependencies,
  SafetyVerificationContext,
  SafetyVerificationResult,
} from '@/domains/safety/services/safety-verification.types';

const checklistItem: SafetyChecklistItem = {
  id: 'helmet-check',
  label: 'Helmet Worn',
  requiredLabels: ['helmet'],
  minimumConfidence: 0.6,
};

const photoBlob = new Blob(['fake-image'], { type: 'image/png' });

const createService = (
  overrides: Partial<SafetyVerificationDependencies> = {}
) => {
  const defaults: SafetyVerificationDependencies = {
    yoloClient: {
      detect: jest.fn(),
    },
    vlmClient: {
      evaluate: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    now: () => new Date('2025-10-05T18:00:00Z'),
    confidenceThreshold: 0.6,
    fallbackConfidenceThreshold: 0.75,
  };

  return new SafetyVerificationService({ ...defaults, ...overrides });
};

describe('SafetyVerificationService', () => {
  it('returns verified when YOLO meets requirements', async () => {
    const detectMock = jest.fn().mockResolvedValue({
      detections: [
        {
          label: 'helmet',
          confidence: 0.82,
        },
      ],
      processingTimeMs: 1200,
      modelVersion: 'mock-v1',
    });

    const service = createService({
      yoloClient: { detect: detectMock },
      vlmClient: { evaluate: jest.fn() },
    });

    const result = await service.verifyPhoto(photoBlob, checklistItem);

    expect(result.verified).toBe(true);
    expect(result.confidence).toBeCloseTo(0.82);
    expect(result.fallbackUsed).toBe(false);
    expect(detectMock).toHaveBeenCalledTimes(1);
  });

  it('uses fallback when YOLO confidence is low and returns verified if VLM approves', async () => {
    const detectMock = jest.fn().mockResolvedValue({
      detections: [
        {
          label: 'helmet',
          confidence: 0.4,
        },
      ],
      processingTimeMs: 900,
      modelVersion: 'mock-v1',
    });

    const vlmMock = jest.fn().mockResolvedValue({
      verified: true,
      confidence: 0.82,
      matchedLabels: ['helmet'],
      missingLabels: [],
      explanation: 'Detected helmet via fallback',
    });

    const service = createService({
      yoloClient: { detect: detectMock },
      vlmClient: { evaluate: vlmMock },
      fallbackConfidenceThreshold: 0.8,
    });

    const result = await service.verifyPhoto(photoBlob, checklistItem);

    expect(result.verified).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.confidence).toBeCloseTo(0.82);
    expect(vlmMock).toHaveBeenCalledTimes(1);
  });

  it('returns failure when both YOLO and VLM cannot verify', async () => {
    const detectMock = jest.fn().mockResolvedValue({
      detections: [
        {
          label: 'gloves',
          confidence: 0.55,
        },
      ],
      processingTimeMs: 1100,
      modelVersion: 'mock-v1',
    });

    const vlmMock = jest.fn().mockResolvedValue({
      verified: false,
      confidence: 0.5,
      matchedLabels: [],
      missingLabels: ['helmet'],
      explanation: 'No helmet detected',
    });

    const persistMock = jest.fn();

    const service = createService({
      yoloClient: { detect: detectMock },
      vlmClient: { evaluate: vlmMock },
      persistResult: persistMock,
    });

    const result = await service.verifyPhoto(photoBlob, checklistItem);

    expect(result.verified).toBe(false);
    expect(result.missingLabels).toContain('helmet');
    expect(result.fallbackUsed).toBe(true);
    expect(persistMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * @file src/__tests__/safety/integration/safety-verification.integration.test.ts
 * @description Integration-style tests for SafetyVerificationService persistence wiring.
 * END AGENT DIRECTIVE BLOCK
 */

import { SafetyVerificationService } from '@/domains/safety/services/safety-verification.service';
import type {
  SafetyVerificationDependencies,
  SafetyChecklistItem,
  SafetyVerificationContext,
} from '@/domains/safety/services/safety-verification.types';

const checklist: SafetyChecklistItem = {
  id: 'harness-check',
  label: 'Harness Latched',
  requiredLabels: ['harness'],
};

const photoBlob = new Blob(['fake-image'], { type: 'image/png' });

const baseDeps: SafetyVerificationDependencies = {
  yoloClient: {
    detect: jest.fn().mockResolvedValue({
      detections: [
        { label: 'harness', confidence: 0.55 },
      ],
      processingTimeMs: 800,
      modelVersion: 'mock',
    }),
  },
  vlmClient: {
    evaluate: jest.fn().mockResolvedValue({
      verified: true,
      confidence: 0.85,
      matchedLabels: ['harness'],
      missingLabels: [],
      explanation: 'Harness detected',
    }),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  now: () => new Date('2025-10-05T19:00:00Z'),
  confidenceThreshold: 0.6,
  fallbackConfidenceThreshold: 0.75,
};

describe('SafetyVerificationService integration', () => {
  it('calls custom persistResult with context payload', async () => {
    const persistMock = jest.fn();
    const service = new SafetyVerificationService({
      ...baseDeps,
      persistResult: persistMock,
    });

    const context: SafetyVerificationContext = {
      tenantId: 'tenant-123',
      jobId: 'job-456',
      checklistId: 'checklist-1',
      checklistItemId: checklist.id,
    };

    await service.verifyPhoto(photoBlob, checklist, context);

    expect(persistMock).toHaveBeenCalledTimes(1);
    const payload = persistMock.mock.calls[0][0];
    expect(payload.context).toMatchObject(context);
    expect(payload.result.verified).toBe(true);
    expect(payload.result.fallbackUsed).toBe(true);
    expect(payload.rawDetections.length).toBeGreaterThan(0);
  });
});

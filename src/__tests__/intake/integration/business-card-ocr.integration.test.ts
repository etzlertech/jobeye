/**
 * @file src/__tests__/intake/integration/business-card-ocr.integration.test.ts
 * @description Integration-style smoke tests validating BusinessCardOcrService persistence hook behaviour.
 * END AGENT DIRECTIVE BLOCK
 */

import {
  BusinessCardOcrService,
  BusinessCardOcrDependencies,
  BusinessCardContact,
  BusinessCardOcrPersistencePayload,
} from '@/domains/intake/services/business-card-ocr.service';

interface CapturePersist {
  calls: BusinessCardOcrPersistencePayload[];
}

describe('BusinessCardOcrService integration (persistence wiring)', () => {
  const createDeps = (): BusinessCardOcrDependencies & CapturePersist => {
    const calls: CapturePersist['calls'] = [];
    const deps: Partial<BusinessCardOcrDependencies> = {
      confidenceThreshold: 0.6,
      tesseractClient: {
        extractText: jest.fn(),
      },
      visionClient: {
        analyzeBusinessCard: jest.fn(),
      },
      persistResult: async (payload) => {
        calls.push(payload);
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      now: () => new Date('2025-10-05T13:00:00Z'),
    };

    return Object.assign(deps, { calls }) as BusinessCardOcrDependencies & CapturePersist;
  };

  it('persists high-confidence Tesseract results through the injected persistence callback', async () => {
    const deps = createDeps();
    deps.tesseractClient.extractText = jest.fn().mockResolvedValue({
      text: 'Sam Smith\nContoso LLC\n(555) 333-4444\nsam@contoso.com',
      confidence: 0.92,
    });

    const service = new BusinessCardOcrService(deps);
    const result = await service.extractContact(new Blob(['fake card data']));

    expect(result.source).toBe('tesseract');
    expect(result.fallbackUsed).toBe(false);
    expect(result.email).toBe('sam@contoso.com');

    expect(deps.calls).toHaveLength(1);
    expect(deps.calls[0]).toMatchObject({
      source: 'tesseract',
      result: expect.objectContaining({ email: 'sam@contoso.com' }),
      fallbackUsed: false,
    });
  });

  it('persists via extraction repository when tenant and session context are provided', async () => {
    const repoCreate = jest.fn().mockResolvedValue({ id: 'ext-123' });
    const deps = createDeps();
    delete deps.persistResult;
    deps.extractionRepository = { create: repoCreate } as any;
    deps.tesseractClient.extractText = jest.fn().mockResolvedValue({
      text: 'Taylor Swift\nSwift Services\n(555) 111-2222\ntaylor@swift.com',
      confidence: 0.88,
    });

    const service = new BusinessCardOcrService(deps);
    await service.extractContact(new Blob(['fake card data']), {
      tenantId: 'tenant-1',
      sessionId: 'session-42',
      processingTimeMs: 1234,
      costUsd: 0.12,
    });

    expect(repoCreate).toHaveBeenCalledTimes(1);
    expect(repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        session_id: 'session-42',
        extraction_type: 'contact',
        provider: 'tesseract',
        confidence_score: expect.any(Number),
      })
    );
  });

  it('persists fallback vision results when Tesseract confidence is insufficient', async () => {
    const deps = createDeps();
    deps.tesseractClient.extractText = jest.fn().mockResolvedValue({
      text: 'noisy text',
      confidence: 0.3,
    });
    deps.visionClient.analyzeBusinessCard = jest.fn().mockResolvedValue({
      name: 'Fallback Vision',
      company: 'Vision Co',
      phone: '+1 (555) 888-9900',
      email: 'vision@example.com',
      confidence: 0.8,
      rawText: 'Vision provided data',
    });

    const service = new BusinessCardOcrService(deps);
    const result = await service.extractContact(new Blob(['fake card data']));

    expect(result.source).toBe('vision');
    expect(result.fallbackUsed).toBe(true);
    expect(deps.calls).toHaveLength(1);
    expect(deps.calls[0]).toMatchObject({
      source: 'vision',
      result: expect.objectContaining({ email: 'vision@example.com' }),
      fallbackUsed: true,
    });
  });
});

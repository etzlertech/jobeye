/**
 * @file src/__tests__/intake/business-card-ocr.service.test.ts
 * @description Tests for BusinessCardOcrService covering Tesseract primary path and VLM fallback.
 * END AGENT DIRECTIVE BLOCK
 */

import { BusinessCardOcrService, BusinessCardOcrDependencies, BusinessCardOcrError } from '@/domains/intake/services/business-card-ocr.service';

describe('BusinessCardOcrService', () => {
  const createService = (deps: Partial<BusinessCardOcrDependencies> = {}) => {
    const defaults: BusinessCardOcrDependencies = {
      confidenceThreshold: 0.6,
      tesseractClient: {
        extractText: jest.fn(),
      },
      visionClient: {
        analyzeBusinessCard: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      now: () => new Date('2025-10-05T12:00:00Z'),
    };

    return new BusinessCardOcrService({ ...defaults, ...deps });
  };

  it('returns parsed contact when Tesseract confidence is above threshold', async () => {
    const tesseractMock = jest.fn().mockResolvedValue({
      text: 'Jane Doe\nAcme Corp\n555-987-6543\njane.doe@acme.com',
      confidence: 0.9,
    });

    const visionMock = jest.fn();

    const service = createService({
      tesseractClient: { extractText: tesseractMock },
      visionClient: { analyzeBusinessCard: visionMock },
    });

    const result = await service.extractContact(new Blob(['fake']));

    expect(result).toMatchObject({
      name: 'Jane Doe',
      company: 'Acme Corp',
      email: 'jane.doe@acme.com',
      phone: '+15559876543',
      confidence: expect.any(Number),
      source: 'tesseract',
      fallbackUsed: false,
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(visionMock).not.toHaveBeenCalled();
  });

  it('falls back to vision client when Tesseract confidence is low', async () => {
    const tesseractMock = jest.fn().mockResolvedValue({
      text: 'Unreadable text',
      confidence: 0.42,
    });

    const visionMock = jest.fn().mockResolvedValue({
      name: 'Fallback User',
      company: 'Fallback Inc',
      phone: '+15550102030',
      email: 'fallback@example.com',
      address: '123 Vision Way',
      confidence: 0.78,
    });

    const service = createService({
      tesseractClient: { extractText: tesseractMock },
      visionClient: { analyzeBusinessCard: visionMock },
    });

    const result = await service.extractContact(new Blob(['fake']));

    expect(visionMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      name: 'Fallback User',
      company: 'Fallback Inc',
      email: 'fallback@example.com',
      phone: '+15550102030',
      confidence: 0.78,
      source: 'vision',
      fallbackUsed: true,
    });
  });

  it('throws BusinessCardOcrError when both OCR stages fail', async () => {
    const tesseractMock = jest.fn().mockResolvedValue({
      text: 'blob',
      confidence: 0.2,
    });

    const visionMock = jest.fn().mockResolvedValue({ confidence: 0.3 });

    const service = createService({
      tesseractClient: { extractText: tesseractMock },
      visionClient: { analyzeBusinessCard: visionMock },
    });

    await expect(async () => {
      await service.extractContact(new Blob(['fake']));
    }).rejects.toBeInstanceOf(BusinessCardOcrError);

    expect(visionMock).toHaveBeenCalledTimes(1);
  });
});

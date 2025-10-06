/**
 * @file src/__tests__/safety/safety-verification.factory.test.ts
 * @description Tests for safety verification factory remote YOLO configuration.
 * END AGENT DIRECTIVE BLOCK
 */

import { Buffer } from 'node:buffer';
import { createDefaultSafetyVerificationDependencies } from '@/domains/safety/services/safety-verification.factory';
import { detectWithRemoteYolo } from '@/domains/vision/services/yolo-remote-client';
import { voiceLogger } from '@/core/logger/voice-logger';

jest.mock('@/domains/vision/services/yolo-inference.service', () => ({
  detectObjects: jest.fn().mockResolvedValue({
    data: {
      detections: [
        {
          label: 'vest',
          confidence: 0.82,
          bbox: { x: 1, y: 2, width: 3, height: 4 },
        },
      ],
      processingTimeMs: 256,
      modelVersion: 'local-mock',
    },
    error: null,
  }),
}));

jest.mock('@/domains/vision/services/yolo-remote-client', () => {
  const actual = jest.requireActual('@/domains/vision/services/yolo-remote-client');
  return {
    ...actual,
    detectWithRemoteYolo: jest.fn().mockResolvedValue({
      detections: [
        {
          label: 'helmet',
          confidence: 0.96,
          bbox: { x: 5, y: 6, width: 7, height: 8 },
        },
      ],
      processingTimeMs: 320,
      modelVersion: 'remote-yolo',
    }),
  };
});

const remoteDetectMock = detectWithRemoteYolo as jest.MockedFunction<typeof detectWithRemoteYolo>;

const createFakeBlob = (contents = 'image-data'): Blob => ({
  arrayBuffer: async () => Buffer.from(contents),
} as unknown as Blob);

describe('createDefaultSafetyVerificationDependencies', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses remote YOLO configuration when SAFETY_YOLO_ENDPOINT is defined', async () => {
    process.env.SAFETY_YOLO_ENDPOINT = 'https://yolo.example.com/infer';
    process.env.SAFETY_YOLO_API_KEY = 'token';
    process.env.SAFETY_YOLO_MODEL = 'remote-yolo';
    process.env.GOOGLE_API_KEY = 'fake-key';
    process.env.GOOGLE_VISION_MODEL = 'gemini-pro-1.5';

    const warnSpy = jest.spyOn(voiceLogger, 'warn').mockImplementation(() => undefined as any);

    const deps = createDefaultSafetyVerificationDependencies();
    const blob = createFakeBlob('image');
    await deps.yoloClient.detect(blob, { confidenceThreshold: 0.6 });

    expect(remoteDetectMock).toHaveBeenCalledTimes(1);
    const [, configArg, optionsArg] = remoteDetectMock.mock.calls[0]!;
    expect(configArg).toEqual(
      expect.objectContaining({
        endpoint: 'https://yolo.example.com/infer',
        apiKey: 'token',
        model: 'remote-yolo',
      })
    );
    expect(optionsArg).toEqual(expect.objectContaining({ confidenceThreshold: 0.6 }));
    const hasFallbackWarning = warnSpy.mock.calls.some(([message]) =>
      message === 'Safety verification using fallback YOLO stub. Configure SAFETY_YOLO_ENDPOINT for production-grade detection.'
    );
    expect(hasFallbackWarning).toBe(false);
  });

  it('falls back to local detector and logs warning when remote config missing', async () => {
    delete process.env.SAFETY_YOLO_ENDPOINT;

    const warnSpy = jest.spyOn(voiceLogger, 'warn').mockImplementation(() => undefined as any);

    const deps = createDefaultSafetyVerificationDependencies();
    const blob = createFakeBlob('image');
    const result = await deps.yoloClient.detect(blob);

    expect(remoteDetectMock).not.toHaveBeenCalled();
    expect(result.detections).toHaveLength(1);
    const hasFallbackWarning = warnSpy.mock.calls.some(([message]) =>
      message === 'Safety verification using fallback YOLO stub. Configure SAFETY_YOLO_ENDPOINT for production-grade detection.'
    );
    expect(hasFallbackWarning).toBe(true);
  });
});

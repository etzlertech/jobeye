/**
 * @file src/domains/vision/__tests__/vision-verification.service.remote.test.ts
 * @description Remote YOLO integration tests for VisionVerificationService.
 * END AGENT DIRECTIVE BLOCK
 */

import { voiceLogger } from '@/core/logger/voice-logger';
import { VisionVerificationService } from '@/domains/vision/services/vision-verification.service';
import { detectWithRemoteYolo, isRemoteYoloConfigured } from '@/domains/vision/services/yolo-remote-client';
import { imageDataToBlob } from '@/domains/vision/utils/image-data';
import { runYoloInference } from '@/domains/vision/lib/yolo-inference';

jest.mock('@/domains/vision/services/yolo-remote-client', () => ({
  detectWithRemoteYolo: jest.fn(),
  isRemoteYoloConfigured: jest.fn().mockReturnValue(true),
}));

jest.mock('@/domains/vision/utils/image-data', () => ({
  imageDataToBlob: jest.fn(),
}));

jest.mock('@/domains/vision/lib/yolo-inference', () => ({
  runYoloInference: jest.fn(),
}));

const remoteDetectMock = detectWithRemoteYolo as jest.MockedFunction<typeof detectWithRemoteYolo>;
const remoteConfiguredMock = isRemoteYoloConfigured as jest.MockedFunction<typeof isRemoteYoloConfigured>;
const imageDataToBlobMock = imageDataToBlob as jest.MockedFunction<typeof imageDataToBlob>;
const runYoloInferenceMock = runYoloInference as jest.MockedFunction<typeof runYoloInference>;

const fakeImageData = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray(16),
} as unknown as ImageData;

const createRepositoryStubs = () => ({
  verificationRepo: { create: jest.fn() } as any,
  detectedItemRepo: { createMany: jest.fn() } as any,
  costRecordRepo: {
    canMakeVlmRequest: jest
      .fn()
      .mockResolvedValue({ allowed: true, data: { allowed: true, remainingBudget: 10, remainingRequests: 5 } }),
    create: jest.fn(),
  } as any,
});

describe('VisionVerificationService - remote YOLO integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    remoteConfiguredMock.mockReturnValue(true);
  });

  it('prefers remote YOLO when configured and blob conversion succeeds', async () => {
    imageDataToBlobMock.mockResolvedValue(new Blob(['image']));
    remoteDetectMock.mockResolvedValue({
      detections: [
        {
          label: 'helmet',
          confidence: 0.94,
          bbox: { x: 10, y: 20, width: 30, height: 40 },
        },
      ],
      processingTimeMs: 150,
      modelVersion: 'remote-yolo-v1',
    });

    const service = new VisionVerificationService({
      yolo: { endpoint: 'https://yolo.example.com', model: 'remote-yolo-v1' },
      repositories: createRepositoryStubs(),
      logger: voiceLogger,
    });

    const result = await (service as any).runYoloDetection(fakeImageData);

    expect(remoteDetectMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('remote');
    expect(result.detections[0]?.class).toBe('helmet');
    expect(runYoloInferenceMock).not.toHaveBeenCalled();
  });

  it('falls back to local YOLO when remote pathway is unavailable', async () => {
    imageDataToBlobMock.mockResolvedValue(null);
    runYoloInferenceMock.mockResolvedValue({
      detections: [
        {
          itemType: 'vest',
          confidence: 0.81,
          boundingBox: { x: 1, y: 2, width: 3, height: 4 },
        },
      ],
      processingTimeMs: 90,
      inputWidth: 2,
      inputHeight: 2,
      modelInputSize: 640,
    });

    const service = new VisionVerificationService({
      yolo: { endpoint: 'https://yolo.example.com' },
      repositories: createRepositoryStubs(),
      logger: voiceLogger,
    });

    const result = await (service as any).runYoloDetection(fakeImageData);

    expect(remoteDetectMock).not.toHaveBeenCalled();
    expect(runYoloInferenceMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('local');
    expect(result.detections[0]?.class).toBe('vest');
  });
});

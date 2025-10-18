/**
 * @file src/domains/vision/__tests__/yolo-remote-client.test.ts
 * @description Unit tests for remote YOLO client configuration and request handling.
 * END AGENT DIRECTIVE BLOCK
 */

import { Buffer } from 'node:buffer';
import { detectWithRemoteYolo, isRemoteYoloConfigured } from '@/domains/vision/services/yolo-remote-client';
import { voiceLogger } from '@/core/logger/voice-logger';

const originalFetch = global.fetch;

const createFakeBlob = (contents = 'image-data'): Blob => ({
  arrayBuffer: async () => Buffer.from(contents),
} as unknown as Blob);

describe('yolo-remote-client', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (global as any).fetch = originalFetch;
  });

  it('detectWithRemoteYolo throws when endpoint is missing', async () => {
    await expect(
      detectWithRemoteYolo(createFakeBlob(), { endpoint: '' })
    ).rejects.toThrow('Remote YOLO endpoint not configured');
  });

  it('sends payload to configured endpoint and normalises response', async () => {
    const fetchMock = (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        detections: [
          {
            label: 'helmet',
            confidence: 0.92,
            bbox: { x: 10, y: 20, width: 30, height: 40 },
          },
        ],
        processingTimeMs: 512,
        modelVersion: 'remote-yolo-v1',
      }),
    });

    const blob = createFakeBlob('image-bytes');
    const config = {
      endpoint: 'https://yolo.example.com/infer',
      apiKey: 'secret-token',
      model: 'remote-yolo-v1',
    } as const;

    const result = await detectWithRemoteYolo(blob, config, {
      confidenceThreshold: 0.5,
      maxDetections: 10,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchArgs = fetchMock.mock.calls[0]![1]!;
    expect(fetchArgs.method).toBe('POST');
    expect(fetchArgs.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer secret-token',
    });

    const body = JSON.parse(fetchArgs.body as string);
    expect(typeof body.image_base64).toBe('string');
    expect(body.image_base64.length).toBeGreaterThan(0);
    expect(body.model).toBe('remote-yolo-v1');
    expect(body.maxDetections).toBe(10);
    expect(body.confidenceThreshold).toBe(0.5);

    expect(result.source).toBe('remote_yolo');
    expect(result.modelVersion).toBe('remote-yolo-v1');
    expect(result.provider).toBe('remote-yolo-v1');
    expect(result.processingTimeMs).toBe(512);
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0]).toEqual({
      itemType: 'helmet',
      confidence: 0.92,
      source: 'remote_yolo',
      provider: 'remote-yolo-v1',
      modelVersion: 'remote-yolo-v1',
      boundingBox: { x: 10, y: 20, width: 30, height: 40 },
    });
  });

  it('logs and rethrows when remote inference fails', async () => {
    const fetchMock = (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'failure',
    });

    const errorSpy = jest.spyOn(voiceLogger, 'error').mockImplementation(() => undefined as any);

    await expect(
      detectWithRemoteYolo(createFakeBlob('bytes'), {
        endpoint: 'https://broken.example.com',
      })
    ).rejects.toThrow('Remote YOLO request failed: 500 Server Error failure');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Remote YOLO inference failed', expect.any(Object));
  });

  it('isRemoteYoloConfigured identifies usable config', () => {
    expect(isRemoteYoloConfigured(undefined)).toBe(false);
    expect(isRemoteYoloConfigured({})).toBe(false);
    expect(
      isRemoteYoloConfigured({
        endpoint: 'https://yolo.example.com',
      })
    ).toBe(true);
  });
});

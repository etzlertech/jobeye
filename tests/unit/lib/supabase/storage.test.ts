import { uploadImagesToStorage, deleteImagesFromStorage } from '@/lib/supabase/storage';
import type { ProcessedImages } from '@/utils/image-processor';

const createSupabaseStorageMock = () => {
  const uploadMock = jest.fn();
  const getPublicUrlMock = jest.fn();
  const removeMock = jest.fn();
  const fromMock = jest.fn(() => ({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
    remove: removeMock,
  }));

  return {
    client: {
      storage: {
        from: fromMock,
      },
    },
    uploadMock,
    getPublicUrlMock,
    removeMock,
    fromMock,
  };
};

const buildImages = (): ProcessedImages => ({
  thumbnail: `data:image/jpeg;base64,${Buffer.from('thumb').toString('base64')}`,
  medium: `data:image/jpeg;base64,${Buffer.from('medium').toString('base64')}`,
  full: `data:image/jpeg;base64,${Buffer.from('primary').toString('base64')}`,
});

describe('Supabase storage helpers', () => {
  const tenantId = 'tenant-1';
  const entityId = 'entity-1';
  const bucket = 'test-bucket';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads processed images and returns URLs with stored paths', async () => {
    const mock = createSupabaseStorageMock();
    const timestamp = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(timestamp);

    mock.uploadMock.mockResolvedValue({ data: { path: 'ignored' }, error: null });
    mock.getPublicUrlMock
      .mockReturnValueOnce({ data: { publicUrl: 'thumb-url' } })
      .mockReturnValueOnce({ data: { publicUrl: 'medium-url' } })
      .mockReturnValueOnce({ data: { publicUrl: 'primary-url' } });

    const result = await uploadImagesToStorage(
      mock.client as any,
      bucket,
      entityId,
      tenantId,
      buildImages()
    );

    expect(result.urls).toEqual({
      thumbnail_url: 'thumb-url',
      medium_url: 'medium-url',
      primary_image_url: 'primary-url',
    });

    expect(result.paths).toEqual({
      thumbnail: `${tenantId}/${entityId}/thumbnail-${timestamp}.jpg`,
      medium: `${tenantId}/${entityId}/medium-${timestamp}.jpg`,
      full: `${tenantId}/${entityId}/full-${timestamp}.jpg`,
    });

    expect(mock.uploadMock).toHaveBeenCalledTimes(3);

    const uploadCalls = mock.uploadMock.mock.calls;
    expect(Buffer.compare(uploadCalls[0][1], Buffer.from('thumb'))).toBe(0);
    expect(Buffer.compare(uploadCalls[1][1], Buffer.from('medium'))).toBe(0);
    expect(Buffer.compare(uploadCalls[2][1], Buffer.from('primary'))).toBe(0);

    uploadCalls.forEach(call => {
      expect(call[2]).toEqual(
        expect.objectContaining({
          cacheControl: '3600',
          contentType: 'image/jpeg',
          upsert: true,
        })
      );
    });
  });

  it('throws when an upload fails', async () => {
    const mock = createSupabaseStorageMock();
    mock.uploadMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'upload-error' },
    });

    await expect(
      uploadImagesToStorage(mock.client as any, bucket, entityId, tenantId, buildImages())
    ).rejects.toThrow('Failed to upload thumbnail image: upload-error');
  });

  it('throws when public URL cannot be resolved', async () => {
    const mock = createSupabaseStorageMock();
    mock.uploadMock.mockResolvedValue({ data: { path: 'ignored' }, error: null });
    mock.getPublicUrlMock.mockReturnValue({ data: { publicUrl: '' } });

    await expect(
      uploadImagesToStorage(mock.client as any, bucket, entityId, tenantId, buildImages())
    ).rejects.toThrow('Failed to resolve public URL for thumbnail image');
  });

  it('deletes stored images when paths provided', async () => {
    const mock = createSupabaseStorageMock();
    mock.removeMock.mockResolvedValue({ data: null, error: null });

    await deleteImagesFromStorage(mock.client as any, bucket, ['a.jpg', 'b.jpg']);

    expect(mock.removeMock).toHaveBeenCalledWith(['a.jpg', 'b.jpg']);
  });

  it('throws when delete operation fails', async () => {
    const mock = createSupabaseStorageMock();
    mock.removeMock.mockResolvedValue({
      data: null,
      error: { message: 'delete-error' },
    });

    await expect(
      deleteImagesFromStorage(mock.client as any, bucket, ['a.jpg'])
    ).rejects.toThrow('Failed to delete storage objects: delete-error');
  });
});

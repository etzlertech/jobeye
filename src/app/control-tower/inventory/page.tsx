'use client';

import { useEffect, useMemo, useState } from 'react';

interface InventoryItemSummary {
  id: string;
  name: string;
  itemType: 'equipment' | 'material';
  skuOrIdentifier?: string | null;
  primaryImageUrl?: string | null;
}

interface InventoryImage {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  isPrimary: boolean;
  aspectRatio: number;
}

interface InventoryItemDetail extends InventoryItemSummary {
  description?: string | null;
  notes?: string | null;
  images: InventoryImage[];
}

type InventoryKind = 'equipment' | 'material';

type CreationState = {
  itemType: InventoryKind;
  name: string;
  sku: string;
  description: string;
  notes: string;
};

const defaultCreationState: CreationState = {
  itemType: 'equipment',
  name: '',
  sku: '',
  description: '',
  notes: '',
};

interface UploadState {
  uploading: boolean;
  error?: string | null;
}

export default function InventoryManagerPage() {
  const [items, setItems] = useState<InventoryItemSummary[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<InventoryKind>('equipment');
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItemDetail | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creationState, setCreationState] = useState<CreationState>(defaultCreationState);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationSubmitting, setCreationSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ uploading: false });

  const filteredItems = useMemo(() => {
    return items.filter(item => item.itemType === selectedItemType);
  }, [items, selectedItemType]);

  useEffect(() => {
    const loadItems = async () => {
      setLoadingItems(true);
      try {
        const response = await fetch('/api/inventory/items');
        if (!response.ok) {
          throw new Error('Failed to load inventory items');
        }
        const data = await response.json();
        setItems(data.items || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingItems(false);
      }
    };

    loadItems();
  }, []);

  useEffect(() => {
    const firstItem = filteredItems.length > 0 ? filteredItems[0] : null;
    if (firstItem) {
      setSelectedItemId(firstItem.id);
      setSelectedItemType(firstItem.itemType);
    } else {
      setSelectedItemId(null);
      setSelectedItemDetail(null);
    }
  }, [filteredItems, selectedItemType]);

  useEffect(() => {
    if (!selectedItemId) {
      setSelectedItemDetail(null);
      return;
    }

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const params = new URLSearchParams({ itemType: selectedItemType });
        const detailUrl = '/api/inventory/items/' + selectedItemId + '?' + params.toString();
        const response = await fetch(detailUrl);
        if (!response.ok) {
          throw new Error('Failed to load item detail');
        }
        const data = await response.json();
        setSelectedItemDetail(data.item);
      } catch (error) {
        console.error(error);
      } finally {
        setDetailLoading(false);
      }
    };

    loadDetail();
  }, [selectedItemId, selectedItemType]);

  const handleCreateItem = async () => {
    setCreationSubmitting(true);
    setCreationError(null);
    try {
      const response = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemType: creationState.itemType,
          name: creationState.name,
          sku: creationState.sku || undefined,
          description: creationState.description || undefined,
          notes: creationState.notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create item');
      }

      const data = await response.json();
      const created = data.item as InventoryItemSummary;
      setItems(prev => [created, ...prev]);
      setSelectedItemType(created.itemType);
      setSelectedItemId(created.id);
      setCreationState(defaultCreationState);
    } catch (error) {
      console.error(error);
      setCreationError(error instanceof Error ? error.message : 'Failed to create item');
    } finally {
      setCreationSubmitting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !selectedItemDetail) {
      return;
    }

    setUploadState({ uploading: true, error: null });

    try {
      const uploadUrlResponse = await fetch('/api/inventory/images/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemType: selectedItemDetail.itemType,
          itemId: selectedItemDetail.id,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create upload session');
      }

      const uploadSession = await uploadUrlResponse.json();

      const uploadResult = await fetch(uploadSession.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-upsert': 'true',
        },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error('Failed to upload image to storage');
      }

      const imageMeta = await readImageMetadata(file);

      const finalizeResponse = await fetch('/api/inventory/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemType: selectedItemDetail.itemType,
          itemId: selectedItemDetail.id,
          storagePath: uploadSession.storagePath,
          aspectRatio: imageMeta ? imageMeta.aspectRatio : undefined,
          originalWidth: imageMeta ? imageMeta.width : undefined,
          originalHeight: imageMeta ? imageMeta.height : undefined,
          cropBox: imageMeta ? imageMeta.squareCrop : undefined,
          isPrimary: selectedItemDetail.images.length === 0,
        }),
      });

      if (!finalizeResponse.ok) {
        const errorData = await finalizeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to finalize image');
      }

      const finalizeData = await finalizeResponse.json();

      setSelectedItemDetail(prev => {
        if (!prev) return prev;
        const updatedImages = prev.images.map(img => ({ ...img, isPrimary: finalizeData.image.isPrimary ? false : img.isPrimary }));
        return {
          ...prev,
          images: [finalizeData.image, ...updatedImages],
        };
      });
    } catch (error) {
      console.error(error);
      setUploadState({ uploading: false, error: error instanceof Error ? error.message : 'Upload failed' });
      return;
    }

    setUploadState({ uploading: false, error: null });
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!selectedItemDetail) return;

    try {
      const response = await fetch('/api/inventory/images', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId,
          itemType: selectedItemDetail.itemType,
          itemId: selectedItemDetail.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to set primary image');
      }

      setSelectedItemDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          images: prev.images.map(img => ({ ...img, isPrimary: img.id === imageId })),
        };
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!selectedItemDetail) return;

    try {
      const params = new URLSearchParams({
        imageId,
        itemType: selectedItemDetail.itemType,
        itemId: selectedItemDetail.id,
      });
      const deleteUrl = '/api/inventory/images?' + params.toString();

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete image');
      }

      setSelectedItemDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          images: prev.images.filter(img => img.id !== imageId),
        };
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Intake</h1>
            <p className="text-sm text-slate-400">Create inventory items and manage reference imagery for vision verification.</p>
          </div>
        </header>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Add Inventory Item</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Item Type</label>
              <select
                value={creationState.itemType}
                onChange={event => setCreationState(prev => ({ ...prev, itemType: event.target.value as InventoryKind }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm"
              >
                <option value="equipment">Equipment</option>
                <option value="material">Material</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                value={creationState.name}
                onChange={event => setCreationState(prev => ({ ...prev, name: event.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm"
                placeholder="Item name"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">SKU / Identifier</label>
              <input
                value={creationState.sku}
                onChange={event => setCreationState(prev => ({ ...prev, sku: event.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreateItem}
                disabled={!creationState.name || creationSubmitting}
                className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm font-semibold"
              >
                {creationSubmitting ? 'Creating…' : 'Create Item'}
              </button>
            </div>
          </div>
          {creationError && <p className="text-sm text-red-400 mt-2">{creationError}</p>}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Items</h2>
              <div className="flex gap-2 text-xs bg-slate-800 rounded-full p-1">
                {(['equipment', 'material'] as InventoryKind[]).map(type => {
                  const isActive = type === selectedItemType;
                  const className = isActive ? 'px-3 py-1 rounded-full bg-blue-500 text-white' : 'px-3 py-1 rounded-full text-slate-300';
                  return (
                    <button
                      key={type}
                      className={className}
                      onClick={() => setSelectedItemType(type)}
                    >
                      {type === 'equipment' ? 'Equipment' : 'Materials'}
                    </button>
                  );
                })}
              </div>
            </div>

            {loadingItems ? (
              <p className="text-sm text-slate-400">Loading items…</p>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-slate-400">No {selectedItemType} items yet.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                {filteredItems.map(item => {
                  const isSelected = selectedItemId === item.id;
                  const className = isSelected
                    ? 'w-full text-left p-3 rounded-lg border bg-blue-500/10 border-blue-500 text-white'
                    : 'w-full text-left p-3 rounded-lg border bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700';
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setSelectedItemType(item.itemType);
                      }}
                      className={className}
                    >
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {item.itemType} • {item.skuOrIdentifier || 'No SKU'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            {detailLoading ? (
              <p className="text-sm text-slate-400">Loading item details…</p>
            ) : selectedItemDetail ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedItemDetail.name}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedItemDetail.itemType} • {selectedItemDetail.skuOrIdentifier || 'No SKU'}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Reference Images</h3>
                    <label className="text-xs bg-blue-500 hover:bg-blue-400 px-3 py-1 rounded-md cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                      {uploadState.uploading ? 'Uploading…' : 'Add Image'}
                    </label>
                  </div>
                  {uploadState.error && <p className="text-xs text-red-400 mb-2">{uploadState.error}</p>}

                  {selectedItemDetail.images.length === 0 ? (
                    <p className="text-xs text-slate-400">No images yet. Upload a 1:1 cropped reference photo.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedItemDetail.images.map(image => (
                        <div key={image.id} className="relative group">
                          <img
                            src={image.thumbnailUrl || image.imageUrl}
                            alt={selectedItemDetail.name}
                            className="w-full h-32 object-cover rounded-lg border border-slate-800"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-[11px] px-2 py-1 flex items-center justify-between">
                            <span>{image.isPrimary ? 'Primary' : 'Gallery'}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!image.isPrimary && (
                                <button onClick={() => handleSetPrimary(image.id)} className="text-blue-300 hover:text-blue-200">
                                  Set Primary
                                </button>
                              )}
                              <button onClick={() => handleDeleteImage(image.id)} className="text-red-300 hover:text-red-200">
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Select an item to view details.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type ImageMetadata = {
  width: number;
  height: number;
  aspectRatio: number;
  squareCrop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

async function readImageMetadata(file: File): Promise<ImageMetadata | null> {
  try {
    const image = await loadImage(file);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const aspectRatio = height === 0 ? 1 : width / height;

    const size = Math.min(width, height);
    const offsetX = (width - size) / 2;
    const offsetY = (height - size) / 2;

    return {
      width,
      height,
      aspectRatio,
      squareCrop: {
        x: clamp(offsetX / width, 0, 1),
        y: clamp(offsetY / height, 0, 1),
        width: clamp(size / width, 0, 1),
        height: clamp(size / height, 0, 1),
      },
    };
  } catch (error) {
    console.error('Failed to derive image metadata', error);
    return null;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

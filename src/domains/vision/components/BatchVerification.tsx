/**
 * @file /src/domains/vision/components/BatchVerification.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose Batch verification UI for multiple kits
 * @complexity_budget 400
 * @test_coverage ≥80%
 */

'use client';

import { useState, useRef } from 'react';

interface BatchItem {
  kitId: string;
  expectedItems: string[];
  imageData?: ImageData;
  status: 'pending' | 'processing' | 'success' | 'failed';
  result?: any;
  error?: string;
}

interface BatchVerificationProps {
  tenantId: string;
  onComplete?: (results: any) => void;
  className?: string;
}

export default function BatchVerification({
  tenantId,
  onComplete,
  className = ''
}: BatchVerificationProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Add new kit to batch
  const addKit = () => {
    const newItem: BatchItem = {
      kitId: `kit-${Date.now()}`,
      expectedItems: [],
      status: 'pending'
    };
    setItems([...items, newItem]);
  };

  // Remove kit from batch
  const removeKit = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Update kit details
  const updateKit = (index: number, updates: Partial<BatchItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    setItems(newItems);
  };

  // Handle image upload for a kit
  const handleImageUpload = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      // Load image and convert to ImageData
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx!.drawImage(img, 0, 0);

        const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
        updateKit(index, { imageData });
      };

      img.src = URL.createObjectURL(file);
    } catch (error: any) {
      alert(`Failed to load image: ${error.message}`);
    }
  };

  // Process batch
  const processBatch = async () => {
    // Validate all items have required data
    const invalidItems = items.filter(
      item => !item.imageData || item.expectedItems.length === 0
    );

    if (invalidItems.length > 0) {
      alert('All kits must have an image and at least one expected item');
      return;
    }

    setIsProcessing(true);
    setBatchResult(null);

    // Mark all as processing
    setItems(items.map(item => ({ ...item, status: 'processing' as const })));

    try {
      // Prepare request
      const requestItems = items.map(item => ({
        kitId: item.kitId,
        imageData: {
          data: Array.from(item.imageData!.data),
          width: item.imageData!.width,
          height: item.imageData!.height
        },
        expectedItems: item.expectedItems
      }));

      const response = await fetch('/api/vision/batch-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          tenantId,
          items: requestItems,
          maxBudgetUsd: 10.0,
          maxRequestsPerDay: 100,
          stopOnError: false,
          concurrency: 3
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Batch verification failed');
      }

      setBatchResult(data.data);

      // Update individual item statuses
      const updatedItems = items.map((item, idx) => {
        const result = data.data.results.find((r: any) => r.kitId === item.kitId);
        return {
          ...item,
          status: result?.success ? 'success' : 'failed',
          result: result?.result,
          error: result?.error?.message
        };
      });

      setItems(updatedItems);

      if (onComplete) {
        onComplete(data.data);
      }

    } catch (error: any) {
      alert(`Batch verification failed: ${error.message}`);
      setItems(items.map(item => ({ ...item, status: 'failed' as const, error: error.message })));
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse expected items from comma-separated string
  const parseExpectedItems = (text: string): string[] => {
    return text.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  return (
    <div className={`batch-verification ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Batch Verification</h2>
        <p className="text-gray-600">Verify multiple kits in one batch</p>
      </div>

      {/* Batch Results Summary */}
      {batchResult && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-2">Batch Complete</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total Items</p>
              <p className="text-xl font-bold">{batchResult.totalItems}</p>
            </div>
            <div>
              <p className="text-gray-600">Successful</p>
              <p className="text-xl font-bold text-green-600">{batchResult.successCount}</p>
            </div>
            <div>
              <p className="text-gray-600">Failed</p>
              <p className="text-xl font-bold text-red-600">{batchResult.failureCount}</p>
            </div>
            <div>
              <p className="text-gray-600">Total Cost</p>
              <p className="text-xl font-bold">${batchResult.totalCostUsd.toFixed(4)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Kit List */}
      <div className="space-y-4 mb-6">
        {items.map((item, index) => (
          <div key={index} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  item.status === 'success' ? 'bg-green-500' :
                  item.status === 'failed' ? 'bg-red-500' :
                  item.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                  'bg-gray-300'
                }`} />
                <h3 className="font-semibold">Kit #{index + 1}</h3>
              </div>
              <button
                onClick={() => removeKit(index)}
                disabled={isProcessing}
                className="text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kit ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kit ID
                </label>
                <input
                  type="text"
                  value={item.kitId}
                  onChange={(e) => updateKit(index, { kitId: e.target.value })}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                />
              </div>

              {/* Expected Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Items (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="wrench, hammer, screwdriver"
                  value={item.expectedItems.join(', ')}
                  onChange={(e) => updateKit(index, { expectedItems: parseExpectedItems(e.target.value) })}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                />
              </div>

              {/* Image Upload */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kit Image
                </label>
                <input
                  ref={(ref) => fileInputRefs.current[index] = ref}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageUpload(index, e.target.files[0]);
                    }
                  }}
                  disabled={isProcessing}
                  className="w-full text-sm"
                />
                {item.imageData && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Image loaded ({item.imageData.width}x{item.imageData.height})
                  </p>
                )}
              </div>
            </div>

            {/* Item Status/Results */}
            {item.status === 'success' && item.result && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm font-medium text-green-800">
                  ✓ Verification: {item.result.verificationResult}
                </p>
                <p className="text-xs text-green-700">
                  Confidence: {(item.result.confidenceScore * 100).toFixed(1)}% |
                  Cost: ${item.result.costUsd.toFixed(4)}
                </p>
              </div>
            )}

            {item.status === 'failed' && item.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm font-medium text-red-800">✗ Failed</p>
                <p className="text-xs text-red-700">{item.error}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={addKit}
          disabled={isProcessing || items.length >= 50}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Kit
        </button>

        <button
          onClick={processBatch}
          disabled={isProcessing || items.length === 0}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {isProcessing ? 'Processing...' : `Verify ${items.length} Kit${items.length !== 1 ? 's' : ''}`}
        </button>

        {items.length > 0 && !isProcessing && (
          <button
            onClick={() => setItems([])}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
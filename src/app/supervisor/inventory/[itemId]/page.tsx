'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { ItemImageUpload } from '@/components/items/ItemImageUpload';
import type { ProcessedImages } from '@/utils/image-processor';
import {
  ArrowLeft,
  Package,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Edit,
  Save
} from 'lucide-react';

interface ItemDetails {
  id: string;
  name: string;
  category: string;
  itemType: string;
  trackingMode: string;
  currentQuantity: number;
  unitOfMeasure: string;
  minQuantity: number | null;
  reorderPoint: number | null;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  sku: string | null;
  status: string;
  primaryImageUrl: string | null;
  mediumUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function InventoryItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.itemId as string;

  const [item, setItem] = useState<ItemDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Load item details
  const loadItem = async () => {
    try {
      setIsLoading(true);

      // Use default tenant for now - TODO: Get from user context
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await fetch(`/api/supervisor/items/${itemId}`, {
        headers: { 'x-tenant-id': tenantId },
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Failed to load item');

      setItem(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  const handleImageCapture = async (images: ProcessedImages) => {
    setIsUploading(true);
    setError(null);

    try {
      // Use default tenant for now - TODO: Get from user context
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await fetch(`/api/supervisor/items/${itemId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        credentials: 'include',
        body: JSON.stringify({ images })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      setSuccess('Image uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);

      // Refresh item data to show new images
      await loadItem();
      setShowImageUpload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading item...</p>
          </div>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
        `}</style>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mobile-container">
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/')}
          showBackButton={true}
          onBack={() => router.push('/supervisor/inventory')}
        />
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-gray-400 text-lg">Item not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
        showBackButton={true}
        onBack={() => router.push('/supervisor/inventory')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Item Details</h1>
          <p className="text-xs text-gray-500">{item.itemType} • {item.category}</p>
        </div>
        <Package className="w-6 h-6" style={{ color: '#FFD700' }} />
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="notification-bar success">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Image Section */}
        <div className="p-4">
          <div className="image-container">
            {item.mediumUrl || item.primaryImageUrl ? (
              <img
                src={item.mediumUrl || item.primaryImageUrl || ''}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Package className="w-16 h-16 text-gray-600" />
              </div>
            )}
          </div>

          {/* Image Upload Toggle */}
          {showImageUpload ? (
            <div className="mt-4">
              <ItemImageUpload
                onImageCapture={handleImageCapture}
                disabled={isUploading}
              />
              <button
                onClick={() => setShowImageUpload(false)}
                disabled={isUploading}
                className="btn-secondary w-full mt-3"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowImageUpload(true)}
              className="btn-primary w-full mt-3"
            >
              <Camera className="w-5 h-5 mr-2" />
              {item.primaryImageUrl ? 'Change Image' : 'Add Image'}
            </button>
          )}
        </div>

        {/* Item Information */}
        <div className="px-4 pb-4 space-y-4">
          {/* Name */}
          <div>
            <label className="detail-label">Name</label>
            <p className="detail-value">{item.name}</p>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <label className="detail-label">Description</label>
              <p className="detail-value">{item.description}</p>
            </div>
          )}

          {/* Quantity & Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="detail-label">Current Quantity</label>
              <p className="detail-value">{item.currentQuantity} {item.unitOfMeasure}</p>
            </div>
            {item.minQuantity && (
              <div>
                <label className="detail-label">Min Quantity</label>
                <p className="detail-value">{item.minQuantity} {item.unitOfMeasure}</p>
              </div>
            )}
          </div>

          {/* Product Details */}
          {(item.manufacturer || item.model || item.sku) && (
            <div className="detail-section">
              <h3 className="detail-section-title">Product Details</h3>
              <div className="space-y-2">
                {item.manufacturer && (
                  <div>
                    <label className="detail-label">Manufacturer</label>
                    <p className="detail-value">{item.manufacturer}</p>
                  </div>
                )}
                {item.model && (
                  <div>
                    <label className="detail-label">Model</label>
                    <p className="detail-value">{item.model}</p>
                  </div>
                )}
                {item.sku && (
                  <div>
                    <label className="detail-label">SKU</label>
                    <p className="detail-value">{item.sku}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="detail-label">Status</label>
            <p className="detail-value capitalize">{item.status}</p>
          </div>

          {/* Timestamps */}
          <div className="detail-section">
            <h3 className="detail-section-title">Timestamps</h3>
            <div className="space-y-2">
              <div>
                <label className="detail-label">Created</label>
                <p className="detail-value">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="detail-label">Last Updated</label>
                <p className="detail-value">{new Date(item.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push('/supervisor/inventory')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <button
          type="button"
          onClick={() => router.push(`/supervisor/inventory/${itemId}/edit`)}
          className="btn-primary flex-1"
        >
          <Edit className="w-5 h-5 mr-2" />
          Edit
        </button>
      </div>

      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .notification-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 1rem;
          border-radius: 0.5rem;
        }

        .notification-bar.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .notification-bar.success {
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          color: #FFD700;
        }

        .image-container {
          width: 100%;
          height: 300px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          overflow: hidden;
        }

        .detail-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #9CA3AF;
          margin-bottom: 0.25rem;
        }

        .detail-value {
          font-size: 1rem;
          color: white;
          margin: 0;
        }

        .detail-section {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
        }

        .detail-section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #FFD700;
          margin: 0 0 0.75rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .bottom-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.9);
          border-top: 1px solid #333;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }
      `}</style>
    </div>
  );
}

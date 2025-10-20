'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  ArrowLeft,
  Wrench,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Edit
} from 'lucide-react';

interface ItemDetails {
  id: string;
  name: string;
  category: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  primaryImageUrl: string | null;
  mediumUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ToolDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;

  const [item, setItem] = useState<ItemDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load item details
  const loadItem = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/supervisor/items/${itemId}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Failed to load tool');

      setItem(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tool');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading tool...</p>
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

  if (!item || error) {
    return (
      <div className="mobile-container">
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/')}
        />
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-gray-400 text-lg">{error || 'Tool not found'}</p>
            <button
              onClick={() => router.push('/supervisor/tools')}
              className="mt-4 px-6 py-2 bg-golden text-black font-semibold rounded-lg"
            >
              Back to Tools
            </button>
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

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">{item.name}</h1>
          <p className="text-xs text-gray-500">{item.category.replace('_', ' ')}</p>
        </div>
        <Wrench className="w-6 h-6" style={{ color: '#FFD700' }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Image Section */}
        {(item.mediumUrl || item.primaryImageUrl || item.thumbnailUrl) && (
          <div className="p-4">
            <div className="image-container">
              <img
                src={item.mediumUrl || item.primaryImageUrl || item.thumbnailUrl || ''}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Item Information */}
        <div className="px-4 pb-4 space-y-4">
          {/* Description */}
          {item.description && (
            <div>
              <label className="detail-label">Description</label>
              <p className="detail-value">{item.description}</p>
            </div>
          )}

          {/* Product Details */}
          {(item.manufacturer || item.model || item.serial_number) && (
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
                {item.serial_number && (
                  <div>
                    <label className="detail-label">Serial Number</label>
                    <p className="detail-value">{item.serial_number}</p>
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
          onClick={() => router.push('/supervisor/tools')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Tools
        </button>
        <button
          type="button"
          onClick={() => router.push(`/supervisor/tools/${itemId}/edit`)}
          className="btn-primary flex-1"
        >
          <Edit className="w-5 h-5 mr-2" />
          Edit Tool
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

        .btn-primary:hover {
          background: #FFC700;
        }
      `}</style>
    </div>
  );
}

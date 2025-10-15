'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { ItemImageUpload } from '@/components/items/ItemImageUpload';
import type { ProcessedImages } from '@/utils/image-processor';
import {
  ArrowLeft,
  Home,
  Building2,
  Warehouse,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Edit,
  Users,
  MapPin,
  FileText,
  Ruler
} from 'lucide-react';

interface PropertyDetails {
  id: string;
  name?: string;
  customer_id: string;
  address?: string | { street?: string; city?: string; state?: string; zip?: string };
  property_type?: 'residential' | 'commercial' | 'industrial';
  size_sqft?: string;
  access_notes?: string;
  primaryImageUrl: string | null;
  mediumUrl: string | null;
  thumbnailUrl: string | null;
  customer?: { name: string };
  created_at: string;
  updated_at?: string;
}

const propertyTypeIcons = {
  residential: Home,
  commercial: Building2,
  industrial: Warehouse
};

const propertyTypeLabels = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial'
};

export default function PropertyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params?.id as string;

  const [property, setProperty] = useState<PropertyDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Load property details
  const loadProperty = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/supervisor/properties/${propertyId}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Failed to load property');

      setProperty(data.property || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load property');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) {
      loadProperty();
    }
  }, [propertyId]);

  const handleImageCapture = async (images: ProcessedImages) => {
    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/supervisor/properties/${propertyId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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

      // Refresh property data to show new images
      await loadProperty();
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
            <p className="text-gray-400 text-lg">Loading property...</p>
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

  if (!property) {
    return (
      <div className="mobile-container">
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/sign-in')}
        />
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-gray-400 text-lg">Property not found</p>
          </div>
        </div>
      </div>
    );
  }

  const propertyType = property.property_type || 'residential';
  const TypeIcon = propertyTypeIcons[propertyType];
  const typeLabel = propertyTypeLabels[propertyType];

  // Format address for display
  const formatAddress = (address?: string | { street?: string; city?: string; state?: string; zip?: string }) => {
    if (!address) return null;
    if (typeof address === 'string') return address;
    // If it's an object, format it
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zip
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const displayAddress = formatAddress(property.address);

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/sign-in')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Property Details</h1>
          <p className="text-xs text-gray-500">{typeLabel}</p>
        </div>
        <TypeIcon className="w-6 h-6" style={{ color: '#FFD700' }} />
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
            {property.mediumUrl || property.primaryImageUrl ? (
              <img
                src={property.mediumUrl || property.primaryImageUrl || ''}
                alt={property.name || 'Property'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <TypeIcon className="w-16 h-16 text-gray-600" />
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
              {property.primaryImageUrl ? 'Change Image' : 'Add Image'}
            </button>
          )}
        </div>

        {/* Property Information */}
        <div className="px-4 pb-4 space-y-4">
          {/* Name */}
          {property.name && (
            <div>
              <label className="detail-label">Property Name</label>
              <p className="detail-value">{property.name}</p>
            </div>
          )}

          {/* Address */}
          {displayAddress && (
            <div className="detail-section">
              <h3 className="detail-section-title">Location</h3>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                <p className="detail-value text-sm">{displayAddress}</p>
              </div>
            </div>
          )}

          {/* Property Details */}
          <div className="detail-section">
            <h3 className="detail-section-title">Property Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <TypeIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <label className="detail-label">Type</label>
                  <p className="detail-value text-sm">{typeLabel}</p>
                </div>
              </div>

              {property.size_sqft && (
                <div className="flex items-center gap-3">
                  <Ruler className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <label className="detail-label">Size</label>
                    <p className="detail-value text-sm">{property.size_sqft}</p>
                  </div>
                </div>
              )}

              {property.customer?.name && (
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <label className="detail-label">Customer</label>
                    <p className="detail-value text-sm">{property.customer.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Access Notes */}
          {property.access_notes && (
            <div className="detail-section">
              <h3 className="detail-section-title">Access Notes</h3>
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="detail-value text-sm">{property.access_notes}</p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="detail-section">
            <h3 className="detail-section-title">Timestamps</h3>
            <div className="space-y-2">
              <div>
                <label className="detail-label">Created</label>
                <p className="detail-value text-sm">{new Date(property.created_at).toLocaleString()}</p>
              </div>
              {property.updated_at && (
                <div>
                  <label className="detail-label">Last Updated</label>
                  <p className="detail-value text-sm">{new Date(property.updated_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push('/supervisor/properties')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            router.push('/supervisor/properties');
          }}
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
          font-size: 0.75rem;
          font-weight: 500;
          color: #9CA3AF;
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
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

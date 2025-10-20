'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { SimpleCameraModal } from '@/components/camera/SimpleCameraModal';
import { imageProcessor } from '@/utils/image-processor';
import {
  ArrowLeft,
  AlertCircle,
  X,
  Loader2,
  Save,
  Truck,
  Camera
} from 'lucide-react';

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vehicleType, setVehicleType] = useState('truck');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vin, setVin] = useState('');
  const [status, setStatus] = useState<'active' | 'maintenance' | 'retired'>('active');

  // Load existing item data
  useEffect(() => {
    const loadItem = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/supervisor/items/${itemId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load vehicle');
        }

        const item = data.item;
        setName(item.name || '');
        setDescription(item.description || '');
        setVehicleType(item.attributes?.vehicle_type || 'truck');
        setManufacturer(item.manufacturer || '');
        setModel(item.model || '');
        setYear(item.attributes?.year || '');
        setLicensePlate(item.attributes?.license_plate || '');
        setVin(item.attributes?.vin || '');
        setStatus(item.status || 'active');
        setExistingImageUrl(item.mediumUrl || item.primaryImageUrl || item.thumbnailUrl || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load vehicle');
      } finally {
        setIsLoading(false);
      }
    };

    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  const handleCameraCapture = (imageUrl: string, blob: Blob) => {
    setCapturedImage(imageUrl);
    setImageBlob(blob);
    setIsCameraOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Vehicle name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Update the item
      // Build attributes with vehicle-specific fields
      const attributes: any = {
        vehicle_type: vehicleType,
      };

      if (year) attributes.year = year;
      if (licensePlate.trim()) attributes.license_plate = licensePlate.trim();
      if (vin.trim()) attributes.vin = vin.trim();

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        status: status,
        attributes: attributes,
      };

      const response = await fetch(`/api/supervisor/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update vehicle');
      }

      // Step 2: Upload new image if captured
      if (imageBlob) {
        try {
          const processedImages = await imageProcessor.processImage(imageBlob);

          const imageResponse = await fetch(`/api/supervisor/items/${itemId}/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: processedImages }),
          });

          if (!imageResponse.ok) {
            console.error('Failed to upload image, but item was updated');
          }
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
          // Continue anyway - item was updated successfully
        }
      }

      // Success - navigate back to detail page
      router.push(`/supervisor/vehicles/${itemId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading vehicle...</p>
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
        <Truck className="w-6 h-6 text-golden" />
        <h1 className="text-xl font-semibold">Edit Vehicle</h1>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Photo Preview */}
          {(capturedImage || existingImageUrl) && (
            <div className="form-section">
              <h2 className="section-title">Photo</h2>
              <div className="relative">
                <img
                  src={capturedImage || existingImageUrl || ''}
                  alt="Vehicle photo"
                  className="w-full h-48 object-cover rounded-lg"
                />
                {capturedImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedImage(null);
                      setImageBlob(null);
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 rounded-full"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="form-section">
            <h2 className="section-title">Basic Information</h2>

            <div className="form-field">
              <label htmlFor="name" className="form-label">
                Vehicle Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Truck 1, Service Van"
                className="input-field"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                rows={3}
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="vehicleType" className="form-label">
                Vehicle Type
              </label>
              <select
                id="vehicleType"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="input-field"
                disabled={isSubmitting}
              >
                <option value="truck">Truck</option>
                <option value="van">Van</option>
                <option value="trailer">Trailer</option>
                <option value="pickup">Pickup</option>
                <option value="suv">SUV</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="form-section">
            <h2 className="section-title">Vehicle Details</h2>

            <div className="form-field">
              <label htmlFor="manufacturer" className="form-label">
                Make (Manufacturer)
              </label>
              <input
                id="manufacturer"
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., Ford, Chevrolet, Ram"
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="model" className="form-label">
                Model
              </label>
              <input
                id="model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., F-150, Express 2500"
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="year" className="form-label">
                Year
              </label>
              <input
                id="year"
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g., 2020"
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="licensePlate" className="form-label">
                License Plate
              </label>
              <input
                id="licensePlate"
                type="text"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="e.g., ABC-1234"
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="vin" className="form-label">
                VIN (Vehicle Identification Number)
              </label>
              <input
                id="vin"
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                placeholder="17-character VIN"
                maxLength={17}
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="status" className="form-label">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="input-field"
                disabled={isSubmitting}
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>
        </div>
      </form>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push(`/supervisor/vehicles/${itemId}`)}
          disabled={isSubmitting}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Cancel
        </button>
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={isSubmitting || !name.trim()}
          className="btn-primary flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Save Changes
            </>
          )}
        </button>

        {/* Camera Button - Bottom Right */}
        <button
          type="button"
          onClick={() => setIsCameraOpen(true)}
          disabled={isSubmitting}
          className="btn-camera"
          title="Take Photo"
        >
          <Camera className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Modal */}
      <SimpleCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

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
          padding: 0 0.5rem;
          box-sizing: border-box;
        }

        .header-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
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

        .form-section {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 1rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #FFD700;
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-field {
          margin-bottom: 1rem;
        }

        .form-field:last-child {
          margin-bottom: 0;
        }

        .form-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: #9CA3AF;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .input-field::placeholder {
          color: #6b7280;
        }

        .input-field:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }

        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-camera {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3.5rem;
          height: 3.5rem;
          background: rgba(255, 215, 0, 0.2);
          border: 2px solid #FFD700;
          border-radius: 50%;
          color: #FFD700;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .btn-camera:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.3);
          transform: scale(1.05);
        }

        .btn-camera:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

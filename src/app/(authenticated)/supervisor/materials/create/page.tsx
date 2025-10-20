'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { SimpleCameraModal } from '@/components/camera/SimpleCameraModal';
import {
  ArrowLeft,
  AlertCircle,
  X,
  Loader2,
  Save,
  Package,
  Camera
} from 'lucide-react';

export default function CreateMaterialPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('lumber');
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState('each');
  const [minQuantity, setMinQuantity] = useState('');
  const [sku, setSku] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [status, setStatus] = useState<'active' | 'retired'>('active');

  const handleCameraCapture = (imageUrl: string, blob: Blob) => {
    setCapturedImage(imageUrl);
    setImageBlob(blob);
    setIsCameraOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Material name is required');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) {
      setError('Quantity must be a valid number');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        item_type: 'material',
        category: category,
        name: name.trim(),
        description: description.trim() || null,
        tracking_mode: 'quantity',
        unit_of_measure: unit,
        current_quantity: qty,
        min_quantity: minQuantity ? parseFloat(minQuantity) : null,
        sku: sku.trim() || null,
        manufacturer: manufacturer.trim() || null,
        status: status,
      };

      const response = await fetch('/api/supervisor/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create material');
      }

      // Success - navigate back to materials list
      router.push('/supervisor/materials');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create material');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <Package className="w-6 h-6 text-golden" />
        <h1 className="text-xl font-semibold">Add Material</h1>
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
          {capturedImage && (
            <div className="form-section">
              <h2 className="section-title">Photo</h2>
              <div className="relative">
                <img
                  src={capturedImage}
                  alt="Material photo"
                  className="w-full h-48 object-cover rounded-lg"
                />
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
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="form-section">
            <h2 className="section-title">Basic Information</h2>

            <div className="form-field">
              <label htmlFor="name" className="form-label">
                Material Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 2x4 Lumber"
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
              <label htmlFor="category" className="form-label">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
                disabled={isSubmitting}
              >
                <option value="lumber">Lumber</option>
                <option value="concrete">Concrete</option>
                <option value="paint">Paint</option>
                <option value="hardware">Hardware</option>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Quantity */}
          <div className="form-section">
            <h2 className="section-title">Inventory</h2>

            <div className="form-field">
              <label htmlFor="quantity" className="form-label">
                Current Quantity <span className="text-red-500">*</span>
              </label>
              <input
                id="quantity"
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="input-field"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="unit" className="form-label">
                Unit of Measure <span className="text-red-500">*</span>
              </label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="input-field"
                disabled={isSubmitting}
              >
                <option value="each">Each</option>
                <option value="box">Box</option>
                <option value="bag">Bag</option>
                <option value="gallon">Gallon</option>
                <option value="liter">Liter</option>
                <option value="pound">Pound</option>
                <option value="kilogram">Kilogram</option>
                <option value="meter">Meter</option>
                <option value="foot">Foot</option>
                <option value="yard">Yard</option>
                <option value="square_foot">Square Foot</option>
                <option value="square_meter">Square Meter</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="minQuantity" className="form-label">
                Minimum Quantity (Reorder Point)
              </label>
              <input
                id="minQuantity"
                type="number"
                step="0.01"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="Optional"
                className="input-field"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Details */}
          <div className="form-section">
            <h2 className="section-title">Details</h2>

            <div className="form-field">
              <label htmlFor="sku" className="form-label">
                SKU / Product Code
              </label>
              <input
                id="sku"
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g., LUM-2X4-8"
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="manufacturer" className="form-label">
                Manufacturer / Brand
              </label>
              <input
                id="manufacturer"
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., Behr, Sherwin-Williams"
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
          onClick={() => router.back()}
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
              Creating...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Create Material
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

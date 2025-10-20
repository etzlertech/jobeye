'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  ArrowLeft,
  AlertCircle,
  X,
  Loader2,
  Save,
  Wrench
} from 'lucide-react';

export default function CreateToolPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('hand_tool');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [status, setStatus] = useState<'active' | 'maintenance' | 'retired'>('active');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Tool name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        item_type: 'tool',
        category: category,
        name: name.trim(),
        description: description.trim() || null,
        tracking_mode: 'individual',
        unit_of_measure: 'each',
        current_quantity: 1,
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        serial_number: serialNumber.trim() || null,
        status: status,
      };

      const response = await fetch('/api/supervisor/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create tool');
      }

      // Success - navigate back to tools list
      router.push('/supervisor/tools');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tool');
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
        <Wrench className="w-6 h-6 text-golden" />
        <h1 className="text-xl font-semibold">Add Tool</h1>
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
          {/* Basic Info */}
          <div className="form-section">
            <h2 className="section-title">Basic Information</h2>

            <div className="form-field">
              <label htmlFor="name" className="form-label">
                Tool Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Cordless Drill"
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
                <option value="hand_tool">Hand Tool</option>
                <option value="power_tool">Power Tool</option>
                <option value="measuring">Measuring Tool</option>
                <option value="safety">Safety Equipment</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Details */}
          <div className="form-section">
            <h2 className="section-title">Details</h2>

            <div className="form-field">
              <label htmlFor="manufacturer" className="form-label">
                Manufacturer
              </label>
              <input
                id="manufacturer"
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., DeWalt, Milwaukee"
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="model" className="form-label">
                Model Number
              </label>
              <input
                id="model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., DCD771C2"
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="serialNumber" className="form-label">
                Serial Number
              </label>
              <input
                id="serialNumber"
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g., SN123456"
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
              Create Tool
            </>
          )}
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
      `}</style>
    </div>
  );
}

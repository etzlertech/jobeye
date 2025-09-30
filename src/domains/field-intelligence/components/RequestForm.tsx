/**
 * @file src/domains/field-intelligence/components/RequestForm.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Intake request form with duplicate detection and lead scoring
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface RequestFormData {
  customerName: string;
  propertyAddress: string;
  phone: string;
  email: string;
  serviceType: string;
  requestNotes?: string;
}

interface DuplicateMatch {
  requestId: string;
  customerName: string;
  propertyAddress: string;
  similarityScore: number;
  createdAt: string;
}

interface RequestFormProps {
  userId: string;
  source?: string;
  onSubmit?: (requestId: string) => void;
  onDuplicateDetected?: (matches: DuplicateMatch[]) => void;
  className?: string;
}

/**
 * RequestForm - Intake request creation with duplicate detection
 *
 * Features:
 * - Real-time duplicate detection
 * - Lead scoring integration
 * - Form validation
 * - Duplicate match display
 *
 * @example
 * ```tsx
 * <RequestForm
 *   userId={user.id}
 *   source="web"
 *   onSubmit={(requestId) => console.log('Request created:', requestId)}
 *   onDuplicateDetected={(matches) => console.log('Duplicates:', matches)}
 * />
 * ```
 */
export function RequestForm({
  userId,
  source = 'web',
  onSubmit,
  onDuplicateDetected,
  className = '',
}: RequestFormProps) {
  const [formData, setFormData] = useState<RequestFormData>({
    customerName: '',
    propertyAddress: '',
    phone: '',
    email: '',
    serviceType: '',
    requestNotes: '',
  });

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [leadScore, setLeadScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Check for duplicates when key fields change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.customerName || formData.propertyAddress || formData.phone) {
        checkDuplicates();
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [formData.customerName, formData.propertyAddress, formData.phone, formData.email]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const checkDuplicates = async () => {
    if (!formData.customerName && !formData.propertyAddress && !formData.phone) {
      setDuplicates([]);
      return;
    }

    setCheckingDuplicates(true);

    try {
      const params = new URLSearchParams();
      if (formData.customerName) params.append('customerName', formData.customerName);
      if (formData.propertyAddress) params.append('propertyAddress', formData.propertyAddress);
      if (formData.phone) params.append('phone', formData.phone);
      if (formData.email) params.append('email', formData.email);
      params.append('threshold', '80'); // 80% similarity threshold

      const response = await fetch(
        `/api/field-intelligence/intake/requests?checkDuplicates=true&${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to check duplicates');
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        setDuplicates(data.data);
        if (onDuplicateDetected) {
          onDuplicateDetected(data.data);
        }
      } else {
        setDuplicates([]);
      }
    } catch (err: any) {
      logger.error('Duplicate check failed', { error: err });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.customerName.trim()) {
      setError('Customer name is required');
      return false;
    }

    if (!formData.propertyAddress.trim()) {
      setError('Property address is required');
      return false;
    }

    if (!formData.phone.trim() && !formData.email.trim()) {
      setError('Either phone or email is required');
      return false;
    }

    if (!formData.serviceType) {
      setError('Service type is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/field-intelligence/intake/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          source,
          customerName: formData.customerName,
          propertyAddress: formData.propertyAddress,
          phone: formData.phone || null,
          email: formData.email || null,
          serviceType: formData.serviceType,
          requestNotes: formData.requestNotes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create request');
      }

      const data = await response.json();

      logger.info('Request created successfully', {
        requestId: data.data.id,
        userId,
        source,
        leadScore: data.data.leadScore,
      });

      setLeadScore(data.data.leadScore);
      setSubmitSuccess(true);

      // Reset form
      setFormData({
        customerName: '',
        propertyAddress: '',
        phone: '',
        email: '',
        serviceType: '',
        requestNotes: '',
      });
      setDuplicates([]);

      if (onSubmit) {
        onSubmit(data.data.id);
      }

      // Hide success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err: any) {
      logger.error('Request submission failed', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={`request-form ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Name */}
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
            Customer Name *
          </label>
          <input
            type="text"
            id="customerName"
            name="customerName"
            value={formData.customerName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="John Doe"
            required
          />
        </div>

        {/* Property Address */}
        <div>
          <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700 mb-1">
            Property Address *
          </label>
          <input
            type="text"
            id="propertyAddress"
            name="propertyAddress"
            value={formData.propertyAddress}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="123 Main St, City, State 12345"
            required
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="john@example.com"
          />
        </div>

        {/* Service Type */}
        <div>
          <label htmlFor="serviceType" className="block text-sm font-medium text-gray-700 mb-1">
            Service Type *
          </label>
          <select
            id="serviceType"
            name="serviceType"
            value={formData.serviceType}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select a service</option>
            <option value="lawn_mowing">Lawn Mowing</option>
            <option value="hedge_trimming">Hedge Trimming</option>
            <option value="tree_service">Tree Service</option>
            <option value="irrigation">Irrigation</option>
            <option value="landscaping">Landscaping</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Request Notes */}
        <div>
          <label htmlFor="requestNotes" className="block text-sm font-medium text-gray-700 mb-1">
            Additional Notes
          </label>
          <textarea
            id="requestNotes"
            name="requestNotes"
            value={formData.requestNotes}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any additional information..."
          />
        </div>

        {/* Duplicate Warning */}
        {checkingDuplicates && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            🔍 Checking for duplicates...
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
            <p className="font-medium text-yellow-800 mb-2">
              ⚠️ Potential Duplicate Requests ({duplicates.length})
            </p>
            <div className="space-y-2">
              {duplicates.map((dup) => (
                <div key={dup.requestId} className="bg-white border border-yellow-200 rounded p-2 text-sm">
                  <p className="font-medium text-gray-900">{dup.customerName}</p>
                  <p className="text-gray-600">{dup.propertyAddress}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(dup.similarityScore)}% match • Created {formatDate(dup.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Success Message */}
        {submitSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-medium text-green-800">✓ Request Created Successfully!</p>
            {leadScore !== null && (
              <p className="text-sm text-green-700 mt-1">Lead Score: {leadScore}/100</p>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || checkingDuplicates}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Request...' : 'Create Request'}
        </button>
      </form>
    </div>
  );
}
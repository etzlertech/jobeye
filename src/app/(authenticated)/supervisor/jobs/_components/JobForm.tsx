/*
AGENT DIRECTIVE BLOCK
file: /src/app/(authenticated)/supervisor/jobs/_components/JobForm.tsx
phase: phase3-feature-007
domain: supervisor
purpose: Job creation form component for authenticated supervisors
spec_ref: specs/007-integrate-job-creation-workflow
complexity_budget: 200
dependencies:
  internal:
    - '@/app/(authenticated)/supervisor/jobs/_utils/job-utils'
  external:
    - 'react'
    - 'lucide-react'
voice_considerations:
  - Form fields optimized for voice input
*/

import { Calendar, Clock, FileText, AlertCircle } from 'lucide-react';
import type { JobFormState } from '@/app/(authenticated)/supervisor/jobs/_utils/job-utils';

export interface CustomerOption {
  id: string;
  name: string;
}

export interface PropertyOption {
  id: string;
  name: string;
  address?: string;
}

export interface JobFormProps {
  draft: JobFormState;
  customers: CustomerOption[];
  properties: PropertyOption[];
  onDraftChange: <K extends keyof JobFormState>(field: K, value: JobFormState[K]) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export function JobForm({
  draft,
  customers,
  properties,
  onDraftChange,
  onSubmit,
  onClear,
  disabled
}: JobFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-white mb-4">Create New Job</h2>

      {/* Customer Selection */}
      <div>
        <label htmlFor="customer" className="form-label">
          Customer <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          id="customer"
          value={draft.customerId}
          onChange={(e) => onDraftChange('customerId', e.target.value)}
          className="input-field"
          disabled={disabled || customers.length === 0}
          required
        >
          <option value="">Select a customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      {/* Property Selection */}
      <div>
        <label htmlFor="property" className="form-label">
          Property
        </label>
        <select
          id="property"
          value={draft.propertyId}
          onChange={(e) => onDraftChange('propertyId', e.target.value)}
          className="input-field"
          disabled={disabled || properties.length === 0}
        >
          <option value="">No specific property</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name || property.address || 'Unnamed property'}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="form-label">
          Job Title <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          id="title"
          type="text"
          value={draft.title}
          onChange={(e) => onDraftChange('title', e.target.value)}
          placeholder="e.g., Lawn maintenance, Spring cleanup"
          className="input-field"
          disabled={disabled}
          required
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <textarea
          id="description"
          value={draft.description}
          onChange={(e) => onDraftChange('description', e.target.value)}
          placeholder="Detailed description of work to be performed..."
          rows={4}
          className="input-field"
          disabled={disabled}
        />
      </div>

      {/* Scheduled Date */}
      <div>
        <label htmlFor="scheduledDate" className="form-label">
          Scheduled Date <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          id="scheduledDate"
          type="date"
          value={draft.scheduledDate}
          onChange={(e) => onDraftChange('scheduledDate', e.target.value)}
          min={today}
          className="input-field"
          disabled={disabled}
          required
        />
      </div>

      {/* Scheduled Time */}
      <div>
        <label htmlFor="scheduledTime" className="form-label">
          Scheduled Time
        </label>
        <input
          id="scheduledTime"
          type="time"
          value={draft.scheduledTime}
          onChange={(e) => onDraftChange('scheduledTime', e.target.value)}
          className="input-field"
          disabled={disabled}
        />
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="priority" className="form-label">
          Priority
        </label>
        <select
          id="priority"
          value={draft.priority}
          onChange={(e) => onDraftChange('priority', e.target.value as 'low' | 'normal' | 'high' | 'urgent')}
          className="input-field"
          disabled={disabled}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="flex-1"
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            fontWeight: 600,
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            fontSize: '0.875rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={disabled || !draft.customerId || !draft.title || !draft.scheduledDate}
          className="flex-1"
          style={{
            padding: '0.75rem 1rem',
            background: '#FFD700',
            color: '#000',
            fontWeight: 600,
            borderRadius: '0.5rem',
            border: 'none',
            fontSize: '0.875rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
        >
          Create Job
        </button>
      </div>

      <style jsx>{`
        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #9CA3AF;
          margin-bottom: 0.5rem;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          color: white;
          font-size: 1rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .input-field::placeholder {
          color: #9CA3AF;
        }

        .input-field option {
          background: #111827;
          color: white;
        }
      `}</style>
    </form>
  );
}

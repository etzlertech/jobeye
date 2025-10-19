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

import { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, AlertCircle, ListChecks } from 'lucide-react';
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

export interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  job_type: string | null;
  items?: Array<{ id: string }>;
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
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await fetch('/api/task-templates');
      const data = await response.json();

      if (response.ok) {
        // Only show active templates
        const activeTemplates = (data.templates || []).filter((t: TemplateOption) => t.is_active !== false);
        setTemplates(activeTemplates);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  // Get selected template details
  const selectedTemplate = templates.find(t => t.id === draft.templateId);

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

      {/* Task Template Selection */}
      <div style={{
        background: 'rgba(255, 215, 0, 0.05)',
        border: '1px solid rgba(255, 215, 0, 0.2)',
        borderRadius: '0.5rem',
        padding: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <ListChecks style={{ width: '1.25rem', height: '1.25rem', color: '#FFD700' }} />
          <label htmlFor="template" className="form-label" style={{ marginBottom: 0 }}>
            Task Template (optional)
          </label>
        </div>
        <select
          id="template"
          value={draft.templateId}
          onChange={(e) => onDraftChange('templateId', e.target.value)}
          className="input-field"
          disabled={disabled || isLoadingTemplates}
        >
          <option value="">No template - add tasks later</option>
          {isLoadingTemplates ? (
            <option value="" disabled>Loading templates...</option>
          ) : (
            templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.items?.length || 0} tasks)
              </option>
            ))
          )}
        </select>
        {selectedTemplate && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
          }}>
            <div style={{ color: '#FFD700', fontWeight: 600, marginBottom: '0.25rem' }}>
              Preview
            </div>
            <div style={{ color: '#9CA3AF' }}>
              {selectedTemplate.items?.length || 0} tasks will be automatically added to this job
            </div>
            {selectedTemplate.description && (
              <div style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                {selectedTemplate.description}
              </div>
            )}
          </div>
        )}
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

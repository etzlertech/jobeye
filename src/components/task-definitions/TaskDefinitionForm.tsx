/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/task-definitions/TaskDefinitionForm.tsx
 * phase: 3.4
 * domain: task-definition
 * purpose: Form component for creating and editing task definitions
 * spec_ref: specs/014-add-task-management/spec.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: null
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/task-definition/types', '@/domains/task-definition/schemas'],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['TaskDefinitionForm', 'TaskDefinitionFormProps', 'TaskDefinitionFormData']
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/components/task-definitions/TaskDefinitionForm.test.tsx'
 * }
 * tasks: [
 *   'Provide form fields for all task definition properties',
 *   'Support create and edit modes',
 *   'Validate input with Zod schemas',
 *   'Handle form submission and errors',
 *   'Support cancel action'
 * ]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Camera, UserCheck, AlertCircle, Save, X } from 'lucide-react';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';
import {
  CreateTaskDefinitionSchema,
  UpdateTaskDefinitionSchema
} from '@/domains/task-definition/schemas/task-definition-schemas';
import type { ZodError } from 'zod';

export interface TaskDefinitionFormData {
  name: string;
  description: string;
  acceptance_criteria: string;
  requires_photo_verification: boolean;
  requires_supervisor_approval: boolean;
  is_required: boolean;
}

export interface TaskDefinitionFormProps {
  initialData?: Partial<TaskDefinition>;
  onSubmit: (data: TaskDefinitionFormData) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
  isSubmitting?: boolean;
  className?: string;
}

export function TaskDefinitionForm({
  initialData,
  onSubmit,
  onCancel,
  mode,
  isSubmitting = false,
  className = ''
}: TaskDefinitionFormProps) {
  // Form state
  const [formData, setFormData] = useState<TaskDefinitionFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    acceptance_criteria: initialData?.acceptance_criteria || '',
    requires_photo_verification: initialData?.requires_photo_verification || false,
    requires_supervisor_approval: initialData?.requires_supervisor_approval || false,
    is_required: initialData?.is_required ?? true
  });

  // Error state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');

  // Update form data when initialData changes (edit mode)
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        acceptance_criteria: initialData.acceptance_criteria || '',
        requires_photo_verification: initialData.requires_photo_verification || false,
        requires_supervisor_approval: initialData.requires_supervisor_approval || false,
        is_required: initialData.is_required ?? true
      });
    }
  }, [initialData]);

  // Handle input change
  const handleChange = (
    field: keyof TaskDefinitionFormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    setSubmitError('');
  };

  // Validate form
  const validateForm = (): boolean => {
    try {
      const schema = mode === 'create' ? CreateTaskDefinitionSchema : UpdateTaskDefinitionSchema;
      schema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof Error && 'errors' in error) {
        const zodError = error as ZodError;
        const fieldErrors: Record<string, string> = {};
        zodError.errors.forEach((err) => {
          const field = err.path[0]?.toString();
          if (field) {
            fieldErrors[field] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Validate
    if (!validateForm()) {
      return;
    }

    // Submit
    try {
      await onSubmit(formData);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to save task definition'
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      data-testid="task-definition-form"
    >
      {/* Form Header */}
      <div className="form-header">
        <h2 className="form-title">
          {mode === 'create' ? 'Create Task Definition' : 'Edit Task Definition'}
        </h2>
        <p className="form-subtitle">
          {mode === 'create'
            ? 'Create a reusable task that can be added to templates'
            : 'Update task definition details'}
        </p>
      </div>

      {/* Global error */}
      {submitError && (
        <div className="error-banner">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Error</p>
            <p className="text-sm mt-1">{submitError}</p>
          </div>
        </div>
      )}

      {/* Name field */}
      <div className="form-field">
        <label htmlFor="name" className="form-label">
          Task Name <span className="required">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={`form-input ${errors.name ? 'error' : ''}`}
          placeholder="e.g., Clean and sanitize equipment"
          disabled={isSubmitting}
          data-testid="task-name-input"
        />
        {errors.name && (
          <p className="field-error">{errors.name}</p>
        )}
      </div>

      {/* Description field */}
      <div className="form-field">
        <label htmlFor="description" className="form-label">
          Description <span className="required">*</span>
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className={`form-textarea ${errors.description ? 'error' : ''}`}
          placeholder="Describe what needs to be done..."
          disabled={isSubmitting}
          data-testid="task-description-input"
        />
        {errors.description && (
          <p className="field-error">{errors.description}</p>
        )}
      </div>

      {/* Acceptance criteria field */}
      <div className="form-field">
        <label htmlFor="acceptance_criteria" className="form-label">
          Acceptance Criteria
        </label>
        <textarea
          id="acceptance_criteria"
          value={formData.acceptance_criteria}
          onChange={(e) => handleChange('acceptance_criteria', e.target.value)}
          rows={3}
          className={`form-textarea ${errors.acceptance_criteria ? 'error' : ''}`}
          placeholder="How will we know this task is complete? (optional)"
          disabled={isSubmitting}
          data-testid="task-acceptance-criteria-input"
        />
        {errors.acceptance_criteria && (
          <p className="field-error">{errors.acceptance_criteria}</p>
        )}
      </div>

      {/* Task flags */}
      <div className="settings-section">
        <p className="settings-title">Task Settings</p>

        {/* Photo verification */}
        <label className="checkbox-card">
          <input
            type="checkbox"
            checked={formData.requires_photo_verification}
            onChange={(e) => handleChange('requires_photo_verification', e.target.checked)}
            className="checkbox-input"
            disabled={isSubmitting}
            data-testid="requires-photo-checkbox"
          />
          <div className="flex-1">
            <div className="checkbox-label">
              <Camera className="w-4 h-4" style={{ color: '#60A5FA' }} />
              <span className="text-sm font-medium">
                Requires Photo Verification
              </span>
            </div>
            <p className="checkbox-description">
              Employee must upload photo evidence when completing this task
            </p>
          </div>
        </label>

        {/* Supervisor approval */}
        <label className="checkbox-card">
          <input
            type="checkbox"
            checked={formData.requires_supervisor_approval}
            onChange={(e) => handleChange('requires_supervisor_approval', e.target.checked)}
            className="checkbox-input"
            disabled={isSubmitting}
            data-testid="requires-approval-checkbox"
          />
          <div className="flex-1">
            <div className="checkbox-label">
              <UserCheck className="w-4 h-4" style={{ color: '#C084FC' }} />
              <span className="text-sm font-medium">
                Requires Supervisor Approval
              </span>
            </div>
            <p className="checkbox-description">
              Supervisor must approve completion of this task
            </p>
          </div>
        </label>

        {/* Required task */}
        <label className="checkbox-card">
          <input
            type="checkbox"
            checked={formData.is_required}
            onChange={(e) => handleChange('is_required', e.target.checked)}
            className="checkbox-input"
            disabled={isSubmitting}
            data-testid="is-required-checkbox"
          />
          <div className="flex-1">
            <div className="checkbox-label">
              <AlertCircle className="w-4 h-4" style={{ color: '#FB923C' }} />
              <span className="text-sm font-medium">
                Required Task
              </span>
            </div>
            <p className="checkbox-description">
              This task must be completed (cannot be skipped)
            </p>
          </div>
        </label>
      </div>

      {/* Form actions */}
      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="btn-cancel"
          data-testid="cancel-button"
        >
          <X className="w-4 h-4 inline-block mr-1" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-submit"
          data-testid="submit-button"
        >
          {isSubmitting ? (
            <>
              <div className="inline-block w-4 h-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 inline-block mr-1" />
              {mode === 'create' ? 'Create Task' : 'Save Changes'}
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        .form-header {
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .form-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: white;
        }

        .form-subtitle {
          font-size: 0.875rem;
          color: #9CA3AF;
          margin-top: 0.25rem;
        }

        .error-banner {
          margin: 1rem;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.5rem;
          display: flex;
          align-items: start;
          gap: 0.75rem;
          color: #FCA5A5;
        }

        .form-field {
          margin: 1rem;
        }

        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
          margin-bottom: 0.25rem;
        }

        .required {
          color: #EF4444;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 0.875rem;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: rgba(255, 215, 0, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .form-input.error,
        .form-textarea.error {
          border-color: rgba(239, 68, 68, 0.5);
        }

        .form-input:disabled,
        .form-textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: #6B7280;
        }

        .field-error {
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: #FCA5A5;
        }

        .settings-section {
          margin: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .settings-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
          margin-bottom: 0.5rem;
        }

        .checkbox-card {
          display: flex;
          align-items: start;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          cursor: pointer;
        }

        .checkbox-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.3);
        }

        .checkbox-input {
          margin-top: 0.25rem;
          height: 1rem;
          width: 1rem;
          accent-color: #FFD700;
          cursor: pointer;
        }

        .checkbox-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: white;
        }

        .checkbox-description {
          font-size: 0.75rem;
          color: #9CA3AF;
          margin-top: 0.25rem;
        }

        .form-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1rem;
          border-top: 1px solid #333;
        }

        .btn-cancel {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
          cursor: pointer;
        }

        .btn-cancel:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .btn-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-submit {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #000;
          background: #FFD700;
          border: 1px solid transparent;
          border-radius: 0.5rem;
          cursor: pointer;
        }

        .btn-submit:hover {
          background: #FFC700;
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}

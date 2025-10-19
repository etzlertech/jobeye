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
      className={`bg-white rounded-lg border border-gray-200 shadow-sm p-6 ${className}`}
      data-testid="task-definition-form"
    >
      {/* Form Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {mode === 'create' ? 'Create Task Definition' : 'Edit Task Definition'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {mode === 'create'
            ? 'Create a reusable task that can be added to templates'
            : 'Update task definition details'}
        </p>
      </div>

      {/* Global error */}
      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{submitError}</p>
          </div>
        </div>
      )}

      {/* Name field */}
      <div className="mb-4">
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Task Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g., Clean and sanitize equipment"
          disabled={isSubmitting}
          data-testid="task-name-input"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Description field */}
      <div className="mb-4">
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.description ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Describe what needs to be done..."
          disabled={isSubmitting}
          data-testid="task-description-input"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description}</p>
        )}
      </div>

      {/* Acceptance criteria field */}
      <div className="mb-6">
        <label
          htmlFor="acceptance_criteria"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Acceptance Criteria
        </label>
        <textarea
          id="acceptance_criteria"
          value={formData.acceptance_criteria}
          onChange={(e) => handleChange('acceptance_criteria', e.target.value)}
          rows={3}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.acceptance_criteria ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="How will we know this task is complete? (optional)"
          disabled={isSubmitting}
          data-testid="task-acceptance-criteria-input"
        />
        {errors.acceptance_criteria && (
          <p className="mt-1 text-sm text-red-600">{errors.acceptance_criteria}</p>
        )}
      </div>

      {/* Task flags */}
      <div className="mb-6 space-y-3">
        <p className="text-sm font-medium text-gray-700 mb-3">Task Settings</p>

        {/* Photo verification */}
        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.requires_photo_verification}
            onChange={(e) => handleChange('requires_photo_verification', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={isSubmitting}
            data-testid="requires-photo-checkbox"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                Requires Photo Verification
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Employee must upload photo evidence when completing this task
            </p>
          </div>
        </label>

        {/* Supervisor approval */}
        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.requires_supervisor_approval}
            onChange={(e) => handleChange('requires_supervisor_approval', e.target.checked)}
            className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            disabled={isSubmitting}
            data-testid="requires-approval-checkbox"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">
                Requires Supervisor Approval
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Supervisor must approve completion of this task
            </p>
          </div>
        </label>

        {/* Required task */}
        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_required}
            onChange={(e) => handleChange('is_required', e.target.checked)}
            className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            disabled={isSubmitting}
            data-testid="is-required-checkbox"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-gray-900">
                Required Task
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              This task must be completed (cannot be skipped)
            </p>
          </div>
        </label>
      </div>

      {/* Form actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="cancel-button"
        >
          <X className="w-4 h-4 inline-block mr-1" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </form>
  );
}

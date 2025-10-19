/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/task-definitions/TaskDefinitionDetail.tsx
 * phase: 3.4
 * domain: task-definition
 * purpose: Detail view component for task definitions with edit mode
 * spec_ref: specs/014-add-task-management/spec.md
 * complexity_budget: 250
 * migrations_touched: []
 * state_machine: null
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/task-definition/types', '@/components/task-definitions/TaskDefinitionForm'],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['TaskDefinitionDetail', 'TaskDefinitionDetailProps']
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/components/task-definitions/TaskDefinitionDetail.test.tsx'
 * }
 * tasks: [
 *   'Display all task definition details',
 *   'Support view and edit modes',
 *   'Show usage statistics',
 *   'Handle delete with confirmation',
 *   'Display audit trail (created/updated info)'
 * ]
 */

'use client';

import React, { useState } from 'react';
import {
  Camera,
  UserCheck,
  AlertCircle,
  Edit,
  Trash2,
  ArrowLeft,
  CheckCircle,
  Calendar,
  User
} from 'lucide-react';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';
import { TaskDefinitionForm, type TaskDefinitionFormData } from './TaskDefinitionForm';

export interface TaskDefinitionDetailProps {
  taskDefinition: TaskDefinition;
  onUpdate?: (data: TaskDefinitionFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onBack?: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
  usageCount?: number;
  className?: string;
}

export function TaskDefinitionDetail({
  taskDefinition,
  onUpdate,
  onDelete,
  onBack,
  isUpdating = false,
  isDeleting = false,
  usageCount = 0,
  className = ''
}: TaskDefinitionDetailProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handle update
  const handleUpdate = async (data: TaskDefinitionFormData) => {
    if (onUpdate) {
      await onUpdate(data);
      setIsEditMode(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (onDelete) {
      await onDelete();
    }
  };

  // Edit mode
  if (isEditMode) {
    return (
      <div className={className}>
        <TaskDefinitionForm
          initialData={taskDefinition}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditMode(false)}
          mode="edit"
          isSubmitting={isUpdating}
        />
      </div>
    );
  }

  // View mode
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Back button */}
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3"
                data-testid="back-button"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to list
              </button>
            )}

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {taskDefinition.name}
            </h1>

            {/* Acceptance criteria indicator */}
            {taskDefinition.acceptance_criteria && (
              <p className="text-sm text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Has acceptance criteria defined
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            {onUpdate && !taskDefinition.deleted_at && (
              <button
                onClick={() => setIsEditMode(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                data-testid="edit-button"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
            {onDelete && !taskDefinition.deleted_at && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={usageCount > 0 || isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={usageCount > 0 ? `Cannot delete: Used in ${usageCount} template(s)` : 'Delete task definition'}
                data-testid="delete-button"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Task Definition?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "{taskDefinition.name}"? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                data-testid="cancel-delete-button"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDelete();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700"
                data-testid="confirm-delete-button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Deleted indicator */}
        {taskDefinition.deleted_at && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800">
              This task definition has been deleted and cannot be used in new templates.
            </p>
          </div>
        )}

        {/* Usage warning */}
        {usageCount > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800">
              This task definition is used in {usageCount} template{usageCount !== 1 ? 's' : ''} and cannot be deleted.
            </p>
          </div>
        )}

        {/* Description */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {taskDefinition.description}
          </p>
        </div>

        {/* Acceptance criteria */}
        {taskDefinition.acceptance_criteria && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              Acceptance Criteria
            </h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {taskDefinition.acceptance_criteria}
            </p>
          </div>
        )}

        {/* Task settings */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Task Settings</h2>
          <div className="flex flex-wrap gap-2">
            {taskDefinition.requires_photo_verification && (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-100 text-blue-800">
                <Camera className="w-4 h-4" />
                Photo Verification Required
              </span>
            )}

            {taskDefinition.requires_supervisor_approval && (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-purple-100 text-purple-800">
                <UserCheck className="w-4 h-4" />
                Supervisor Approval Required
              </span>
            )}

            {taskDefinition.is_required ? (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-orange-100 text-orange-800">
                <AlertCircle className="w-4 h-4" />
                Required Task
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800">
                Optional Task
              </span>
            )}
          </div>
        </div>

        {/* Audit trail */}
        <div className="pt-4 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Audit Trail</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                Created:{' '}
                {new Date(taskDefinition.created_at).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </span>
            </div>
            {taskDefinition.created_by && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Created by: {taskDefinition.created_by}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                Last updated:{' '}
                {new Date(taskDefinition.updated_at).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </span>
            </div>
            {taskDefinition.deleted_at && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-red-600">
                  Deleted:{' '}
                  {new Date(taskDefinition.deleted_at).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

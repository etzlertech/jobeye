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
    <div className={className}>
      {/* Header */}
      <div className="header-section">
        <div className="header-content">
          <div className="flex-1 min-w-0">
            {/* Back button */}
            {onBack && (
              <button
                onClick={onBack}
                className="back-button"
                data-testid="back-button"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to list
              </button>
            )}

            {/* Title */}
            <h1 className="title">
              {taskDefinition.name}
            </h1>

            {/* Acceptance criteria indicator */}
            {taskDefinition.acceptance_criteria && (
              <p className="criteria-badge">
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
                className="btn-secondary-small"
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
                className="btn-delete"
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
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">
              Delete Task Definition?
            </h3>
            <p className="modal-text">
              Are you sure you want to delete "{taskDefinition.name}"? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
                data-testid="cancel-delete-button"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDelete();
                }}
                className="btn-delete"
                data-testid="confirm-delete-button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="content-section">
        {/* Deleted indicator */}
        {taskDefinition.deleted_at && (
          <div className="notification error">
            <p className="text-sm font-medium">
              This task definition has been deleted and cannot be used in new templates.
            </p>
          </div>
        )}

        {/* Usage warning */}
        {usageCount > 0 && (
          <div className="notification info">
            <p className="text-sm font-medium">
              This task definition is used in {usageCount} template{usageCount !== 1 ? 's' : ''} and cannot be deleted.
            </p>
          </div>
        )}

        {/* Description */}
        <div className="section">
          <h2 className="section-title">Description</h2>
          <p className="section-text">
            {taskDefinition.description}
          </p>
        </div>

        {/* Acceptance criteria */}
        {taskDefinition.acceptance_criteria && (
          <div className="section">
            <h2 className="section-title">
              Acceptance Criteria
            </h2>
            <p className="section-text">
              {taskDefinition.acceptance_criteria}
            </p>
          </div>
        )}

        {/* Task settings */}
        <div className="section">
          <h2 className="section-title">Task Settings</h2>
          <div className="flex flex-wrap gap-2">
            {taskDefinition.requires_photo_verification && (
              <span className="badge badge-blue">
                <Camera className="w-4 h-4" />
                Photo Verification Required
              </span>
            )}

            {taskDefinition.requires_supervisor_approval && (
              <span className="badge badge-purple">
                <UserCheck className="w-4 h-4" />
                Supervisor Approval Required
              </span>
            )}

            {taskDefinition.is_required ? (
              <span className="badge badge-orange">
                <AlertCircle className="w-4 h-4" />
                Required Task
              </span>
            ) : (
              <span className="badge badge-gray">
                Optional Task
              </span>
            )}
          </div>
        </div>

        {/* Audit trail */}
        <div className="section border-top">
          <h2 className="section-title">Audit Trail</h2>
          <div className="audit-trail">
            <div className="audit-item">
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
              <div className="audit-item">
                <User className="w-4 h-4" />
                <span>Created by: {taskDefinition.created_by}</span>
              </div>
            )}
            <div className="audit-item">
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
              <div className="audit-item">
                <Calendar className="w-4 h-4" />
                <span className="text-red" style={{ color: '#EF4444' }}>
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

      <style jsx>{`
        .header-section {
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .header-content {
          display: flex;
          align-items: start;
          justify-content: space-between;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #FFD700;
          margin-bottom: 0.75rem;
          background: none;
          border: none;
          cursor: pointer;
        }

        .back-button:hover {
          color: #FFC700;
        }

        .title {
          font-size: 1.25rem;
          font-weight: 600;
          color: white;
          margin-bottom: 0.5rem;
        }

        .criteria-badge {
          font-size: 0.875rem;
          color: #10B981;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .btn-secondary-small {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
          cursor: pointer;
        }

        .btn-secondary-small:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 215, 0, 0.5);
        }

        .btn-delete {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
          background: #DC2626;
          border: 1px solid transparent;
          border-radius: 0.5rem;
          cursor: pointer;
        }

        .btn-delete:hover {
          background: #B91C1C;
        }

        .btn-delete:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }

        .modal-content {
          background: #1A1A1A;
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          max-width: 28rem;
          width: 100%;
          margin: 1rem;
          padding: 1.5rem;
        }

        .modal-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: white;
          margin-bottom: 0.5rem;
        }

        .modal-text {
          font-size: 0.875rem;
          color: #9CA3AF;
          margin-bottom: 1.5rem;
        }

        .modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .btn-secondary {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .content-section {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .notification {
          padding: 1rem;
          border-radius: 0.5rem;
        }

        .notification.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #FCA5A5;
        }

        .notification.info {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #93C5FD;
        }

        .section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .section.border-top {
          padding-top: 1rem;
          border-top: 1px solid #333;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
        }

        .section-text {
          font-size: 0.875rem;
          color: #9CA3AF;
          white-space: pre-wrap;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .badge-blue {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60A5FA;
        }

        .badge-purple {
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #C084FC;
        }

        .badge-orange {
          background: rgba(251, 146, 60, 0.1);
          border: 1px solid rgba(251, 146, 60, 0.3);
          color: #FB923C;
        }

        .badge-gray {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #9CA3AF;
        }

        .audit-trail {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #9CA3AF;
        }

        .audit-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}

/*
AGENT DIRECTIVE BLOCK
file: /src/app/(authenticated)/supervisor/jobs/_components/TaskEditor.tsx
phase: phase3-feature-011
domain: supervisor
purpose: Task editor for creating and editing individual workflow tasks
spec_ref: specs/011-making-task-lists/TASK_TEMPLATE_MANAGEMENT_PLAN.md
complexity_budget: 300
dependencies:
  internal:
    - '@/domains/workflow-task/types/workflow-task-types'
  external:
    - 'react'
    - 'lucide-react'
voice_considerations:
  - Support voice input for task description
  - Voice confirmation for task creation/updates
*/

import { useState, useEffect } from 'react';
import { Plus, Edit, X, CheckCircle, AlertCircle } from 'lucide-react';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';

export interface TaskEditorProps {
  jobId: string;
  task?: WorkflowTask | null; // If editing existing task
  mode: 'create' | 'edit';
  onSuccess: () => void;
  onCancel: () => void;
}

export function TaskEditor({
  jobId,
  task,
  mode,
  onSuccess,
  onCancel
}: TaskEditorProps) {
  const [taskDescription, setTaskDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresSupervisorApproval, setRequiresSupervisorApproval] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load task data if editing
  useEffect(() => {
    if (mode === 'edit' && task) {
      setTaskDescription(task.task_description || '');
      setAcceptanceCriteria(task.acceptance_criteria || '');
      setIsRequired(task.is_required ?? true);
      setRequiresPhoto(task.requires_photo_verification ?? false);
      setRequiresSupervisorApproval(task.requires_supervisor_approval ?? false);
    }
  }, [mode, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!taskDescription.trim()) {
      setError('Task description is required');
      return;
    }

    try {
      setIsSaving(true);

      if (mode === 'create') {
        // Create new task
        const payload: Record<string, any> = {
          task_description: taskDescription.trim(),
          is_required: isRequired,
          requires_photo_verification: requiresPhoto,
          requires_supervisor_approval: requiresSupervisorApproval,
        };

        // Only include acceptance_criteria if not empty (Zod schema expects undefined or string, not null)
        if (acceptanceCriteria.trim()) {
          payload.acceptance_criteria = acceptanceCriteria.trim();
        }

        const response = await fetch(`/api/supervisor/jobs/${jobId}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to create task');
        }

        setSuccess('Task created successfully');
      } else if (mode === 'edit' && task) {
        // Update existing task
        const payload: Record<string, any> = {
          task_description: taskDescription.trim(),
          is_required: isRequired,
          requires_photo_verification: requiresPhoto,
          requires_supervisor_approval: requiresSupervisorApproval,
        };

        // Only include acceptance_criteria if not empty (Zod schema expects undefined or string, not null)
        if (acceptanceCriteria.trim()) {
          payload.acceptance_criteria = acceptanceCriteria.trim();
        }

        const response = await fetch(`/api/supervisor/jobs/${jobId}/tasks/${task.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to update task');
        }

        setSuccess('Task updated successfully');
      }

      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} task`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="task-editor-container">
      <div className="task-editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {mode === 'create' ? (
            <Plus className="w-5 h-5" style={{ color: '#FFD700' }} />
          ) : (
            <Edit className="w-5 h-5" style={{ color: '#FFD700' }} />
          )}
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'white' }}>
            {mode === 'create' ? 'Add Custom Task' : 'Edit Task'}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="close-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="notification success">
          <CheckCircle className="w-4 h-4" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="task-editor-form">
        {/* Task Description */}
        <div className="form-group">
          <label htmlFor="task-description" className="form-label">
            Task Description <span className="required-indicator">*</span>
          </label>
          <textarea
            id="task-description"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Describe what needs to be done..."
            rows={3}
            className="form-textarea"
            disabled={isSaving}
            required
          />
        </div>

        {/* Acceptance Criteria */}
        <div className="form-group">
          <label htmlFor="acceptance-criteria" className="form-label">
            Acceptance Criteria (optional)
          </label>
          <textarea
            id="acceptance-criteria"
            value={acceptanceCriteria}
            onChange={(e) => setAcceptanceCriteria(e.target.value)}
            placeholder="How will we know this task is complete?"
            rows={2}
            className="form-textarea"
            disabled={isSaving}
          />
        </div>

        {/* Checkboxes */}
        <div className="checkboxes-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              disabled={isSaving}
              className="checkbox-input"
            />
            <span>Required Task</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={requiresPhoto}
              onChange={(e) => setRequiresPhoto(e.target.checked)}
              disabled={isSaving}
              className="checkbox-input"
            />
            <span>Requires Photo Verification</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={requiresSupervisorApproval}
              onChange={(e) => setRequiresSupervisorApproval(e.target.checked)}
              disabled={isSaving}
              className="checkbox-input"
            />
            <span>Requires Supervisor Approval</span>
          </label>
        </div>

        {/* Actions */}
        <div className="actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !taskDescription.trim()}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : mode === 'create' ? 'Add Task' : 'Save Changes'}
          </button>
        </div>
      </form>

      <style jsx>{`
        .task-editor-container {
          background: rgba(0, 0, 0, 0.95);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.75rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .task-editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .close-btn {
          padding: 0.25rem;
          background: transparent;
          border: none;
          color: #9CA3AF;
          cursor: pointer;
          border-radius: 0.25rem;
          transition: all 0.2s;
        }

        .close-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .close-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notification {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }

        .notification.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .notification.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .task-editor-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #9CA3AF;
        }

        .required-indicator {
          color: #ef4444;
        }

        .form-textarea {
          width: 100%;
          padding: 0.75rem;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          font-family: inherit;
          resize: vertical;
        }

        .form-textarea:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .form-textarea::placeholder {
          color: #6B7280;
        }

        .checkboxes-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .checkbox-input {
          width: 1.125rem;
          height: 1.125rem;
          cursor: pointer;
          accent-color: #FFD700;
        }

        .actions {
          display: flex;
          gap: 0.75rem;
          padding-top: 0.5rem;
        }

        .btn-secondary, .btn-primary {
          flex: 1;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }

        .btn-primary {
          background: #FFD700;
          color: #000;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled, .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

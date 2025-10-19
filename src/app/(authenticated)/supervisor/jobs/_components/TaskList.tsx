/*
AGENT DIRECTIVE BLOCK
file: /src/app/(authenticated)/supervisor/jobs/_components/TaskList.tsx
phase: phase3-feature-011
domain: supervisor
purpose: Task list component displaying workflow tasks for a job
spec_ref: specs/011-making-task-lists/TASK_TEMPLATE_MANAGEMENT_PLAN.md
complexity_budget: 250
dependencies:
  internal:
    - '@/domains/workflow-task/types/workflow-task-types'
  external:
    - 'react'
    - 'lucide-react'
voice_considerations:
  - Display task status clearly for voice readback
  - Support voice commands for task actions
*/

import { useState } from 'react';
import { CheckCircle, Circle, XCircle, Edit, Trash2, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import type { WorkflowTask, TaskStatus } from '@/domains/workflow-task/types/workflow-task-types';

export interface TaskListProps {
  tasks: WorkflowTask[];
  editable?: boolean;
  onEdit?: (task: WorkflowTask) => void;
  onDelete?: (taskId: string) => void;
  onReorder?: (taskId: string, direction: 'up' | 'down') => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
}

export function TaskList({
  tasks,
  editable = false,
  onEdit,
  onDelete,
  onReorder,
  onStatusChange
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in-progress':
        return <Circle className="w-5 h-5 text-blue-500" style={{ fill: 'currentColor' }} />;
      case 'failed':
      case 'skipped':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'complete':
        return '#22c55e';
      case 'in-progress':
        return '#3b82f6';
      case 'failed':
      case 'skipped':
        return '#ef4444';
      default:
        return '#9CA3AF';
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => a.task_order - b.task_order);

  if (tasks.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#9CA3AF',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '0.5rem',
        border: '1px solid rgba(255, 215, 0, 0.2)'
      }}>
        <AlertCircle className="w-12 h-12 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
        <p>No tasks yet. Add tasks from a template or create custom tasks.</p>
      </div>
    );
  }

  return (
    <div className="task-list-container">
      {sortedTasks.map((task, index) => {
        const isExpanded = expandedTasks.has(task.id);
        const canMoveUp = index > 0;
        const canMoveDown = index < sortedTasks.length - 1;

        return (
          <div key={task.id} className="task-item">
            {/* Task Header */}
            <div className="task-header" onClick={() => toggleExpanded(task.id)}>
              <div className="task-header-left">
                <span className="task-order">#{task.task_order + 1}</span>
                {getStatusIcon(task.status)}
                <span className="task-description">{task.task_description}</span>
                {task.is_required && (
                  <span className="required-badge">Required</span>
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="task-details">
                <div className="task-detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value" style={{ color: getStatusColor(task.status) }}>
                    {task.status.replace('-', ' ')}
                  </span>
                </div>

                {task.acceptance_criteria && (
                  <div className="task-detail-row">
                    <span className="detail-label">Acceptance Criteria:</span>
                    <p className="detail-value">{task.acceptance_criteria}</p>
                  </div>
                )}

                {task.requires_photo_verification && (
                  <div className="task-detail-row">
                    <span className="detail-label">Photo Required:</span>
                    <span className="detail-value">Yes</span>
                  </div>
                )}

                {task.requires_supervisor_approval && (
                  <div className="task-detail-row">
                    <span className="detail-label">Supervisor Approval:</span>
                    <span className="detail-value">Required</span>
                  </div>
                )}

                {task.completed_at && (
                  <div className="task-detail-row">
                    <span className="detail-label">Completed:</span>
                    <span className="detail-value">{new Date(task.completed_at).toLocaleString()}</span>
                  </div>
                )}

                {task.supervisor_notes && (
                  <div className="task-detail-row">
                    <span className="detail-label">Supervisor Notes:</span>
                    <p className="detail-value">{task.supervisor_notes}</p>
                  </div>
                )}

                {/* Actions (only if editable) */}
                {editable && (
                  <div className="task-actions">
                    {onReorder && (
                      <div className="task-reorder-buttons">
                        <button
                          type="button"
                          onClick={() => onReorder(task.id, 'up')}
                          disabled={!canMoveUp}
                          className="icon-btn"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onReorder(task.id, 'down')}
                          disabled={!canMoveDown}
                          className="icon-btn"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(task)}
                        className="action-btn edit-btn"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(task.id)}
                        className="action-btn delete-btn"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <style jsx>{`
        .task-list-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .task-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          overflow: hidden;
          transition: all 0.2s;
        }

        .task-item:hover {
          border-color: rgba(255, 215, 0, 0.4);
        }

        .task-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .task-header:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .task-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .task-order {
          font-size: 0.75rem;
          font-weight: 600;
          color: #FFD700;
          min-width: 2rem;
        }

        .task-description {
          font-size: 0.875rem;
          color: white;
          flex: 1;
        }

        .required-badge {
          padding: 0.125rem 0.5rem;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 600;
          color: #fca5a5;
          text-transform: uppercase;
        }

        .task-details {
          padding: 0 1rem 1rem 1rem;
          border-top: 1px solid rgba(255, 215, 0, 0.1);
          background: rgba(0, 0, 0, 0.2);
        }

        .task-detail-row {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-top: 0.75rem;
        }

        .detail-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #9CA3AF;
          text-transform: uppercase;
        }

        .detail-value {
          font-size: 0.875rem;
          color: white;
          text-transform: capitalize;
        }

        .task-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 215, 0, 0.1);
        }

        .task-reorder-buttons {
          display: flex;
          gap: 0.25rem;
          margin-right: auto;
        }

        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.375rem;
          background: rgba(255, 255, 255, 0.1);
          color: #FFD700;
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-btn:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.2);
        }

        .icon-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .action-btn {
          display: flex;
          align-items: center;
          padding: 0.375rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .edit-btn {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-color: rgba(59, 130, 246, 0.3);
        }

        .edit-btn:hover {
          background: rgba(59, 130, 246, 0.3);
        }

        .delete-btn {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.3);
        }
      `}</style>
    </div>
  );
}

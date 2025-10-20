/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/task-definitions/TaskDefinitionCard.tsx
 * phase: 3.4
 * domain: task-definition
 * purpose: Task definition card component for library display
 * spec_ref: specs/014-add-task-management/spec.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: null
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/task-definition/types'],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['TaskDefinitionCard', 'TaskDefinitionCardProps']
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/components/task-definitions/TaskDefinitionCard.test.tsx'
 * }
 * tasks: [
 *   'Display task definition with name, description, and flags',
 *   'Show photo verification and supervisor approval badges',
 *   'Support click to view details',
 *   'Include edit and delete actions'
 * ]
 */

'use client';

import React from 'react';
import {
  Camera,
  UserCheck,
  AlertCircle,
  Edit,
  Trash2,
  CheckCircle
} from 'lucide-react';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';

export interface TaskDefinitionCardProps {
  taskDefinition: TaskDefinition;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  className?: string;
}

export function TaskDefinitionCard({
  taskDefinition,
  onEdit,
  onDelete,
  onClick,
  className = ''
}: TaskDefinitionCardProps) {

  const handleClick = () => {
    onClick?.(taskDefinition.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(taskDefinition.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(taskDefinition.id);
  };

  return (
    <div
      className={`task-definition-card ${onClick ? 'clickable' : ''} ${className}`}
      onClick={handleClick}
      data-testid={`task-definition-card-${taskDefinition.id}`}
    >
      {/* Header */}
      <div className="card-header">
        <div className="card-title-section">
          <h3 className="card-title">{taskDefinition.name}</h3>
          {taskDefinition.acceptance_criteria && (
            <div className="criteria-badge">
              <CheckCircle className="w-3 h-3" />
              <span>Criteria</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card-actions">
          {onEdit && (
            <button
              onClick={handleEdit}
              className="action-btn edit-btn"
              aria-label="Edit task definition"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="action-btn delete-btn"
              aria-label="Delete task definition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="card-description">{taskDefinition.description}</p>

      {/* Flags */}
      <div className="card-badges">
        {taskDefinition.requires_photo_verification && (
          <span className="badge photo-badge">
            <Camera className="w-3 h-3" />
            Photo
          </span>
        )}

        {taskDefinition.requires_supervisor_approval && (
          <span className="badge approval-badge">
            <UserCheck className="w-3 h-3" />
            Approval
          </span>
        )}

        {taskDefinition.is_required ? (
          <span className="badge required-badge">
            <AlertCircle className="w-3 h-3" />
            Required
          </span>
        ) : (
          <span className="badge optional-badge">
            Optional
          </span>
        )}
      </div>

      {/* Soft deleted indicator */}
      {taskDefinition.deleted_at && (
        <div className="deleted-overlay">
          <span className="deleted-badge">Deleted</span>
        </div>
      )}

      <style jsx>{`
        .task-definition-card {
          position: relative;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 0.75rem;
          transition: all 0.2s;
        }

        .task-definition-card.clickable {
          cursor: pointer;
        }

        .task-definition-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .card-title-section {
          flex: 1;
          min-width: 0;
          margin-right: 0.5rem;
        }

        .card-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          margin: 0 0 0.25rem 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .criteria-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.375rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 0.25rem;
          color: #22c55e;
          font-size: 0.625rem;
          font-weight: 600;
        }

        .card-actions {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex-shrink: 0;
        }

        .action-btn {
          padding: 0.25rem;
          background: transparent;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .edit-btn {
          color: #FFD700;
        }

        .edit-btn:hover {
          background: rgba(255, 215, 0, 0.1);
        }

        .delete-btn {
          color: #ef4444;
        }

        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .card-description {
          font-size: 0.75rem;
          color: #9CA3AF;
          margin: 0 0 0.5rem 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 600;
        }

        .photo-badge {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
        }

        .approval-badge {
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #c084fc;
        }

        .required-badge {
          background: rgba(249, 115, 22, 0.1);
          border: 1px solid rgba(249, 115, 22, 0.3);
          color: #fb923c;
        }

        .optional-badge {
          background: rgba(156, 163, 175, 0.1);
          border: 1px solid rgba(156, 163, 175, 0.3);
          color: #9ca3af;
        }

        .deleted-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .deleted-badge {
          background: #ef4444;
          color: white;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
          border-radius: 0.375rem;
        }
      `}</style>
    </div>
  );
}

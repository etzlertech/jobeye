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
      className={`
        relative bg-white rounded-lg border border-gray-200 shadow-sm
        hover:shadow-md transition-all duration-200 p-4
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={handleClick}
      data-testid={`task-definition-card-${taskDefinition.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {taskDefinition.name}
          </h3>
          {taskDefinition.acceptance_criteria && (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Has acceptance criteria
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          {onEdit && (
            <button
              onClick={handleEdit}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Edit task definition"
              title="Edit"
            >
              <Edit className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-50 rounded transition-colors"
              aria-label="Delete task definition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
        {taskDefinition.description}
      </p>

      {/* Flags */}
      <div className="flex flex-wrap gap-2">
        {taskDefinition.requires_photo_verification && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Camera className="w-3 h-3" />
            Photo Required
          </span>
        )}

        {taskDefinition.requires_supervisor_approval && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <UserCheck className="w-3 h-3" />
            Supervisor Approval
          </span>
        )}

        {taskDefinition.is_required ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <AlertCircle className="w-3 h-3" />
            Required
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Optional
          </span>
        )}
      </div>

      {/* Soft deleted indicator */}
      {taskDefinition.deleted_at && (
        <div className="absolute top-0 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-10 rounded-lg flex items-center justify-center">
          <span className="bg-red-500 text-white text-xs font-medium px-3 py-1 rounded-full">
            Deleted
          </span>
        </div>
      )}
    </div>
  );
}

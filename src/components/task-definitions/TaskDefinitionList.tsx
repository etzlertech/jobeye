/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/task-definitions/TaskDefinitionList.tsx
 * phase: 3.4
 * domain: task-definition
 * purpose: List component for displaying task definition cards
 * spec_ref: specs/014-add-task-management/spec.md
 * complexity_budget: 150
 * migrations_touched: []
 * state_machine: null
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/task-definition/types', '@/components/task-definitions/TaskDefinitionCard'],
 *   external: ['react'],
 *   supabase: []
 * }
 * exports: ['TaskDefinitionList', 'TaskDefinitionListProps']
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/components/task-definitions/TaskDefinitionList.test.tsx'
 * }
 * tasks: [
 *   'Display grid of task definition cards',
 *   'Handle empty state',
 *   'Support loading state',
 *   'Pass through event handlers to cards'
 * ]
 */

'use client';

import React from 'react';
import { TaskDefinitionCard } from './TaskDefinitionCard';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';
import { AlertCircle } from 'lucide-react';

export interface TaskDefinitionListProps {
  taskDefinitions: TaskDefinition[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  loading?: boolean;
  className?: string;
}

export function TaskDefinitionList({
  taskDefinitions,
  onEdit,
  onDelete,
  onClick,
  loading = false,
  className = ''
}: TaskDefinitionListProps) {

  // Loading state
  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600">Loading task definitions...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (taskDefinitions.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No task definitions found
          </h3>
          <p className="text-sm text-gray-600">
            Create your first task definition to get started. Task definitions are reusable tasks that can be added to templates.
          </p>
        </div>
      </div>
    );
  }

  // Grid display
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
      data-testid="task-definition-list"
    >
      {taskDefinitions.map((taskDefinition) => (
        <TaskDefinitionCard
          key={taskDefinition.id}
          taskDefinition={taskDefinition}
          onEdit={onEdit}
          onDelete={onDelete}
          onClick={onClick}
        />
      ))}
    </div>
  );
}

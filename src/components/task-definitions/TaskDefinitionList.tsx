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
 *   external: ['react', 'lucide-react'],
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
import { FileText, Loader2 } from 'lucide-react';

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
      <div className={`empty-state ${className}`}>
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" style={{ color: '#FFD700' }} />
        <p className="text-gray-400">Loading task definitions...</p>
        <style jsx>{`
          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }
        `}</style>
      </div>
    );
  }

  // Empty state
  if (taskDefinitions.length === 0) {
    return (
      <div className={`empty-state ${className}`}>
        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 mb-1 font-semibold">No task definitions yet</p>
        <p className="text-gray-500 text-sm">
          Create reusable task definitions to add to templates
        </p>
        <style jsx>{`
          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }
        `}</style>
      </div>
    );
  }

  // List display
  return (
    <div
      className={`space-y-2 pt-4 ${className}`}
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

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
import { EntityTile } from '@/components/ui/EntityTile';
import { EntityTileGrid } from '@/components/ui/EntityTileGrid';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';
import { FileText, Loader2, Camera, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';

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

  // For loading or empty states, pass to EntityTileGrid
  return (
    <div className={`pt-4 ${className}`} data-testid="task-definition-list">
      <EntityTileGrid
        emptyState={{
          icon: loading ? <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#FFD700' }} /> : <FileText className="w-12 h-12" />,
          message: loading ? 'Loading task definitions...' : 'No task definitions yet'
        }}
      >
        {taskDefinitions.map((taskDefinition) => {
          // Build tags array
          const tags = [];

          // Photo verification tag
          if (taskDefinition.requires_photo_verification) {
            tags.push({
              label: 'Photo',
              color: 'blue' as const,
              icon: <Camera className="w-3 h-3" />
            });
          }

          // Supervisor approval tag
          if (taskDefinition.requires_supervisor_approval) {
            tags.push({
              label: 'Approval',
              color: 'purple' as const,
              icon: <UserCheck className="w-3 h-3" />
            });
          }

          // Required/Optional tag
          if (taskDefinition.is_required) {
            tags.push({
              label: 'Required',
              color: 'orange' as const,
              icon: <AlertCircle className="w-3 h-3" />
            });
          } else {
            tags.push({
              label: 'Optional',
              color: 'gray' as const
            });
          }

          // Acceptance criteria tag
          if (taskDefinition.acceptance_criteria) {
            tags.push({
              label: 'Criteria',
              color: 'green' as const,
              icon: <CheckCircle className="w-3 h-3" />
            });
          }

          return (
            <EntityTile
              key={taskDefinition.id}
              fallbackIcon={<FileText />}
              title={taskDefinition.name}
              subtitle={taskDefinition.description}
              tags={tags}
              onClick={() => onClick?.(taskDefinition.id)}
            />
          );
        })}
      </EntityTileGrid>
    </div>
  );
}

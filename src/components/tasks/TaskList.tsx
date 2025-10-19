/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/tasks/TaskList.tsx
 * phase: 3.8
 * domain: components
 * purpose: Display and manage workflow tasks for a job with offline support
 * spec_ref: specs/011-making-task-lists/spec.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "render": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/workflow-task/types/workflow-task-types'],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['TaskList', 'TaskListProps']
 * voice_considerations: All text can be read via TTS, task numbers for voice navigation
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/components/tasks/TaskList.test.tsx'
 * }
 * tasks: [
 *   'Fetch tasks from API for given jobId',
 *   'Display tasks ordered by task_order',
 *   'Support offline mode with IndexedDB fallback',
 *   'Show task status, required/optional indicators'
 * ]
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  RefreshCw,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';

export interface TaskListProps {
  jobId: string;
  editable?: boolean;
  onTaskComplete?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  className?: string;
}

interface TaskListState {
  tasks: WorkflowTask[];
  loading: boolean;
  error: string | null;
  isOffline: boolean;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Circle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  'in-progress': {
    label: 'In Progress',
    icon: RefreshCw,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  complete: {
    label: 'Complete',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  skipped: {
    label: 'Skipped',
    icon: AlertCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
  },
  failed: {
    label: 'Failed',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

export function TaskList({
  jobId,
  editable = false,
  onTaskComplete,
  onTaskDelete,
  className = '',
}: TaskListProps) {
  const [state, setState] = useState<TaskListState>({
    tasks: [],
    loading: true,
    error: null,
    isOffline: false,
  });

  useEffect(() => {
    loadTasks();
  }, [jobId]);

  const loadTasks = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`/api/jobs/${jobId}/tasks`);

      if (!response.ok) {
        throw new Error(`Failed to load tasks: ${response.statusText}`);
      }

      const data = await response.json();
      const tasks = data.tasks || [];

      setState({
        tasks: tasks.sort((a: WorkflowTask, b: WorkflowTask) => a.task_order - b.task_order),
        loading: false,
        error: null,
        isOffline: false,
      });
    } catch (error) {
      console.error('[TaskList] Error loading tasks:', error);

      // TODO: Fallback to IndexedDB for offline support
      setState({
        tasks: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load tasks',
        isOffline: !navigator.onLine,
      });
    }
  };

  const handleTaskComplete = (taskId: string) => {
    onTaskComplete?.(taskId);
    // Optimistically update UI
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: 'complete' as WorkflowTask['status'], completed_at: new Date().toISOString() }
          : task
      ),
    }));
  };

  const handleTaskDelete = (taskId: string) => {
    onTaskDelete?.(taskId);
    // Optimistically remove from UI
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== taskId),
    }));
  };

  const getCompletionStats = () => {
    const total = state.tasks.length;
    const completed = state.tasks.filter((t) => t.status === 'complete').length;
    const requiredTotal = state.tasks.filter((t) => t.is_required).length;
    const requiredCompleted = state.tasks.filter(
      (t) => t.is_required && t.status === 'complete'
    ).length;

    return { total, completed, requiredTotal, requiredCompleted };
  };

  if (state.loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600">Loading tasks...</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error Loading Tasks</h3>
            <p className="text-sm text-red-700 mt-1">{state.error}</p>
            {state.isOffline && (
              <div className="flex items-center gap-1 mt-2 text-sm text-orange-700">
                <WifiOff className="w-4 h-4" />
                <span>You appear to be offline</span>
              </div>
            )}
            <button
              onClick={loadTasks}
              className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.tasks.length === 0) {
    return (
      <div className={`p-8 text-center border border-gray-200 rounded-lg bg-gray-50 ${className}`}>
        <Circle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 mb-1">No Tasks Yet</h3>
        <p className="text-sm text-gray-600">
          Tasks will appear here once they are added to this job.
        </p>
      </div>
    );
  }

  const stats = getCompletionStats();

  return (
    <div className={className} data-testid="task-list">
      {/* Completion Stats Header */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-900">Task Progress</h3>
            <p className="text-sm text-blue-700">
              {stats.completed} of {stats.total} tasks complete
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
            </div>
            <div className="text-xs text-blue-700">
              Required: {stats.requiredCompleted}/{stats.requiredTotal}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 w-full bg-blue-100 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: stats.total > 0 ? `${(stats.completed / stats.total) * 100}%` : '0%',
            }}
          />
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {state.tasks.map((task, index) => {
          const status = statusConfig[task.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={task.id}
              className={`
                p-3 border rounded-lg transition-all duration-200
                ${status.bgColor} ${status.borderColor}
                ${editable ? 'hover:shadow-md cursor-pointer' : ''}
              `}
              data-testid={`task-${task.id}`}
              data-task-order={task.task_order}
            >
              <div className="flex items-start gap-3">
                {/* Task Number & Icon */}
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full ${status.bgColor} border-2 ${status.borderColor} flex items-center justify-center`}>
                    <StatusIcon className={`w-4 h-4 ${status.color}`} />
                  </div>
                  <div className="text-xs text-center mt-1 font-semibold text-gray-600">
                    #{index + 1}
                  </div>
                </div>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {task.task_description}
                      </h4>

                      {/* Badges */}
                      <div className="flex items-center gap-2 mt-1">
                        {task.is_required && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Required
                          </span>
                        )}
                        {task.requires_photo_verification && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            Photo Required
                          </span>
                        )}
                        {task.requires_supervisor_approval && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            Supervisor Approval
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Acceptance Criteria */}
                      {task.acceptance_criteria && (
                        <p className="text-sm text-gray-600 mt-2 italic">
                          {task.acceptance_criteria}
                        </p>
                      )}

                      {/* Completion Info */}
                      {task.completed_at && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>
                            Completed {new Date(task.completed_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {editable && task.status !== 'complete' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTaskComplete(task.id)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 transition-colors"
                          aria-label={`Complete task ${index + 1}`}
                        >
                          Complete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

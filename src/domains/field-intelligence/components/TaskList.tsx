/**
 * @file src/domains/field-intelligence/components/TaskList.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Parsed task display and management with inline editing
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface Task {
  id: string;
  jobId: string;
  taskDescription: string;
  confidence: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  estimatedDurationMinutes?: number;
  assignedTo?: string;
  createdAt: string;
}

interface TaskListProps {
  jobId: string;
  userId?: string;
  editable?: boolean;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (taskId: string) => void;
  className?: string;
}

/**
 * TaskList - Display and manage parsed tasks
 *
 * Features:
 * - Real-time task fetching
 * - Inline editing
 * - Status management
 * - Confidence scoring display
 * - Task deletion
 *
 * @example
 * ```tsx
 * <TaskList
 *   jobId={job.id}
 *   userId={user.id}
 *   editable={true}
 *   onTaskUpdate={(id, updates) => console.log('Updated:', id, updates)}
 *   onTaskDelete={(id) => console.log('Deleted:', id)}
 * />
 * ```
 */
export function TaskList({
  jobId,
  userId,
  editable = false,
  onTaskUpdate,
  onTaskDelete,
  className = '',
}: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedDescription, setEditedDescription] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [jobId]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/field-intelligence/workflows/parse-tasks?jobId=${jobId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();

      if (data.data && data.data.tasks) {
        setTasks(data.data.tasks);
      } else {
        setTasks([]);
      }
    } catch (err: any) {
      logger.error('Failed to fetch tasks', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(
        '/api/field-intelligence/workflows/parse-tasks',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            status: newStatus,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task');
      }

      // Update local state
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );

      logger.info('Task status updated', { taskId, newStatus });

      if (onTaskUpdate) {
        onTaskUpdate(taskId, { status: newStatus });
      }
    } catch (err: any) {
      logger.error('Failed to update task status', { error: err });
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleEditStart = (task: Task) => {
    setEditingTaskId(task.id);
    setEditedDescription(task.taskDescription);
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditedDescription('');
  };

  const handleEditSave = async (taskId: string) => {
    if (!editedDescription.trim()) {
      setError('Task description cannot be empty');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(
        '/api/field-intelligence/workflows/parse-tasks',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            taskDescription: editedDescription,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task');
      }

      // Update local state
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, taskDescription: editedDescription }
            : task
        )
      );

      logger.info('Task description updated', { taskId });

      if (onTaskUpdate) {
        onTaskUpdate(taskId, { taskDescription: editedDescription });
      }

      setEditingTaskId(null);
      setEditedDescription('');
    } catch (err: any) {
      logger.error('Failed to update task description', { error: err });
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/field-intelligence/workflows/parse-tasks?taskId=${taskId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete task');
      }

      // Remove from local state
      setTasks((prev) => prev.filter((task) => task.id !== taskId));

      logger.info('Task deleted', { taskId });

      if (onTaskDelete) {
        onTaskDelete(taskId);
      }
    } catch (err: any) {
      logger.error('Failed to delete task', { error: err });
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PENDING':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className={`task-list ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`task-list ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchTasks}
            className="mt-2 text-red-700 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={`task-list ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No tasks found for this job</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`task-list ${className}`}>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {editingTaskId === task.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSave(task.id)}
                        disabled={updating}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleEditCancel}
                        disabled={updating}
                        className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-900 font-medium mb-1">
                      {task.taskDescription}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Created {formatDate(task.createdAt)}</span>
                      <span className={getConfidenceColor(task.confidence)}>
                        {task.confidence}% confidence
                      </span>
                      {task.estimatedDurationMinutes && (
                        <span>~{task.estimatedDurationMinutes}m</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 items-end">
                {/* Status Badge */}
                <select
                  value={task.status}
                  onChange={(e) =>
                    handleStatusChange(task.id, e.target.value as Task['status'])
                  }
                  disabled={updating || editingTaskId === task.id}
                  className={`px-3 py-1 text-xs font-medium rounded border ${getStatusColor(
                    task.status
                  )} disabled:opacity-50`}
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>

                {/* Actions */}
                {editable && editingTaskId !== task.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditStart(task)}
                      disabled={updating}
                      className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      disabled={updating}
                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
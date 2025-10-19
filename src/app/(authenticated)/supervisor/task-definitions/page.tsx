/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/(authenticated)/supervisor/task-definitions/page.tsx
 * phase: 3.4
 * domain: task-definition
 * purpose: List page for managing task definitions
 * spec_ref: specs/014-add-task-management/spec.md
 * complexity_budget: 250
 * migrations_touched: []
 * state_machine: null
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/task-definition/types', '@/components/task-definitions/*'],
 *   external: ['react', 'next/navigation', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['default']
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/app/supervisor/task-definitions/page.test.tsx'
 * }
 * tasks: [
 *   'Fetch task definitions from API',
 *   'Display list with TaskDefinitionList component',
 *   'Handle create navigation',
 *   'Handle detail navigation',
 *   'Handle delete with API call',
 *   'Show loading and error states'
 * ]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, AlertCircle } from 'lucide-react';
import { TaskDefinitionList } from '@/components/task-definitions/TaskDefinitionList';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';

export default function TaskDefinitionsPage() {
  const router = useRouter();
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string>('');

  // Fetch task definitions
  useEffect(() => {
    fetchTaskDefinitions();
  }, []);

  const fetchTaskDefinitions = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/task-definitions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch task definitions');
      }

      const { data } = await response.json();
      setTaskDefinitions(data);
    } catch (err) {
      console.error('Error fetching task definitions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load task definitions');
    } finally {
      setLoading(false);
    }
  };

  // Handle create
  const handleCreate = () => {
    router.push('/supervisor/task-definitions/new');
  };

  // Handle view detail
  const handleViewDetail = (id: string) => {
    router.push(`/supervisor/task-definitions/${id}`);
  };

  // Handle edit
  const handleEdit = (id: string) => {
    router.push(`/supervisor/task-definitions/${id}`);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    setDeleteError('');

    // Find task for confirmation
    const task = taskDefinitions.find((t) => t.id === id);
    if (!task) return;

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${task.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/task-definitions/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === 'IN_USE') {
          setDeleteError(
            `Cannot delete "${task.name}": ${errorData.error}`
          );
          return;
        }
        throw new Error(errorData.error || 'Failed to delete task definition');
      }

      // Refresh list
      await fetchTaskDefinitions();
    } catch (err) {
      console.error('Error deleting task definition:', err);
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete task definition'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Task Definitions</h1>
              <p className="text-sm text-gray-600 mt-1">
                Create and manage reusable task definitions that can be added to templates
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              data-testid="create-task-definition-button"
            >
              <Plus className="w-4 h-4" />
              Create Task Definition
            </button>
          </div>
        </div>

        {/* Global error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error Loading Task Definitions</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={fetchTaskDefinitions}
                className="mt-2 text-sm font-medium text-red-800 underline hover:text-red-900"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Delete error */}
        {deleteError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error Deleting Task</p>
              <p className="text-sm text-red-700 mt-1">{deleteError}</p>
              <button
                onClick={() => setDeleteError('')}
                className="mt-2 text-sm font-medium text-red-800 underline hover:text-red-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Task definitions list */}
        <TaskDefinitionList
          taskDefinitions={taskDefinitions}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClick={handleViewDetail}
          loading={loading}
        />
      </div>
    </div>
  );
}

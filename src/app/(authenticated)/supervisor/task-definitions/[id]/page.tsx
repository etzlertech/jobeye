/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/(authenticated)/supervisor/task-definitions/[id]/page.tsx
 * phase: 3.4
 * domain: task-definition
 * purpose: Detail and edit page for individual task definition
 * spec_ref: specs/014-add-task-management/spec.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: null
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/task-definition/types', '@/components/task-definitions/TaskDefinitionDetail'],
 *   external: ['react', 'next/navigation', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['default']
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/app/supervisor/task-definitions/[id]/page.test.tsx'
 * }
 * tasks: [
 *   'Fetch task definition by ID',
 *   'Fetch usage statistics',
 *   'Display with TaskDefinitionDetail component',
 *   'Handle update via API',
 *   'Handle delete via API',
 *   'Handle navigation back to list',
 *   'Show loading and error states'
 * ]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { TaskDefinitionDetail } from '@/components/task-definitions/TaskDefinitionDetail';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';
import type { TaskDefinitionFormData } from '@/components/task-definitions/TaskDefinitionForm';

export default function TaskDefinitionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [taskDefinition, setTaskDefinition] = useState<TaskDefinition | null>(null);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch task definition and usage
  useEffect(() => {
    if (id) {
      fetchTaskDefinition();
      fetchUsage();
    }
  }, [id]);

  const fetchTaskDefinition = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/task-definitions/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Task definition not found');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch task definition');
      }

      const { data } = await response.json();
      setTaskDefinition(data);
    } catch (err) {
      console.error('Error fetching task definition:', err);
      setError(err instanceof Error ? err.message : 'Failed to load task definition');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const response = await fetch(`/api/task-definitions/${id}/usage`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { data } = await response.json();
        setUsageCount(data.templateCount || 0);
      }
    } catch (err) {
      console.error('Error fetching usage:', err);
      // Don't show error for usage - it's not critical
    }
  };

  // Handle update
  const handleUpdate = async (data: TaskDefinitionFormData) => {
    try {
      setIsUpdating(true);

      const response = await fetch(`/api/task-definitions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task definition');
      }

      const { data: updated } = await response.json();
      setTaskDefinition(updated);
    } catch (err) {
      console.error('Error updating task definition:', err);
      throw err; // Re-throw to be caught by form
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await fetch(`/api/task-definitions/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === 'IN_USE') {
          throw new Error(
            `Cannot delete: This task is used in ${errorData.details?.templateCount || 'multiple'} template(s)`
          );
        }
        throw new Error(errorData.error || 'Failed to delete task definition');
      }

      // Navigate back to list
      router.push('/supervisor/task-definitions');
    } catch (err) {
      console.error('Error deleting task definition:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete task definition');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle back
  const handleBack = () => {
    router.push('/supervisor/task-definitions');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600">Loading task definition...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error Loading Task Definition</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={fetchTaskDefinition}
                  className="text-sm font-medium text-red-800 underline hover:text-red-900"
                >
                  Try again
                </button>
                <button
                  onClick={handleBack}
                  className="text-sm font-medium text-red-800 underline hover:text-red-900"
                >
                  Back to list
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!taskDefinition) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-800">Task definition not found</p>
            <button
              onClick={handleBack}
              className="mt-2 text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
            >
              Back to list
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Detail view
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <TaskDefinitionDetail
          taskDefinition={taskDefinition}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onBack={handleBack}
          isUpdating={isUpdating}
          isDeleting={isDeleting}
          usageCount={usageCount}
        />
      </div>
    </div>
  );
}

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
 *   internal: ['@/domains/task-definition/types', '@/components/task-definitions/TaskDefinitionDetail', '@/components/navigation/MobileNavigation'],
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
import { AlertCircle, Loader2, X } from 'lucide-react';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
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
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading task definition...</p>
          </div>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 0 0.5rem;
            box-sizing: border-box;
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mobile-container">
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/')}
        />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="notification-bar error">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Error Loading Task Definition</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="ml-auto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 0 0.5rem;
            box-sizing: border-box;
          }

          .notification-bar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
          }

          .notification-bar.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
          }
        `}</style>
      </div>
    );
  }

  // Detail view
  return (
    <div className="mobile-container">
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
      />

      <div className="flex-1 overflow-y-auto">
        {taskDefinition && (
          <TaskDefinitionDetail
            taskDefinition={taskDefinition}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onBack={handleBack}
            isUpdating={isUpdating}
            isDeleting={isDeleting}
            usageCount={usageCount}
          />
        )}
      </div>

      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 0.5rem;
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}

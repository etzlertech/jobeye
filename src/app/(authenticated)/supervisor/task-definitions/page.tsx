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
 *   internal: ['@/domains/task-definition/types', '@/components/task-definitions/*', '@/components/navigation/MobileNavigation'],
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
import { Plus, AlertCircle, ArrowLeft, X, CheckCircle, Loader2 } from 'lucide-react';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { TaskDefinitionList } from '@/components/task-definitions/TaskDefinitionList';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';

export default function TaskDefinitionsPage() {
  const router = useRouter();
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

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

      setSuccess('Task definition deleted successfully');
      setTimeout(() => setSuccess(''), 3000);

      // Refresh list
      await fetchTaskDefinitions();
    } catch (err) {
      console.error('Error deleting task definition:', err);
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete task definition'
      );
    }
  };

  if (loading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading task definitions...</p>
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

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Task Definitions</h1>
          <p className="text-xs text-gray-500">{taskDefinitions.length} total</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {deleteError && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError('')}
            className="ml-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="notification-bar success">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <TaskDefinitionList
          taskDefinitions={taskDefinitions}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClick={handleViewDetail}
          loading={false}
        />
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push('/supervisor')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <button
          type="button"
          onClick={handleCreate}
          className="btn-primary flex-1"
          data-testid="create-task-definition-button"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create
        </button>
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

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .notification-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 1rem;
          border-radius: 0.5rem;
        }

        .notification-bar.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .notification-bar.success {
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          color: #FFD700;
        }

        .bottom-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.9);
          border-top: 1px solid #333;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }
      `}</style>
    </div>
  );
}

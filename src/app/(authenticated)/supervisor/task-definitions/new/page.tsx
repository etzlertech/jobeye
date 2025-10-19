/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/(authenticated)/supervisor/task-definitions/new/page.tsx
 * phase: 3.4
 * domain: task-definition
 * purpose: Create page for new task definitions
 * spec_ref: specs/014-add-task-management/spec.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: null
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/components/task-definitions/TaskDefinitionForm'],
 *   external: ['react', 'next/navigation'],
 *   supabase: []
 * }
 * exports: ['default']
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/app/supervisor/task-definitions/new/page.test.tsx'
 * }
 * tasks: [
 *   'Display TaskDefinitionForm in create mode',
 *   'Handle form submission via POST API',
 *   'Navigate to detail page on success',
 *   'Handle cancel navigation',
 *   'Show error states'
 * ]
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TaskDefinitionForm, type TaskDefinitionFormData } from '@/components/task-definitions/TaskDefinitionForm';

export default function CreateTaskDefinitionPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle create
  const handleCreate = async (data: TaskDefinitionFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch('/api/task-definitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create task definition');
      }

      const { data: created } = await response.json();

      // Navigate to detail page
      router.push(`/supervisor/task-definitions/${created.id}`);
    } catch (err) {
      console.error('Error creating task definition:', err);
      throw err; // Re-throw to be caught by form
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push('/supervisor/task-definitions');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <TaskDefinitionForm
          onSubmit={handleCreate}
          onCancel={handleCancel}
          mode="create"
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}

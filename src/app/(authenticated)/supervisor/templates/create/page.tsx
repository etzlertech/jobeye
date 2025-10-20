/**
 * @file src/app/(authenticated)/supervisor/templates/create/page.tsx
 * @purpose Create new task template page for supervisors
 * @phase Phase 1 - Template Management
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  Save,
  BookOpen
} from 'lucide-react';
import { TaskDefinitionLibraryModal } from '@/components/task-definitions/TaskDefinitionLibraryModal';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';

interface TemplateItemInput {
  tempId: string; // Temporary ID for React keys
  task_order: number;
  task_description: string;
  is_required: boolean;
  requires_photo_verification: boolean;
  requires_supervisor_approval: boolean;
  acceptance_criteria: string;
  source_definition_id?: string; // Reference to task_definition if created from library
}

export default function CreateTemplatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jobType, setJobType] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<TemplateItemInput[]>([]);

  // Library modal state
  const [showLibrary, setShowLibrary] = useState(false);

  const addItem = () => {
    const newItem: TemplateItemInput = {
      tempId: `temp-${Date.now()}`,
      task_order: items.length,
      task_description: '',
      is_required: false,
      requires_photo_verification: false,
      requires_supervisor_approval: false,
      acceptance_criteria: '',
    };
    setItems([...items, newItem]);
  };

  const updateItem = (tempId: string, updates: Partial<TemplateItemInput>) => {
    setItems(items.map(item =>
      item.tempId === tempId ? { ...item, ...updates } : item
    ));
  };

  const removeItem = (tempId: string) => {
    const newItems = items.filter(item => item.tempId !== tempId);
    // Reorder remaining items
    newItems.forEach((item, index) => {
      item.task_order = index;
    });
    setItems(newItems);
  };

  const moveItem = (tempId: string, direction: 'up' | 'down') => {
    const index = items.findIndex(item => item.tempId === tempId);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const newItems = [...items];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap items
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];

    // Update task_order
    newItems.forEach((item, idx) => {
      item.task_order = idx;
    });

    setItems(newItems);
  };

  const handleSelectDefinition = (definition: TaskDefinition) => {
    const newItem: TemplateItemInput = {
      tempId: `temp-${Date.now()}`,
      task_order: items.length,
      task_description: `${definition.name}: ${definition.description}`,
      is_required: definition.is_required,
      requires_photo_verification: definition.requires_photo_verification,
      requires_supervisor_approval: definition.requires_supervisor_approval,
      acceptance_criteria: definition.acceptance_criteria || '',
      source_definition_id: definition.id,
    };
    setItems([...items, newItem]);
    setShowLibrary(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one task item');
      return;
    }

    const emptyItems = items.filter(item => !item.task_description.trim());
    if (emptyItems.length > 0) {
      setError('All task items must have a description');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare payload
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        job_type: jobType.trim() || null,
        is_active: isActive,
        items: items.map(item => ({
          task_order: item.task_order,
          task_description: item.task_description.trim(),
          is_required: item.is_required,
          requires_photo_verification: item.requires_photo_verification,
          requires_supervisor_approval: item.requires_supervisor_approval,
          acceptance_criteria: item.acceptance_criteria.trim() || null,
          source_definition_id: item.source_definition_id || null,
        })),
      };

      const response = await fetch('/api/task-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create template');
      }

      // Success - navigate back to template list
      router.push('/supervisor/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <h1 className="text-xl font-semibold">Create Template</h1>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Template Metadata */}
          <div className="form-section">
            <h2 className="section-title">Template Details</h2>

            <div className="form-field">
              <label htmlFor="name" className="form-label">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard Inspection"
                className="input-field"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this template..."
                rows={3}
                className="input-field"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="jobType" className="form-label">
                Job Type (optional)
              </label>
              <input
                id="jobType"
                type="text"
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                placeholder="e.g., inspection, maintenance, lawn_care"
                className="input-field"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Used to filter templates when creating jobs
              </p>
            </div>

            <div className="form-field">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="checkbox"
                  disabled={isSubmitting}
                />
                <span className="form-label mb-0">Active Template</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Only active templates can be used when creating jobs
              </p>
            </div>
          </div>

          {/* Task Items */}
          <div className="form-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title mb-0">Task Items</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLibrary(true)}
                  className="btn-add-item"
                  disabled={isSubmitting}
                  title="Add task from library"
                >
                  <BookOpen className="w-4 h-4 mr-1" />
                  Library
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="btn-add-item"
                  disabled={isSubmitting}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Task
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="empty-items">
                <p className="text-gray-400 text-sm">No tasks added yet</p>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 px-4 py-2 bg-[#FFD700] text-black font-semibold rounded-lg hover:bg-[#FFC700]"
                  disabled={isSubmitting}
                >
                  Add First Task
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.tempId} className="task-item-card">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveItem(item.tempId, 'up')}
                          disabled={index === 0 || isSubmitting}
                          className="move-button"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <GripVertical className="w-4 h-4 text-gray-500" />
                        <button
                          type="button"
                          onClick={() => moveItem(item.tempId, 'down')}
                          disabled={index === items.length - 1 || isSubmitting}
                          className="move-button"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="form-label text-xs">
                            {index + 1}. Task Description <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.task_description}
                            onChange={(e) => updateItem(item.tempId, { task_description: e.target.value })}
                            placeholder="e.g., Check equipment operation"
                            className="input-field text-sm"
                            required
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.is_required}
                              onChange={(e) => updateItem(item.tempId, { is_required: e.target.checked })}
                              className="checkbox-sm"
                              disabled={isSubmitting}
                            />
                            <span className="text-gray-300">Required</span>
                          </label>

                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.requires_photo_verification}
                              onChange={(e) => updateItem(item.tempId, { requires_photo_verification: e.target.checked })}
                              className="checkbox-sm"
                              disabled={isSubmitting}
                            />
                            <span className="text-gray-300">Photo</span>
                          </label>

                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.requires_supervisor_approval}
                              onChange={(e) => updateItem(item.tempId, { requires_supervisor_approval: e.target.checked })}
                              className="checkbox-sm"
                              disabled={isSubmitting}
                            />
                            <span className="text-gray-300">Approval</span>
                          </label>
                        </div>

                        <div>
                          <label className="form-label text-xs">Acceptance Criteria</label>
                          <input
                            type="text"
                            value={item.acceptance_criteria}
                            onChange={(e) => updateItem(item.tempId, { acceptance_criteria: e.target.value })}
                            placeholder="e.g., All equipment operational"
                            className="input-field text-sm"
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.tempId)}
                        className="delete-button"
                        title="Remove task"
                        disabled={isSubmitting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Cancel
        </button>
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={isSubmitting || !name.trim() || items.length === 0}
          className="btn-primary flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Create Template
            </>
          )}
        </button>
      </div>

      {/* Task Definition Library Modal */}
      <TaskDefinitionLibraryModal
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSelect={handleSelectDefinition}
      />

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

        .form-section {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 1rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #FFD700;
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-field {
          margin-bottom: 1rem;
        }

        .form-field:last-child {
          margin-bottom: 0;
        }

        .form-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: #9CA3AF;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .input-field::placeholder {
          color: #6b7280;
        }

        .input-field:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .checkbox {
          width: 1.25rem;
          height: 1.25rem;
          border-radius: 0.25rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          background: #111827;
          cursor: pointer;
        }

        .checkbox:checked {
          background: #FFD700;
          border-color: #FFD700;
        }

        .checkbox-sm {
          width: 1rem;
          height: 1rem;
          border-radius: 0.25rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          background: #111827;
          cursor: pointer;
        }

        .checkbox-sm:checked {
          background: #FFD700;
          border-color: #FFD700;
        }

        .btn-add-item {
          display: flex;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.375rem;
          color: #FFD700;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-add-item:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.2);
          border-color: #FFD700;
        }

        .btn-add-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty-items {
          text-align: center;
          padding: 2rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
        }

        .task-item-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 0.75rem;
        }

        .move-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.25rem;
          color: #FFD700;
          font-size: 0.625rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .move-button:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.1);
          border-color: #FFD700;
        }

        .move-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .delete-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.375rem;
          color: #ef4444;
          cursor: pointer;
          transition: all 0.2s;
        }

        .delete-button:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
        }

        .delete-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }

        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

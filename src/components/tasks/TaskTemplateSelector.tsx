/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/tasks/TaskTemplateSelector.tsx
 * phase: 3.8
 * domain: components
 * purpose: Select and instantiate task templates for a job
 * spec_ref: specs/011-making-task-lists/spec.md
 * complexity_budget: 250
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "render": "$0.00 (no AI calls)"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: ['@/domains/task-template/types/task-template-types'],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['TaskTemplateSelector', 'TaskTemplateSelectorProps']
 * voice_considerations: Template names readable via TTS
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/components/tasks/TaskTemplateSelector.test.tsx'
 * }
 * tasks: [
 *   'Fetch available templates from API',
 *   'Display templates in dropdown or grid',
 *   'Filter by job_type if provided',
 *   'Handle template instantiation callback'
 * ]
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ListChecks,
} from 'lucide-react';
import type { TaskTemplate } from '@/domains/task-template/types/task-template-types';

export interface TaskTemplateSelectorProps {
  jobId: string;
  jobType?: string;
  onSelect?: (templateId: string) => void;
  onInstantiate?: (templateId: string, taskCount: number) => void;
  className?: string;
  compact?: boolean;
}

interface SelectorState {
  templates: TaskTemplate[];
  loading: boolean;
  error: string | null;
  selectedTemplateId: string | null;
  instantiating: boolean;
}

export function TaskTemplateSelector({
  jobId,
  jobType,
  onSelect,
  onInstantiate,
  className = '',
  compact = false,
}: TaskTemplateSelectorProps) {
  const [state, setState] = useState<SelectorState>({
    templates: [],
    loading: true,
    error: null,
    selectedTemplateId: null,
    instantiating: false,
  });

  useEffect(() => {
    loadTemplates();
  }, [jobType]);

  const loadTemplates = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/task-templates?includeInactive=false');

      if (!response.ok) {
        throw new Error(`Failed to load templates: ${response.statusText}`);
      }

      const data = await response.json();
      let templates = data.templates || [];

      // Filter by job_type if provided
      if (jobType) {
        templates = templates.filter(
          (t: TaskTemplate) => !t.job_type || t.job_type === jobType
        );
      }

      setState((prev) => ({
        ...prev,
        templates,
        loading: false,
        error: null,
      }));
    } catch (error) {
      console.error('[TaskTemplateSelector] Error loading templates:', error);
      setState((prev) => ({
        ...prev,
        templates: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load templates',
      }));
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setState((prev) => ({ ...prev, selectedTemplateId: templateId }));
    onSelect?.(templateId);
  };

  const handleInstantiate = async () => {
    if (!state.selectedTemplateId) return;

    setState((prev) => ({ ...prev, instantiating: true, error: null }));

    try {
      const response = await fetch(
        `/api/task-templates/${state.selectedTemplateId}/instantiate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to instantiate template');
      }

      const data = await response.json();
      const taskCount = data.tasks?.length || data.count || 0;

      onInstantiate?.(state.selectedTemplateId, taskCount);

      // Reset selection
      setState((prev) => ({
        ...prev,
        selectedTemplateId: null,
        instantiating: false,
      }));
    } catch (error) {
      console.error('[TaskTemplateSelector] Error instantiating template:', error);
      setState((prev) => ({
        ...prev,
        instantiating: false,
        error: error instanceof Error ? error.message : 'Failed to instantiate template',
      }));
    }
  };

  if (state.loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
        <span className="ml-2 text-sm text-gray-600">Loading templates...</span>
      </div>
    );
  }

  if (state.error && state.templates.length === 0) {
    return (
      <div className={`p-3 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900 text-sm">Error Loading Templates</h4>
            <p className="text-xs text-red-700 mt-1">{state.error}</p>
            <button
              onClick={loadTemplates}
              className="mt-2 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.templates.length === 0) {
    return (
      <div className={`p-4 text-center border border-gray-200 rounded-lg bg-gray-50 ${className}`}>
        <ClipboardList className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          {jobType
            ? `No templates available for ${jobType} jobs`
            : 'No task templates available'}
        </p>
      </div>
    );
  }

  const selectedTemplate = state.templates.find((t) => t.id === state.selectedTemplateId);

  if (compact) {
    // Compact dropdown view
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="block text-sm font-medium text-gray-700">
          Select Task Template
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={state.selectedTemplateId || ''}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={state.instantiating}
            >
              <option value="">Choose a template...</option>
              {state.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.job_type ? ` (${template.job_type})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={handleInstantiate}
            disabled={!state.selectedTemplateId || state.instantiating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {state.instantiating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              'Apply'
            )}
          </button>
        </div>

        {state.error && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {state.error}
          </p>
        )}
      </div>
    );
  }

  // Full card grid view
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Select a Task Template</h3>
        {jobType && (
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {jobType} jobs
          </span>
        )}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {state.templates.map((template) => {
          const isSelected = template.id === state.selectedTemplateId;

          return (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template.id)}
              disabled={state.instantiating}
              className={`
                p-3 border-2 rounded-lg text-left transition-all
                ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                }
                ${state.instantiating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-start gap-2">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  {isSelected ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : (
                    <ListChecks className="w-5 h-5 text-gray-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {template.name}
                  </h4>
                  {template.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {template.job_type && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded">
                        {template.job_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Apply Button */}
      {state.selectedTemplateId && (
        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={handleInstantiate}
            disabled={state.instantiating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {state.instantiating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Applying Template...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>
                  Apply "{selectedTemplate?.name}" to Job
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {state.error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
}

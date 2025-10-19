/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/task-definitions/TaskDefinitionLibraryModal.tsx
 * phase: 3.4
 * domain: task-definition
 * purpose: Modal for browsing and selecting task definitions from library
 * spec_ref: specs/014-add-task-management/spec.md (T036)
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: null
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/task-definition/types'],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['TaskDefinitionLibraryModal', 'TaskDefinitionLibraryModalProps']
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/components/task-definitions/TaskDefinitionLibraryModal.test.tsx'
 * }
 * tasks: [
 *   'Display modal with list of task definitions',
 *   'Support search/filter',
 *   'Handle selection',
 *   'Show task details on hover/click'
 * ]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, CheckSquare, Camera, UserCheck, AlertCircle } from 'lucide-react';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';

export interface TaskDefinitionLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (definition: TaskDefinition) => void;
  className?: string;
}

export function TaskDefinitionLibraryModal({
  isOpen,
  onClose,
  onSelect,
  className = ''
}: TaskDefinitionLibraryModalProps) {
  const [definitions, setDefinitions] = useState<TaskDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch task definitions when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDefinitions();
    }
  }, [isOpen]);

  const fetchDefinitions = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/task-definitions');
      if (!response.ok) {
        throw new Error('Failed to load task definitions');
      }

      const { data } = await response.json();
      setDefinitions(data || []);
    } catch (err) {
      console.error('Error fetching task definitions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load definitions');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (definition: TaskDefinition) => {
    onSelect(definition);
    onClose();
  };

  const filteredDefinitions = definitions.filter(
    (def) =>
      def.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      def.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Task Library</h2>
            <p className="text-sm text-gray-600 mt-1">Select a task definition to add to your template</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search task definitions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-600">Loading definitions...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && filteredDefinitions.length === 0 && (
            <div className="text-center py-12">
              <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {searchQuery ? 'No definitions match your search' : 'No task definitions available'}
              </p>
            </div>
          )}

          {!loading && !error && filteredDefinitions.length > 0 && (
            <div className="space-y-2">
              {filteredDefinitions.map((definition) => (
                <button
                  key={definition.id}
                  onClick={() => handleSelect(definition)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{definition.name}</h3>
                    <div className="flex gap-1">
                      {definition.requires_photo_verification && (
                        <Camera className="w-4 h-4 text-blue-600" aria-label="Photo required" />
                      )}
                      {definition.requires_supervisor_approval && (
                        <UserCheck className="w-4 h-4 text-purple-600" aria-label="Supervisor approval required" />
                      )}
                      {definition.is_required && (
                        <AlertCircle className="w-4 h-4 text-orange-600" aria-label="Required task" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{definition.description}</p>
                  {definition.acceptance_criteria && (
                    <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                      <CheckSquare className="w-3 h-3" />
                      Has acceptance criteria
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-600">
            {filteredDefinitions.length} definition{filteredDefinitions.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
    </div>
  );
}

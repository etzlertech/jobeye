/*
AGENT DIRECTIVE BLOCK
file: /src/app/(authenticated)/supervisor/jobs/_components/TaskTemplateSelector.tsx
phase: phase3-feature-011
domain: supervisor
purpose: Template selector for adding template tasks to existing jobs
spec_ref: specs/011-making-task-lists/TASK_TEMPLATE_MANAGEMENT_PLAN.md
complexity_budget: 200
dependencies:
  internal: []
  external:
    - 'react'
    - 'lucide-react'
voice_considerations:
  - Support voice selection of templates
  - Confirm template application with voice feedback
*/

import { useState, useEffect } from 'react';
import { ListChecks, CheckCircle, X, AlertCircle } from 'lucide-react';

export interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  job_type: string | null;
  items?: Array<{ id: string; task_description: string }>;
}

export interface TaskTemplateSelectorProps {
  jobId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TaskTemplateSelector({
  jobId,
  onSuccess,
  onCancel
}: TaskTemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/task-templates');
      const data = await response.json();

      if (response.ok) {
        const activeTemplates = (data.templates || []).filter((t: TemplateOption) => t.is_active !== false);
        setTemplates(activeTemplates);
      } else {
        throw new Error(data.message || 'Failed to load templates');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) {
      setError('Please select a template');
      return;
    }

    try {
      setIsApplying(true);
      setError(null);

      const response = await fetch(`/api/supervisor/jobs/${jobId}/tasks/from-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ template_id: selectedTemplateId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to apply template');
      }

      setSuccess(`Successfully added ${data.tasks?.length || 0} tasks from template`);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setIsApplying(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="template-selector-container">
      <div className="template-selector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ListChecks className="w-5 h-5" style={{ color: '#FFD700' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'white' }}>
            Add Tasks from Template
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isApplying}
          className="close-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="notification success">
          <CheckCircle className="w-4 h-4" />
          <span>{success}</span>
        </div>
      )}

      {/* Template Selection */}
      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>No templates available</p>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label htmlFor="template-select" className="form-label">
              Select Template
            </label>
            <select
              id="template-select"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="template-select"
              disabled={isApplying}
            >
              <option value="">Choose a template...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.items?.length || 0} tasks)
                </option>
              ))}
            </select>
          </div>

          {/* Template Preview */}
          {selectedTemplate && (
            <div className="template-preview">
              <div className="preview-header">
                <span style={{ color: '#FFD700', fontWeight: 600 }}>Preview</span>
                <span style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>
                  {selectedTemplate.items?.length || 0} tasks will be added
                </span>
              </div>

              {selectedTemplate.description && (
                <p className="preview-description">{selectedTemplate.description}</p>
              )}

              {selectedTemplate.job_type && (
                <div className="preview-meta">
                  <span className="meta-label">Job Type:</span>
                  <span className="meta-value">{selectedTemplate.job_type}</span>
                </div>
              )}

              {selectedTemplate.items && selectedTemplate.items.length > 0 && (
                <div className="preview-tasks">
                  <div className="preview-tasks-label">Tasks:</div>
                  <ul className="preview-tasks-list">
                    {selectedTemplate.items.slice(0, 5).map((item, index) => (
                      <li key={item.id}>
                        {index + 1}. {item.task_description}
                      </li>
                    ))}
                    {selectedTemplate.items.length > 5 && (
                      <li style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                        ...and {selectedTemplate.items.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="actions">
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyTemplate}
              disabled={!selectedTemplateId || isApplying}
              className="btn-primary"
            >
              {isApplying ? 'Applying...' : 'Add Tasks'}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .template-selector-container {
          background: rgba(0, 0, 0, 0.95);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.75rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .template-selector-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .close-btn {
          padding: 0.25rem;
          background: transparent;
          border: none;
          color: #9CA3AF;
          cursor: pointer;
          border-radius: 0.25rem;
          transition: all 0.2s;
        }

        .close-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .close-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notification {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }

        .notification.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .notification.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #9CA3AF;
        }

        .template-select {
          width: 100%;
          padding: 0.75rem;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .template-select:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .template-select option {
          background: #111827;
          color: white;
        }

        .template-preview {
          background: rgba(255, 215, 0, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .preview-description {
          color: #D1D5DB;
          font-size: 0.875rem;
          margin: 0;
        }

        .preview-meta {
          display: flex;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .meta-label {
          color: #9CA3AF;
          font-weight: 600;
        }

        .meta-value {
          color: white;
        }

        .preview-tasks {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .preview-tasks-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #9CA3AF;
        }

        .preview-tasks-list {
          margin: 0;
          padding-left: 1.25rem;
          color: #D1D5DB;
          font-size: 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .actions {
          display: flex;
          gap: 0.75rem;
          padding-top: 0.5rem;
        }

        .btn-secondary, .btn-primary {
          flex: 1;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }

        .btn-primary {
          background: #FFD700;
          color: #000;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled, .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

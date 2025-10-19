/**
 * @file src/app/(authenticated)/supervisor/templates/page.tsx
 * @purpose Task template management list page for supervisors
 * @phase Phase 1 - Template Management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  Plus,
  Search,
  FileText,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  X,
  ArrowLeft,
  ListChecks
} from 'lucide-react';

interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  job_type: string | null;
  is_active: boolean;
  created_at: string;
  items?: Array<{ id: string }>;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/task-templates');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load templates');
      }

      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/task-templates/${templateId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete template');
      }

      setSuccess('Template deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      setDeleteConfirm(null);

      // Reload templates
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (template.job_type?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeTemplates = filteredTemplates.filter(t => t.is_active);
  const inactiveTemplates = filteredTemplates.filter(t => !t.is_active);

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading templates...</p>
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
        onLogout={() => router.push('/sign-in')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Task Templates</h1>
          <p className="text-xs text-gray-500">{templates.length} total</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
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

      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        {/* Template List */}
        <div className="px-4 pb-4">
          {filteredTemplates.length === 0 ? (
            <div className="empty-state">
              <ListChecks className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {searchQuery ? 'No templates match your search' : 'No templates yet'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => router.push('/supervisor/templates/create')}
                  className="mt-4 px-4 py-2 bg-[#FFD700] text-black font-semibold rounded-lg hover:bg-[#FFC700]"
                >
                  Create Your First Template
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Templates */}
              {activeTemplates.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Active Templates ({activeTemplates.length})
                  </h2>
                  <div className="space-y-3">
                    {activeTemplates.map((template) => (
                      <div key={template.id} className="template-card">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => router.push(`/supervisor/templates/${template.id}/edit`)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-5 h-5 text-[#FFD700]" />
                              <h3 className="font-semibold text-white">{template.name}</h3>
                            </div>
                            <span className="status-badge active">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          </div>

                          {template.description && (
                            <p className="text-sm text-gray-400 mb-2">{template.description}</p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{template.items?.length || 0} tasks</span>
                            {template.job_type && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{template.job_type.replace('_', ' ')}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/supervisor/templates/${template.id}/edit`);
                            }}
                            className="icon-button"
                            title="Edit template"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(template.id);
                            }}
                            className="icon-button delete"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inactive Templates */}
              {inactiveTemplates.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Inactive Templates ({inactiveTemplates.length})
                  </h2>
                  <div className="space-y-3">
                    {inactiveTemplates.map((template) => (
                      <div key={template.id} className="template-card inactive">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => router.push(`/supervisor/templates/${template.id}/edit`)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-5 h-5 text-gray-500" />
                              <h3 className="font-semibold text-gray-400">{template.name}</h3>
                            </div>
                            <span className="status-badge inactive">
                              <XCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          </div>

                          {template.description && (
                            <p className="text-sm text-gray-500 mb-2">{template.description}</p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            <span>{template.items?.length || 0} tasks</span>
                            {template.job_type && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{template.job_type.replace('_', ' ')}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/supervisor/templates/${template.id}/edit`);
                            }}
                            className="icon-button"
                            title="Edit template"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(template.id);
                            }}
                            className="icon-button delete"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Template?</h3>
            <p className="text-sm text-gray-400 mb-6">
              This will permanently delete this template. Jobs that already use this template will keep their tasks.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isDeleting}
                className="btn-danger flex-1"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          onClick={() => router.push('/supervisor/templates/create')}
          className="btn-primary flex-1"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Template
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

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
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

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
        }

        .template-card {
          display: flex;
          align-items: start;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 0.75rem;
          transition: all 0.2s;
        }

        .template-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
        }

        .template-card.inactive {
          opacity: 0.6;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.5rem;
          font-size: 0.625rem;
          font-weight: 600;
          border-radius: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .status-badge.active {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .status-badge.inactive {
          background: rgba(107, 114, 128, 0.1);
          color: #9ca3af;
          border: 1px solid rgba(107, 114, 128, 0.3);
        }

        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.375rem;
          color: #FFD700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-button:hover {
          background: rgba(255, 215, 0, 0.1);
          border-color: #FFD700;
        }

        .icon-button.delete {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .icon-button.delete:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 50;
        }

        .modal {
          background: #1a1a1a;
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.75rem;
          padding: 1.5rem;
          max-width: 400px;
          width: 100%;
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

        .btn-danger {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #ef4444;
          color: white;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-danger:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn-danger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

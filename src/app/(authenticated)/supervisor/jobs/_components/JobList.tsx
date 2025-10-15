/*
AGENT DIRECTIVE BLOCK
file: /src/app/(authenticated)/supervisor/jobs/_components/JobList.tsx
phase: phase3-feature-007
domain: supervisor
purpose: Job list display component for authenticated supervisors
spec_ref: specs/007-integrate-job-creation-workflow
complexity_budget: 250
dependencies:
  internal:
    - '@/app/(authenticated)/supervisor/jobs/_utils/job-utils'
  external:
    - 'react'
    - 'lucide-react'
    - 'next/link'
voice_considerations:
  - List optimized for voice navigation
*/

import { Edit2, Trash2, Calendar, Clock, User, Home, AlertCircle, RefreshCcw, Loader2, Package } from 'lucide-react';
import Link from 'next/link';
import { formatJobStatus, formatJobPriority, formatJobDateTime, getStatusColor, getPriorityColor } from '@/app/(authenticated)/supervisor/jobs/_utils/job-utils';

export interface JobRecord {
  id: string;
  job_number: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  scheduled_start?: string;
  scheduled_end?: string;
  customerName: string;
  propertyName?: string;
  created_at: string;
}

export interface JobListProps {
  jobs: JobRecord[];
  isLoading: boolean;
  tenantAvailable: boolean;
  editingId: string | null;
  editingTitle: string;
  onEditChange: (value: string) => void;
  onStartEdit: (id: string, title: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onRefresh: () => void;
  onStatusChange?: (id: string, status: string) => void;
}

export function JobList({
  jobs,
  isLoading,
  tenantAvailable,
  editingId,
  editingTitle,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onRefresh,
  onStatusChange
}: JobListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!tenantAvailable) {
    return (
      <div className="py-8 text-center text-gray-400">
        Sign in to manage jobs
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Jobs ({jobs.length})</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-200 transition hover:bg-gray-700 disabled:opacity-60"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="py-8 text-center text-gray-400">No jobs yet. Create your first job above.</p>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-gray-700 bg-gray-800 p-4 transition hover:border-gray-600"
            >
              {/* Header Row */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  {editingId === job.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => onEditChange(e.target.value)}
                        className="flex-1 rounded bg-gray-700 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => onSaveEdit(job.id)}
                        className="rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-500"
                      >
                        Save
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="rounded bg-gray-600 px-2 py-1 text-sm text-white hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-medium text-white">{job.title}</h3>
                        <span className="text-sm text-gray-400">{job.job_number}</span>
                      </div>
                      {job.description && (
                        <p className="mt-1 text-sm text-gray-400">{job.description}</p>
                      )}
                    </div>
                  )}
                </div>

                {editingId !== job.id && (
                  <div className="flex gap-2">
                    <Link
                      href={`/supervisor/jobs/${job.id}`}
                      className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-blue-400"
                      title="Manage items"
                    >
                      <Package className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => onStartEdit(job.id, job.title)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
                      title="Edit job title"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(job.id, job.title)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-red-400"
                      title="Delete job"
                      disabled={['in_progress', 'completed'].includes(job.status)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Details Row */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${getStatusColor(job.status)}`}>
                    {formatJobStatus(job.status)}
                  </span>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${getPriorityColor(job.priority)}`}>
                    {formatJobPriority(job.priority)}
                  </span>
                </div>

                {/* Schedule */}
                <div className="flex items-center gap-1 text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatJobDateTime(job.scheduled_start || null)}</span>
                </div>

                {/* Customer */}
                <div className="flex items-center gap-1 text-gray-400">
                  <User className="h-3.5 w-3.5" />
                  <span>{job.customerName}</span>
                </div>

                {/* Property */}
                {job.propertyName && (
                  <div className="flex items-center gap-1 text-gray-400">
                    <Home className="h-3.5 w-3.5" />
                    <span>{job.propertyName}</span>
                  </div>
                )}
              </div>

              {/* Status Change Actions */}
              {onStatusChange && job.status !== 'completed' && job.status !== 'cancelled' && (
                <div className="mt-3 flex gap-2 border-t border-gray-700 pt-3">
                  {job.status === 'scheduled' && (
                    <button
                      onClick={() => onStatusChange(job.id, 'in_progress')}
                      className="rounded bg-yellow-600 px-2 py-1 text-xs font-medium text-white hover:bg-yellow-500"
                    >
                      Start Job
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <button
                      onClick={() => onStatusChange(job.id, 'completed')}
                      className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-500"
                    >
                      Complete Job
                    </button>
                  )}
                  {job.status !== 'cancelled' && (
                    <button
                      onClick={() => onStatusChange(job.id, 'cancelled')}
                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Cancel Job
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

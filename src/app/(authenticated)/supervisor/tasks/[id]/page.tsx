'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { TaskImageUpload } from '@/components/tasks/TaskImageUpload';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';
import type { ProcessedImages } from '@/utils/image-processor';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Calendar,
  Clock,
  ClipboardList,
  Image as ImageIcon,
  Shield,
  Camera,
} from 'lucide-react';

interface TaskDetailResponse {
  task: WorkflowTask;
  job?: {
    id: string;
    job_number?: string;
    title?: string;
    status?: string;
    scheduled_start?: string;
    scheduled_end?: string;
    priority?: string;
  } | null;
  template?: {
    id: string;
    name: string | null;
    description: string | null;
    medium_url: string | null;
    thumbnail_url: string | null;
    primary_image_url: string | null;
  } | null;
  message?: string;
  error?: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#9CA3AF' },
  'in-progress': { label: 'In Progress', color: '#3B82F6' },
  complete: { label: 'Complete', color: '#22C55E' },
  skipped: { label: 'Skipped', color: '#9CA3AF' },
  failed: { label: 'Failed', color: '#EF4444' },
};

const priorityLabels: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params?.id as string;

  const [task, setTask] = useState<WorkflowTask | null>(null);
  const [job, setJob] = useState<TaskDetailResponse['job']>(null);
  const [template, setTemplate] = useState<TaskDetailResponse['template']>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);

  useEffect(() => {
    if (taskId) {
      loadTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const loadTask = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/workflow-tasks/${taskId}`, {
        credentials: 'include',
      });

      const data: TaskDetailResponse = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to load task');
      }

      setTask(data.task);
      setJob(data.job ?? null);
      setTemplate(data.template ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (images: ProcessedImages) => {
    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflow-tasks/${taskId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ images }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to upload task image');
      }

      if (data.task) {
        setTask(data.task);
        setSuccess('Task image updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
      setShowImageUpload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload task image');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageRemove = async () => {
    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflow-tasks/${taskId}/image`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to remove task image');
      }

      if (data.task) {
        setTask(data.task);
        setSuccess('Task image removed');
        setTimeout(() => setSuccess(null), 3000);
      }
      setShowImageUpload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove task image');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const currentImageUrl = task?.medium_url || task?.primary_image_url || null;

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-white">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Loading task...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-white">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-gray-400 text-lg">Task not found</p>
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-[#FFD700] text-black font-semibold rounded-lg hover:bg-[#FFC700]"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = statusLabels[task.status] || statusLabels.pending;

  return (
    <div className="mobile-container">
      <MobileNavigation currentRole="supervisor" onLogout={() => router.push('/sign-in')} />

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {error && (
          <div className="notification-bar error">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-auto">
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

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 text-white">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">Task</span>
            <h1 className="text-xl font-semibold">{task.task_description}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${statusInfo.color}22`, color: statusInfo.color }}
              >
                {statusInfo.label}
              </span>
              {task.is_required && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                  Required
                </span>
              )}
              {task.requires_photo_verification && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  Photo Required
                </span>
              )}
              {task.requires_supervisor_approval && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-200 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Supervisor Approval
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h2 className="text-sm font-semibold mb-2 text-gray-300">Task Details</h2>
              <ul className="space-y-2 text-gray-200">
                <li className="flex justify-between gap-4">
                  <span className="text-gray-500">Task Order</span>
                  <span className="font-medium">#{task.task_order + 1}</span>
                </li>
                {task.acceptance_criteria && (
                  <li>
                    <span className="text-gray-500 block mb-1">Acceptance Criteria</span>
                    <p className="text-gray-200">{task.acceptance_criteria}</p>
                  </li>
                )}
                {task.supervisor_notes && (
                  <li>
                    <span className="text-gray-500 block mb-1">Supervisor Notes</span>
                    <p className="text-gray-200">{task.supervisor_notes}</p>
                  </li>
                )}
                {task.completed_at && (
                  <li className="flex justify-between gap-4">
                    <span className="text-gray-500">Completed</span>
                    <span className="font-medium">
                      {new Date(task.completed_at).toLocaleString()}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-300">Related Information</h2>
              {job ? (
                <div className="space-y-2 text-gray-200">
                  <div className="flex items-center gap-2 text-sm">
                    <ClipboardList className="w-4 h-4 text-[#FFD700]" />
                    <span className="font-medium">{job.title || 'Job Detail'}</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    {job.job_number && <p>Job #{job.job_number}</p>}
                    {job.status && <p>Status: {job.status.replace('-', ' ')}</p>}
                    {job.priority && priorityLabels[job.priority] && (
                      <p>Priority: {priorityLabels[job.priority]}</p>
                    )}
                    {job.scheduled_start && (
                      <p className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(job.scheduled_start).toLocaleString()}
                      </p>
                    )}
                    {job.scheduled_end && (
                      <p className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(job.scheduled_end).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/supervisor/jobs/${job.id}`)}
                    className="btn-secondary w-full mt-2"
                  >
                    View Job
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Job information unavailable.</p>
              )}

              {template && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Template
                  </h3>
                  <p className="text-sm text-gray-200 font-medium">{template.name || 'Untitled template'}</p>
                  {template.description && (
                    <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Task Image</h2>
            <button
              type="button"
              onClick={() => setShowImageUpload(prev => !prev)}
              className="btn-secondary"
              disabled={isUploading}
            >
              {showImageUpload ? 'Close' : currentImageUrl ? 'Change Image' : 'Add Image'}
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-square max-w-xs mx-auto">
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt="Task reference"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                <ImageIcon className="w-10 h-10" />
                <p className="text-sm text-gray-500 text-center px-4">
                  No task image yet. Upload a visual reference to help the crew.
                </p>
              </div>
            )}
          </div>

          {showImageUpload && (
            <TaskImageUpload
              onImageCapture={handleImageUpload}
              onRemove={currentImageUrl ? handleImageRemove : undefined}
              currentImageUrl={currentImageUrl || undefined}
              disabled={isUploading}
              label="Upload Task Image"
              helperText="Capture a photo or upload a JPEG/PNG. Images help crew visualize the task."
            />
          )}
        </div>
      </div>
    </div>
  );
}

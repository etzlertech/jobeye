'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { ItemImageUpload } from '@/components/items/ItemImageUpload';
import { CrewAssignmentSection } from '@/components/supervisor/CrewAssignmentSection';
import { TaskList } from '@/app/(authenticated)/supervisor/jobs/_components/TaskList';
import { TaskTemplateSelector } from '@/app/(authenticated)/supervisor/jobs/_components/TaskTemplateSelector';
import { TaskEditor } from '@/app/(authenticated)/supervisor/jobs/_components/TaskEditor';
import type { ProcessedImages } from '@/utils/image-processor';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';
import {
  ArrowLeft,
  Briefcase,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Edit,
  Users,
  MapPin,
  Calendar,
  Clock,
  FileText,
  ListChecks,
  Plus
} from 'lucide-react';

interface AssignedItem {
  id: string;
  item_id: string;
  status: string;
  item: {
    id: string;
    name: string;
    category: string;
    primary_image_url: string | null;
  };
}

interface Assignment {
  user_id: string;
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface WorkOrderDetails {
  id: string;
  job_number: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  scheduled_start: string;
  scheduled_end?: string;
  primaryImageUrl: string | null;
  mediumUrl: string | null;
  thumbnailUrl: string | null;
  customer?: { name: string };
  property?: { name: string; address?: any };
  created_at: string;
  updated_at?: string;
  checklist_items?: AssignedItem[]; // Returned from API as checklist_items, represents assigned tools/materials
  total_items?: number;
  loaded_items?: number;
  verified_items?: number;
  completion_percentage?: number;
  assignments?: Assignment[];
}

const statusColors = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  scheduled: '#FFD700',
  cancelled: '#ef4444'
};

const priorityColors = {
  urgent: '#ef4444',
  high: '#f97316',
  normal: '#FFD700',
  low: '#6b7280'
};

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.jobId as string;

  const [job, setJob] = useState<WorkOrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Task management state
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkflowTask | null>(null);

  // Load job details
  const loadJob = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/supervisor/jobs/${jobId}`, {
        credentials: 'include'
      });
      const data = await response.json();

      console.log('[JobDetailPage] API response:', data);
      console.log('[JobDetailPage] job.assignments:', data.job?.assignments || data.assignments);

      if (!response.ok) throw new Error(data.message || 'Failed to load job');

      setJob(data.job || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setIsLoading(false);
    }
  };

  // Load tasks for job
  const loadTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const response = await fetch(`/api/supervisor/jobs/${jobId}/tasks`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load tasks');
      }

      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      // Don't show error to user, just log it
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      loadJob();
      loadTasks();
    }
  }, [jobId]);

  const handleTaskEdit = (task: WorkflowTask) => {
    setEditingTask(task);
    setShowTaskEditor(true);
  };

  const handleTaskDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await fetch(`/api/supervisor/jobs/${jobId}/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete task');
      }

      setSuccess('Task deleted successfully');
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleTaskReorder = async (taskId: string, direction: 'up' | 'down') => {
    // Find current task index
    const currentIndex = tasks.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return;

    const newTasks = [...tasks];
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= newTasks.length) return;

    // Swap tasks
    [newTasks[currentIndex], newTasks[swapIndex]] = [newTasks[swapIndex], newTasks[currentIndex]];

    // Update task_order for both tasks
    try {
      await Promise.all([
        fetch(`/api/supervisor/jobs/${jobId}/tasks/${newTasks[currentIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ task_order: currentIndex })
        }),
        fetch(`/api/supervisor/jobs/${jobId}/tasks/${newTasks[swapIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ task_order: swapIndex })
        })
      ]);

      // Reload tasks to get fresh data
      await loadTasks();
    } catch (err) {
      setError('Failed to reorder tasks');
      console.error('Reorder error:', err);
    }
  };

  const handleTemplateSuccess = async () => {
    setShowTemplateSelector(false);
    setSuccess('Tasks added from template successfully');
    await loadTasks();
  };

  const handleTaskEditorSuccess = async () => {
    setShowTaskEditor(false);
    setEditingTask(null);
    setSuccess(editingTask ? 'Task updated successfully' : 'Task created successfully');
    await loadTasks();
  };

  const handleImageCapture = async (images: ProcessedImages) => {
    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/supervisor/jobs/${jobId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ images })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      setSuccess('Image uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);

      // Refresh job data to show new images
      await loadJob();
      setShowImageUpload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  // Format address for display
  const formatAddress = (address?: any) => {
    if (!address) return null;
    if (typeof address === 'string') return address;
    const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const getStatusColor = (status: string) => statusColors[status as keyof typeof statusColors] || '#6b7280';
  const getPriorityColor = (priority: string) => priorityColors[priority as keyof typeof priorityColors] || '#6b7280';

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading job...</p>
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
          }
        `}</style>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mobile-container">
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/sign-in')}
        />
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-gray-400 text-lg">Job not found</p>
          </div>
        </div>
      </div>
    );
  }

  const displayAddress = formatAddress(job.property?.address);

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
          <h1 className="text-xl font-semibold">Work Order Details</h1>
          <p className="text-xs text-gray-500">#{job.job_number}</p>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Image Section */}
        <div className="p-4">
          <div className="image-container">
            {job.mediumUrl || job.primaryImageUrl ? (
              <img
                src={job.mediumUrl || job.primaryImageUrl || ''}
                alt={job.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Briefcase className="w-16 h-16 text-gray-600" />
              </div>
            )}
          </div>

          {/* Image Upload Toggle */}
          {showImageUpload ? (
            <div className="mt-4">
              <ItemImageUpload
                onImageCapture={handleImageCapture}
                disabled={isUploading}
              />
              <button
                onClick={() => setShowImageUpload(false)}
                disabled={isUploading}
                className="btn-secondary w-full mt-3"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowImageUpload(true)}
              className="btn-primary w-full mt-3"
            >
              <Camera className="w-5 h-5 mr-2" />
              {job.primaryImageUrl ? 'Change Image' : 'Add Image'}
            </button>
          )}
        </div>

        {/* Job Information */}
        <div className="px-4 pb-4 space-y-4">
          {/* Title */}
          <div>
            <label className="detail-label">Job Title</label>
            <p className="detail-value">{job.title}</p>
          </div>

          {/* Status & Priority */}
          <div className="detail-section">
            <h3 className="detail-section-title">Status</h3>
            <div className="flex items-center gap-3">
              <span
                className="status-badge"
                style={{
                  background: `${getStatusColor(job.status)}20`,
                  color: getStatusColor(job.status),
                  border: `1px solid ${getStatusColor(job.status)}40`
                }}
              >
                {job.status.replace('_', ' ')}
              </span>
              <span
                className="priority-badge"
                style={{ color: getPriorityColor(job.priority) }}
              >
                {job.priority} priority
              </span>
            </div>
          </div>

          {/* Schedule */}
          <div className="detail-section">
            <h3 className="detail-section-title">Schedule</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <label className="detail-label">Start Date</label>
                  <p className="detail-value text-sm">
                    {new Date(job.scheduled_start).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {job.scheduled_end && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <label className="detail-label">End Date</label>
                    <p className="detail-value text-sm">
                      {new Date(job.scheduled_end).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer & Property */}
          <div className="detail-section">
            <h3 className="detail-section-title">Location & Contact</h3>
            <div className="space-y-3">
              {job.customer?.name && (
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <label className="detail-label">Customer</label>
                    <p className="detail-value text-sm">{job.customer.name}</p>
                  </div>
                </div>
              )}
              {job.property?.name && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <label className="detail-label">Property</label>
                    <p className="detail-value text-sm">{job.property.name}</p>
                    {displayAddress && (
                      <p className="text-xs text-gray-500 mt-1">{displayAddress}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <div className="detail-section">
              <h3 className="detail-section-title">Description</h3>
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="detail-value text-sm">{job.description}</p>
              </div>
            </div>
          )}

          {/* Crew Assignment */}
          <CrewAssignmentSection
            jobId={jobId}
            currentAssignments={job.assignments || []}
            onAssignmentChange={loadJob}
          />

          {/* Task Management Section */}
          <div className="detail-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ListChecks className="w-5 h-5" style={{ color: '#FFD700' }} />
                <h3 className="detail-section-title" style={{ margin: 0 }}>Tasks ({tasks.length})</h3>
              </div>
            </div>

            {/* Template Selector (if active) */}
            {showTemplateSelector && (
              <div style={{ marginBottom: '1rem' }}>
                <TaskTemplateSelector
                  jobId={jobId}
                  onSuccess={handleTemplateSuccess}
                  onCancel={() => setShowTemplateSelector(false)}
                />
              </div>
            )}

            {/* Task Editor (if active) */}
            {showTaskEditor && (
              <div style={{ marginBottom: '1rem' }}>
                <TaskEditor
                  jobId={jobId}
                  task={editingTask}
                  mode={editingTask ? 'edit' : 'create'}
                  onSuccess={handleTaskEditorSuccess}
                  onCancel={() => {
                    setShowTaskEditor(false);
                    setEditingTask(null);
                  }}
                />
              </div>
            )}

            {/* Add Task Buttons */}
            {!showTemplateSelector && !showTaskEditor && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowTemplateSelector(true)}
                  className="task-action-btn template-btn"
                >
                  <ListChecks className="w-4 h-4" />
                  From Template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setShowTaskEditor(true);
                  }}
                  className="task-action-btn custom-btn"
                >
                  <Plus className="w-4 h-4" />
                  Custom Task
                </button>
              </div>
            )}

            {/* Task List */}
            {isLoadingTasks ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Loading tasks...</p>
              </div>
            ) : (
              <TaskList
                tasks={tasks}
                editable={true}
                onEdit={handleTaskEdit}
                onDelete={handleTaskDelete}
                onReorder={handleTaskReorder}
                onViewDetails={(selectedTask) => router.push(`/supervisor/tasks/${selectedTask.id}`)}
              />
            )}
          </div>

          {/* Required Tools & Materials */}
          {job.checklist_items && job.checklist_items.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">Required Tools & Materials ({job.loaded_items || 0}/{job.total_items || 0})</h3>
              <div className="load-items-grid">
                {job.checklist_items
                  .filter(item => item.status !== 'missing')
                  .map((assignedItem) => (
                  <div
                    key={assignedItem.id}
                    className={`load-item-card ${assignedItem.status}`}
                  >
                    {assignedItem.item.primary_image_url ? (
                      <div className="load-item-image">
                        <img
                          src={assignedItem.item.primary_image_url}
                          alt={assignedItem.item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="load-item-image load-item-placeholder">
                        <Briefcase className="w-8 h-8 text-gray-500" />
                      </div>
                    )}
                    <div className="load-item-content">
                      <div className="load-item-name">{assignedItem.item.name}</div>
                      <div className="load-item-category">{assignedItem.item.category}</div>
                      <div className={`load-item-status status-${assignedItem.status}`}>
                        {assignedItem.status === 'verified' && '✓ Verified'}
                        {assignedItem.status === 'loaded' && '✓ Assigned'}
                        {assignedItem.status === 'pending' && '○ Pending'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="detail-section">
            <h3 className="detail-section-title">Timestamps</h3>
            <div className="space-y-2">
              <div>
                <label className="detail-label">Created</label>
                <p className="detail-value text-sm">{new Date(job.created_at).toLocaleString()}</p>
              </div>
              {job.updated_at && (
                <div>
                  <label className="detail-label">Last Updated</label>
                  <p className="detail-value text-sm">{new Date(job.updated_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push('/supervisor/jobs')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <button
          type="button"
          onClick={() => router.push(`/supervisor/jobs/${jobId}/edit`)}
          className="btn-primary flex-1"
        >
          <Edit className="w-5 h-5 mr-2" />
          Edit
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

        .image-container {
          width: 100%;
          height: 300px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          overflow: hidden;
        }

        .detail-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: #9CA3AF;
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .detail-value {
          font-size: 1rem;
          color: white;
          margin: 0;
        }

        .detail-section {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
        }

        .detail-section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #FFD700;
          margin: 0 0 0.75rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.375rem;
          text-transform: capitalize;
        }

        .priority-badge {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
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

        .load-items-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .load-item-card {
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          overflow: hidden;
          transition: all 0.2s;
        }

        .load-item-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2);
        }

        .load-item-image {
          width: 100%;
          height: 80px;
          background: rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }

        .load-item-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .load-item-content {
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .load-item-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          line-height: 1.2;
        }

        .load-item-category {
          font-size: 0.75rem;
          color: #9CA3AF;
          text-transform: capitalize;
        }

        .load-item-status {
          margin-top: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-verified {
          color: #22c55e;
        }

        .status-loaded {
          color: #3b82f6;
        }

        .status-pending {
          color: #f97316;
        }

        .task-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          flex: 1;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .template-btn {
          background: rgba(255, 215, 0, 0.1);
          color: #FFD700;
          border-color: rgba(255, 215, 0, 0.3);
        }

        .template-btn:hover {
          background: rgba(255, 215, 0, 0.2);
        }

        .custom-btn {
          background: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
          border-color: rgba(59, 130, 246, 0.3);
        }

        .custom-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }
      `}</style>
    </div>
  );
}

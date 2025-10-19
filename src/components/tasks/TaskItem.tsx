/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/tasks/TaskItem.tsx
 * phase: 3.8
 * domain: components
 * purpose: Individual task card with status, actions, and verification display
 * spec_ref: specs/011-making-task-lists/spec.md
 * complexity_budget: 250
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "render": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/workflow-task/types/workflow-task-types'],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['TaskItem', 'TaskItemProps']
 * voice_considerations: Task number for voice commands, status readable via TTS
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/components/tasks/TaskItem.test.tsx'
 * }
 * tasks: [
 *   'Display task details with status badge',
 *   'Show verification photo if present',
 *   'Provide complete and delete actions',
 *   'Display supervisor approval status'
 * ]
 */

'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  Circle,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Camera,
  Eye,
  Clock,
  User,
  Shield,
} from 'lucide-react';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';

export interface TaskItemProps {
  task: WorkflowTask;
  taskNumber?: number;
  editable?: boolean;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPhotoClick?: (photoUrl: string) => void;
  className?: string;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Circle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
  'in-progress': {
    label: 'In Progress',
    icon: RefreshCw,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
  },
  complete: {
    label: 'Complete',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
  },
  skipped: {
    label: 'Skipped',
    icon: AlertCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
  failed: {
    label: 'Failed',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
};

export function TaskItem({
  task,
  taskNumber,
  editable = false,
  onComplete,
  onDelete,
  onPhotoClick,
  className = '',
}: TaskItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  const status = statusConfig[task.status];
  const StatusIcon = status.icon;

  const handleComplete = () => {
    if (task.requires_photo_verification && !task.verification_photo_url) {
      alert('Photo verification is required to complete this task.');
      return;
    }
    onComplete?.(task.id);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      onDelete?.(task.id);
    }
  };

  const handlePhotoClick = () => {
    if (task.verification_photo_url) {
      onPhotoClick?.(task.verification_photo_url);
    }
  };

  return (
    <div
      className={`
        border rounded-lg transition-all duration-200
        ${status.borderColor} ${showDetails ? status.bgColor : 'bg-white'}
        hover:shadow-md
        ${className}
      `}
      data-testid={`task-item-${task.id}`}
    >
      {/* Main Task Content */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Status Icon & Number */}
          <div className="flex-shrink-0 text-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.bgColor} border-2 ${status.borderColor}`}>
              <StatusIcon className={`w-5 h-5 ${status.color}`} />
            </div>
            {taskNumber !== undefined && (
              <div className="text-xs font-semibold text-gray-600 mt-1">
                #{taskNumber}
              </div>
            )}
          </div>

          {/* Task Details */}
          <div className="flex-1 min-w-0">
            {/* Title and Status */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-gray-900 flex-1">
                {task.task_description}
              </h4>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color} whitespace-nowrap`}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
            </div>

            {/* Template Thumbnail */}
            {task.thumbnail_url && (
              <div className="mb-2">
                <button
                  onClick={() => onPhotoClick?.(task.primary_image_url || task.medium_url || task.thumbnail_url)}
                  className="relative group w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100"
                  title="View task image"
                >
                  <img
                    src={task.thumbnail_url}
                    alt="Task reference"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {task.is_required && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Required
                </span>
              )}
              {task.requires_photo_verification && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                  <Camera className="w-3 h-3 mr-1" />
                  Photo Required
                </span>
              )}
              {task.requires_supervisor_approval && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                  <Shield className="w-3 h-3 mr-1" />
                  Supervisor Approval
                </span>
              )}
            </div>

            {/* Acceptance Criteria (collapsible) */}
            {task.acceptance_criteria && (
              <div className="mb-2">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showDetails ? 'Hide Details' : 'Show Details'}
                </button>
                {showDetails && (
                  <p className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded border border-gray-200 italic">
                    {task.acceptance_criteria}
                  </p>
                )}
              </div>
            )}

            {/* Verification Photo */}
            {task.verification_photo_url && (
              <div className="mb-2">
                <button
                  onClick={handlePhotoClick}
                  className="relative group w-20 h-20 rounded-lg overflow-hidden border-2 border-emerald-300 bg-gray-100"
                  title="View verification photo"
                >
                  <img
                    src={task.verification_photo_url}
                    alt="Verification"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
                {task.ai_confidence !== undefined && task.ai_confidence !== null && (
                  <div className="text-xs text-gray-600 mt-1">
                    AI Confidence: {Math.round(task.ai_confidence * 100)}%
                  </div>
                )}
              </div>
            )}

            {/* Completion Info */}
            {task.completed_at && (
              <div className="flex flex-col gap-1 text-xs text-gray-600 mb-2">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    Completed: {new Date(task.completed_at).toLocaleString()}
                  </span>
                </div>
                {task.completed_by && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>By: {task.completed_by}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {editable && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                {task.status !== 'complete' && (
                  <button
                    onClick={handleComplete}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors"
                    aria-label={`Complete task ${taskNumber}`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Complete</span>
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 transition-colors"
                  aria-label={`Delete task ${taskNumber}`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supervisor Approval Section */}
      {task.requires_supervisor_approval && task.supervisor_approved && (
        <div className="px-3 pb-3">
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
            <div className="flex items-center gap-1 text-emerald-800 font-medium mb-1">
              <Shield className="w-3 h-3" />
              <span>Supervisor Approved</span>
            </div>
            {task.supervisor_notes && (
              <div className="text-emerald-700 mt-1 italic">
                "{task.supervisor_notes}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/crew/JobTile.tsx
 * phase: 3
 * domain: crew-job-assignment
 * purpose: Reusable job card component for crew dashboard
 * spec_ref: 010-job-assignment-and
 * complexity_budget: 200
 * task: T023
 */

import React from 'react';
import { Calendar, MapPin, Package } from 'lucide-react';
import { LoadStatusBadge } from './LoadStatusBadge';

interface JobWithAssignment {
  id: string;
  job_number: string;
  title?: string;
  customer_name: string;
  property_address: string;
  scheduled_start: string;
  status: string;
  priority?: string;
  total_items?: number;
  loaded_items?: number;
  load_percentage?: number;
}

interface JobTileProps {
  job: JobWithAssignment;
  onClick: () => void;
}

export function JobTile({ job, onClick }: JobTileProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateStr = date.toDateString();
    const todayStr = today.toDateString();
    const tomorrowStr = tomorrow.toDateString();

    if (dateStr === todayStr) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (dateStr === tomorrowStr) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return null;
    }
  };

  const priorityColorClass = getPriorityColor(job.priority);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
      onClick={onClick}
      data-testid={`job-tile-${job.job_number}`}
    >
      <div className="p-4">
        {/* Header with job number and status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {job.job_number}
            </h3>
            {job.title && (
              <p className="text-sm text-gray-600 truncate">{job.title}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-end ml-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
              {job.status.replace('_', ' ')}
            </span>
            {priorityColorClass && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColorClass}`}>
                {job.priority}
              </span>
            )}
          </div>
        </div>

        {/* Customer and Property */}
        <div className="space-y-2 mb-3">
          <div className="flex items-start">
            <Package className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-gray-700">{job.customer_name}</span>
          </div>
          <div className="flex items-start">
            <MapPin className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-gray-700">{job.property_address}</span>
          </div>
        </div>

        {/* Scheduled Time */}
        <div className="flex items-center mb-3">
          <Calendar className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <span className="text-sm text-gray-600">{formatDate(job.scheduled_start)}</span>
        </div>

        {/* Load Status Badge */}
        {(job.total_items !== undefined && job.loaded_items !== undefined) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <LoadStatusBadge
              total_items={job.total_items}
              loaded_items={job.loaded_items}
            />
          </div>
        )}
      </div>
    </div>
  );
}

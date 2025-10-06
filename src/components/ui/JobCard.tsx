/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/components/ui/JobCard.tsx
 * phase: 3
 * domain: ui
 * purpose: Job card component with 512x512 thumbnails and status indicators
 * spec_ref: 007-mvp-intent-driven/contracts/ui-components.md
 * complexity_budget: 250
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "render": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/lib/utils'],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['JobCard', 'JobCardProps']
 * voice_considerations: All text can be read via TTS
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/components/ui/JobCard.test.tsx'
 * }
 * tasks: [
 *   'Create job card with thumbnail support',
 *   'Add status indicators and badges',
 *   'Support offline state display',
 *   'Include voice interaction hints'
 * ]
 */

'use client';

import React from 'react';
import { 
  Clock, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Users,
  Package,
  Mic,
  Wifi,
  WifiOff
} from 'lucide-react';

export interface JobCardProps {
  job: {
    id: string;
    customerName: string;
    propertyAddress: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'assigned' | 'started' | 'in_progress' | 'completed' | 'cancelled';
    specialInstructions?: string;
    requiredEquipment?: string[];
    loadVerified?: boolean;
    thumbnailUrl?: string;
    estimatedDuration?: number; // minutes
    priority?: 'low' | 'medium' | 'high' | 'critical';
  };
  assignedCrew?: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
  }>;
  isOffline?: boolean;
  onJobClick?: (jobId: string) => void;
  onVoiceCommand?: (jobId: string) => void;
  className?: string;
  compact?: boolean;
}

const statusConfig = {
  assigned: {
    label: 'Assigned',
    color: 'bg-blue-100 text-blue-800',
    icon: Clock,
    iconColor: 'text-blue-600'
  },
  started: {
    label: 'Started',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Play,
    iconColor: 'text-yellow-600'
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-orange-100 text-orange-800',
    icon: AlertCircle,
    iconColor: 'text-orange-600'
  },
  completed: {
    label: 'Completed',
    color: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle,
    iconColor: 'text-emerald-600'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-100 text-gray-800',
    icon: AlertCircle,
    iconColor: 'text-gray-600'
  }
};

const priorityConfig = {
  low: 'border-l-gray-300',
  medium: 'border-l-yellow-400',
  high: 'border-l-orange-500',
  critical: 'border-l-red-500'
};

export function JobCard({
  job,
  assignedCrew,
  isOffline = false,
  onJobClick,
  onVoiceCommand,
  className = '',
  compact = false
}: JobCardProps) {
  const status = statusConfig[job.status];
  const StatusIcon = status.icon;
  
  const handleClick = () => {
    onJobClick?.(job.id);
  };

  const handleVoiceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onVoiceCommand?.(job.id);
  };

  const formatTime = (timeString: string) => {
    try {
      const time = new Date(`2000-01-01T${timeString}`);
      return time.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
      } else {
        return date.toLocaleDateString([], { 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch {
      return dateString;
    }
  };

  return (
    <div
      className={`
        relative bg-white rounded-lg border-l-4 shadow-sm hover:shadow-md
        transition-all duration-200 cursor-pointer
        ${priorityConfig[job.priority || 'low']}
        ${compact ? 'p-3' : 'p-4'}
        ${className}
      `}
      onClick={handleClick}
      data-testid={`job-card-${job.id}`}
    >
      {/* Offline/Online Indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        {isOffline ? (
          <WifiOff className="w-4 h-4 text-orange-500" aria-hidden="true" />
        ) : (
          <Wifi className="w-4 h-4 text-emerald-500" aria-hidden="true" />
        )}
        
        {/* Voice Command Button */}
        {onVoiceCommand && (
          <button
            onClick={handleVoiceClick}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Voice command for this job"
            title="Voice command"
          >
            <Mic className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      <div className="flex gap-3">
        {/* Property Thumbnail */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
            {job.thumbnailUrl ? (
              <img
                src={job.thumbnailUrl}
                alt={`${job.customerName} property`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Job Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-900 truncate">
                {job.customerName}
              </h3>
              <p className="text-sm text-gray-600 truncate">
                {job.propertyAddress}
              </p>
            </div>
          </div>

          {/* Schedule */}
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{formatDate(job.scheduledDate)} at {formatTime(job.scheduledTime)}</span>
            </div>
            {job.estimatedDuration && (
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                {job.estimatedDuration}min
              </span>
            )}
          </div>

          {/* Status and Load Verification */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
              <StatusIcon className={`w-3 h-3 ${status.iconColor}`} />
              {status.label}
            </span>
            
            {job.loadVerified !== undefined && (
              <span 
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  job.loadVerified 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <Package className="w-3 h-3" />
                {job.loadVerified ? 'Verified' : 'Not Verified'}
              </span>
            )}
          </div>

          {/* Equipment List */}
          {job.requiredEquipment && job.requiredEquipment.length > 0 && !compact && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1">Required Equipment:</p>
              <div className="flex flex-wrap gap-1">
                {job.requiredEquipment.slice(0, 3).map((item, index) => (
                  <span 
                    key={index}
                    className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                  >
                    {item}
                  </span>
                ))}
                {job.requiredEquipment.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{job.requiredEquipment.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {job.specialInstructions && !compact && (
            <div className="mb-2">
              <p className="text-xs text-gray-700 italic line-clamp-2">
                "{job.specialInstructions}"
              </p>
            </div>
          )}

          {/* Assigned Crew */}
          {assignedCrew && assignedCrew.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <div className="flex items-center gap-1">
                {assignedCrew.slice(0, 3).map((member, index) => (
                  <div
                    key={member.id}
                    className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-medium text-gray-700"
                    title={member.name}
                  >
                    {member.avatarUrl ? (
                      <img 
                        src={member.avatarUrl} 
                        alt={member.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                ))}
                {assignedCrew.length > 3 && (
                  <span className="text-xs text-gray-500 ml-1">
                    +{assignedCrew.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Priority Indicator */}
      {job.priority && job.priority !== 'low' && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-red-500">
          <div className="absolute -top-4 -right-2 text-white text-xs font-bold">
            !
          </div>
        </div>
      )}
    </div>
  );
}

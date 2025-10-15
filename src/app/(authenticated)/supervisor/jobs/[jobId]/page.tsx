'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { ItemImageUpload } from '@/components/items/ItemImageUpload';
import type { ProcessedImages } from '@/utils/image-processor';
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
  FileText
} from 'lucide-react';

interface JobDetails {
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

  const [job, setJob] = useState<JobDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Load job details
  const loadJob = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/supervisor/jobs/${jobId}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Failed to load job');

      setJob(data.job || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      loadJob();
    }
  }, [jobId]);

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
          <h1 className="text-xl font-semibold">Job Details</h1>
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
      `}</style>
    </div>
  );
}

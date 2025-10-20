'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { JobForm } from './_components/JobForm';
import { buildJobPayload, type JobFormState } from './_utils/job-utils';
import type { CustomerOption, PropertyOption } from './_components/JobForm';
import {
  Plus,
  Search,
  Briefcase,
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
  Loader2
} from 'lucide-react';

interface Job {
  id: string;
  job_number: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  scheduled_start: string;
  scheduled_end?: string;
  customerName: string;
  propertyName?: string;
  thumbnailUrl?: string;
  created_at: string;
  // Load tracking
  total_items: number;
  loaded_items: number;
  verified_items: number;
  completion_percentage: number;
}

// Inner component that uses searchParams
function JobsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Job form state
  const [formData, setFormData] = useState<JobFormState>({
    customerId: '',
    propertyId: '',
    title: '',
    description: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    priority: 'normal',
    templateId: ''
  });

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
    loadCustomers();
    loadProperties();
  }, []);

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/supervisor/jobs?simple=true');
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      const mapped: Job[] = (data.jobs || []).map((job: any) => ({
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        description: job.description,
        status: job.status,
        priority: job.priority,
        scheduled_start: job.scheduled_start,
        scheduled_end: job.scheduled_end,
        customerName: job.customer?.name || job.customer_id || 'Unknown customer',
        propertyName: job.property?.name || job.property?.address?.street || undefined,
        thumbnailUrl: job.thumbnail_url,
        created_at: job.created_at,
        // Load tracking - now coming from API
        total_items: job.total_items || 0,
        loaded_items: job.loaded_items || 0,
        verified_items: job.verified_items || 0,
        completion_percentage: job.completion_percentage || 0
      }));

      setJobs(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/supervisor/customers');
      const data = await response.json();
      if (response.ok) {
        setCustomers((data.customers || []).map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadProperties = async () => {
    try {
      const response = await fetch('/api/supervisor/properties');
      const data = await response.json();
      if (response.ok) {
        setProperties((data.properties || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          address: typeof p.address === 'string' ? p.address : p.address?.street
        })));
      }
    } catch (err) {
      console.error('Failed to load properties:', err);
    }
  };

  useEffect(() => {
    const createParam = searchParams.get('create');
    const shouldShow = createParam === '1' || createParam === 'true';
    setShowForm(shouldShow);
  }, [searchParams]);

  const updateCreateParam = useCallback((next: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set('create', '1');
    } else {
      params.delete('create');
    }
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleCreateJob = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const payload = buildJobPayload(formData);
      const response = await fetch('/api/supervisor/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create job');
      }

      setSuccess('Job created successfully!');
      setTimeout(() => setSuccess(null), 3000);

      // Reset form and hide it
      setFormData({
        customerId: '',
        propertyId: '',
        title: '',
        description: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: '09:00',
        priority: 'normal',
        templateId: ''
      });
      updateCreateParam(false);

      // Reload jobs list
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFormChange = <K extends keyof JobFormState>(field: K, value: JobFormState[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClearForm = () => {
    setFormData({
      customerId: '',
      propertyId: '',
      title: '',
      description: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '09:00',
      priority: 'normal',
      templateId: ''
    });
  };

  const handleToggleForm = () => {
    updateCreateParam(!showForm);
  };

  const filteredJobs = jobs.filter(job =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.job_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'in_progress': return '#3b82f6';
      case 'scheduled': return '#FFD700';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'normal': return '#FFD700';
      default: return '#6b7280';
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading jobs...</p>
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
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Jobs</h1>
          <p className="text-xs text-gray-500">{filteredJobs.length} total</p>
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
        {/* Job Creation Form */}
        {showForm && (
          <div className="p-4">
            <JobForm
              draft={formData}
              customers={customers}
              properties={properties}
              onDraftChange={handleFormChange}
              onSubmit={handleCreateJob}
              onClear={handleClearForm}
              disabled={isCreating}
            />
          </div>
        )}

        {/* Search */}
        {!showForm && (
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>
        )}

        {/* Job List */}
        {!showForm && (
          <div className="px-4 pb-4">
          {filteredJobs.length === 0 ? (
            <div className="empty-state">
              <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {searchQuery ? 'No jobs match your search' : 'No jobs scheduled yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="job-card"
                >
                  <div
                    className="flex-1"
                    onClick={() => router.push(`/supervisor/jobs/${job.id}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-white text-sm">{job.title}</h3>
                      <span
                        className="status-badge"
                        style={{
                          background: `${getStatusColor(job.status)}20`,
                          color: getStatusColor(job.status),
                          border: `1px solid ${getStatusColor(job.status)}40`
                        }}
                      >
                        {job.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{job.customerName} • {new Date(job.scheduled_start).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/crew/load-verify?jobId=${job.id}`);
                    }}
                    className="load-status-btn"
                    title={`${job.loaded_items} of ${job.total_items} items loaded (${job.completion_percentage}%)`}
                  >
                    LOAD {job.loaded_items}/{job.total_items}
                  </button>
                </div>
              ))}
            </div>
          )}
          </div>
        )}
      </div>

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
          onClick={handleToggleForm}
          className="btn-primary flex-1"
        >
          {showForm ? (
            <>
              <X className="w-5 h-5 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-5 h-5 mr-2" />
              Create Job
            </>
          )}
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

        .job-card {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 0.75rem;
          transition: all 0.2s;
        }

        .job-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
        }

        .job-card .flex-1 {
          cursor: pointer;
        }

        .load-status-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 0.75rem;
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.375rem;
          color: #FFD700;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .load-status-btn:hover {
          background: rgba(255, 215, 0, 0.2);
          border-color: #FFD700;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.25rem;
          text-transform: capitalize;
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

// Main export wrapped in Suspense
export default function SupervisorJobsPage() {
  return (
    <Suspense fallback={
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading...</p>
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
    }>
      <JobsPageContent />
    </Suspense>
  );
}

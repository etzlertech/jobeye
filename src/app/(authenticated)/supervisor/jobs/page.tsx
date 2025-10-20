'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { EntityTile } from '@/components/ui/EntityTile';
import { EntityTileGrid } from '@/components/ui/EntityTileGrid';
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
  Loader2,
  Package
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
            <EntityTileGrid
              emptyState={{
                icon: <Briefcase className="w-12 h-12" />,
                message: searchQuery ? 'No jobs match your search' : 'No jobs scheduled yet'
              }}
            >
              {filteredJobs.map((job) => {
                // Determine tag colors
                const statusColor = job.status === 'completed' ? 'green' as const
                  : job.status === 'in_progress' ? 'blue' as const
                  : job.status === 'scheduled' ? 'gold' as const
                  : 'gray' as const;

                const priorityColor = job.priority === 'urgent' ? 'red' as const
                  : job.priority === 'high' ? 'orange' as const
                  : job.priority === 'normal' ? 'gold' as const
                  : 'gray' as const;

                // Build tags array
                const tags = [
                  { label: job.status, color: statusColor },
                  { label: job.priority, color: priorityColor }
                ];

                // Add load status if there are items
                if (job.total_items > 0) {
                  tags.push({
                    label: `${job.loaded_items}/${job.total_items} loaded`,
                    color: 'purple' as const,
                    icon: <Package className="w-3 h-3" />
                  });
                }

                return (
                  <EntityTile
                    key={job.id}
                    image={job.thumbnailUrl}
                    fallbackIcon={<Briefcase />}
                    title={job.title}
                    subtitle={`${job.customerName} • ${new Date(job.scheduled_start).toLocaleDateString()}`}
                    tags={tags}
                    onClick={() => router.push(`/supervisor/jobs/${job.id}`)}
                  />
                );
              })}
            </EntityTileGrid>
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

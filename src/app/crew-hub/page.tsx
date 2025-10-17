/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/crew-hub/page.tsx
 * phase: 3
 * domain: crew-job-assignment
 * purpose: Crew Hub dashboard showing assigned jobs with load status
 * spec_ref: 010-job-assignment-and
 * complexity_budget: 300
 * task: T025
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { JobTile } from '@/components/crew/JobTile';
import { TenantBadge } from '@/components/tenant';

interface JobWithAssignment {
  id: string;
  job_number: string;
  title: string;
  customer_name: string;
  property_address: string;
  scheduled_start: string;
  status: string;
  priority?: string;
  total_items?: number;
  loaded_items?: number;
  load_percentage?: number;
}

export default function CrewHubPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssignedJobs = async () => {
      try {
        const response = await fetch('/api/crew/jobs');

        if (!response.ok) {
          throw new Error(`Failed to fetch jobs: ${response.statusText}`);
        }

        const data = await response.json();
        setJobs(data.jobs || []);
      } catch (err: any) {
        console.error('Error fetching assigned jobs:', err);
        setError(err.message || 'Failed to load assigned jobs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignedJobs();
  }, []);

  const handleJobClick = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Loading your jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Crew Hub</h1>
              <p className="text-sm text-gray-600 mt-1">My Jobs</p>
            </div>
            <TenantBadge />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading jobs</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!error && jobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No jobs assigned yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Check back later for new assignments
            </p>
          </div>
        )}

        {!error && jobs.length > 0 && (
          <div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {jobs.length} job{jobs.length !== 1 ? 's' : ''} assigned
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs.map((job) => (
                <JobTile
                  key={job.id}
                  job={job}
                  onClick={() => handleJobClick(job.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

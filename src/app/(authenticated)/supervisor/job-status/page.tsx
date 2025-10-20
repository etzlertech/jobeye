'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { Calendar, MapPin, User, Loader2 } from 'lucide-react';

interface Job {
  id: string;
  job_number: string;
  title: string;
  status: string;
  customerName: string;
  propertyName?: string;
  scheduled_start: string;
  total_items: number;
  loaded_items: number;
  completion_percentage: number;
}

export default function JobStatusPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'needs_loading'>('all');

  useEffect(() => {
    loadJobs();
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
        status: job.status,
        customerName: job.customer?.name || 'Unknown',
        propertyName: job.property?.name || job.property?.address?.street,
        scheduled_start: job.scheduled_start,
        total_items: job.total_items || 0,
        loaded_items: job.loaded_items || 0,
        completion_percentage: job.completion_percentage || 0
      }));

      console.log('Job Status - Raw API response:', data.jobs?.slice(0, 2));
      console.log('Job Status - Mapped jobs:', mapped.slice(0, 2));

      setJobs(mapped);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      const jobDate = new Date(job.scheduled_start).toISOString().split('T')[0];
      return jobDate === today;
    }
    if (filter === 'needs_loading') {
      return job.total_items > 0 && job.loaded_items < job.total_items;
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'in_progress': return '#3b82f6';
      case 'scheduled': return '#FFD700';
      default: return '#6b7280';
    }
  };

  const getLoadingColor = (percentage: number) => {
    if (percentage === 0) return '#6b7280';
    if (percentage < 50) return '#ef4444';
    if (percentage < 100) return '#f97316';
    return '#22c55e';
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
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Job Status</h1>
          <p className="text-xs text-gray-500">{filteredJobs.length} jobs</p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="filter-bar">
        <button
          onClick={() => setFilter('all')}
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
        >
          All Jobs
        </button>
        <button
          onClick={() => setFilter('today')}
          className={`filter-chip ${filter === 'today' ? 'active' : ''}`}
        >
          Today
        </button>
        <button
          onClick={() => setFilter('needs_loading')}
          className={`filter-chip ${filter === 'needs_loading' ? 'active' : ''}`}
        >
          Needs Loading
        </button>
      </div>

      {/* Job Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredJobs.length === 0 ? (
          <div className="empty-state">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No jobs match the current filter</p>
          </div>
        ) : (
          <div className="job-grid">
            {filteredJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => router.push(`/supervisor/jobs/${job.id}`)}
                className="job-tile"
                style={{
                  background: `linear-gradient(135deg, ${getStatusColor(job.status)}15, ${getStatusColor(job.status)}05)`,
                  borderColor: `${getStatusColor(job.status)}40`
                }}
              >
                {/* Status Badge */}
                <div
                  className="status-indicator"
                  style={{
                    background: `${getStatusColor(job.status)}30`,
                    color: getStatusColor(job.status),
                    borderColor: `${getStatusColor(job.status)}60`
                  }}
                >
                  {job.status}
                </div>

                {/* Job Info */}
                <h3 className="job-title">{job.title}</h3>

                <div className="job-meta">
                  <div className="meta-item">
                    <User className="w-3 h-3" />
                    <span>{job.customerName}</span>
                  </div>
                  {job.propertyName && (
                    <div className="meta-item">
                      <MapPin className="w-3 h-3" />
                      <span>{job.propertyName}</span>
                    </div>
                  )}
                </div>

                {/* Load Status Bar */}
                {job.total_items > 0 && (
                  <div className="load-status">
                    <div className="load-bar-container">
                      <div
                        className="load-bar-fill"
                        style={{
                          width: `${job.completion_percentage}%`,
                          background: getLoadingColor(job.completion_percentage)
                        }}
                      />
                    </div>
                    <span className="load-text">
                      Load: {job.loaded_items}/{job.total_items}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
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

        .filter-bar {
          display: flex;
          gap: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
          border-bottom: 1px solid #333;
        }

        .filter-chip {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 9999px;
          color: #999;
          font-size: 0.875rem;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .filter-chip.active {
          background: rgba(255, 215, 0, 0.2);
          border-color: #FFD700;
          color: #FFD700;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
        }

        .job-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .job-tile {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          border: 1px solid;
          border-radius: 0.75rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          min-height: 140px;
          position: relative;
        }

        .job-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2);
        }

        .status-indicator {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          padding: 0.25rem 0.5rem;
          border: 1px solid;
          border-radius: 0.375rem;
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .job-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          line-height: 1.3;
          margin-top: 1.5rem;
        }

        .job-meta {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-top: auto;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #999;
        }

        .load-status {
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .load-bar-container {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 0.25rem;
        }

        .load-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 2px;
        }

        .load-text {
          font-size: 0.625rem;
          color: #999;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

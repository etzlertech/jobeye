'use client';

import { useCallback, useEffect, useState } from 'react';
import { JobForm } from './_components/JobForm';
import { JobList } from './_components/JobList';
import type { CustomerOption, PropertyOption } from './_components/JobForm';
import type { JobRecord } from './_components/JobList';
import type { JobFormState } from './_utils/job-utils';
import { buildJobPayload } from './_utils/job-utils';

function SupervisorJobsPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [form, setForm] = useState<JobFormState>({
    customerId: '',
    propertyId: '',
    title: '',
    description: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '',
    priority: 'normal',
    templateId: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadCustomers = useCallback(async () => {
    try {
      const response = await fetch('/api/supervisor/customers?limit=50');
      const data = await response.json();

      if (response.ok && Array.isArray(data.customers)) {
        const options = data.customers.map((customer: any) => ({
          id: customer.id,
          name: customer.name || 'Unnamed customer'
        }));
        setCustomers(options);
        setForm((prev) => ({
          ...prev,
          customerId: prev.customerId || options[0]?.id || ''
        }));
      }
    } catch (error) {
      console.error('Unable to load customers', error);
    }
  }, []);

  const loadProperties = useCallback(async () => {
    try {
      const response = await fetch('/api/supervisor/properties?limit=100');
      const data = await response.json();

      if (response.ok && Array.isArray(data.properties)) {
        const options = data.properties.map((property: any) => ({
          id: property.id,
          name: property.name || property.address?.street || 'Unnamed property',
          address: property.address ?
            `${property.address.street || ''} ${property.address.city || ''}`.trim() :
            undefined
        }));
        setProperties(options);
      }
    } catch (error) {
      console.error('Unable to load properties', error);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/jobs?simple=true');
      const data = await response.json();

      if (response.ok && Array.isArray(data.jobs)) {
        const mapped: JobRecord[] = data.jobs.map((job: any) => ({
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
          created_at: job.created_at
        }));
        setJobs(mapped);
        setMessage(`Loaded ${mapped.length} jobs`);
      } else {
        setMessage('Failed to load jobs');
      }
    } catch (error) {
      console.error('Error loading jobs', error);
      setMessage('Error loading jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
    loadProperties();
    loadJobs();
  }, [loadCustomers, loadProperties, loadJobs]);

  const updateForm = useCallback(
    <Key extends keyof JobFormState>(field: Key, value: JobFormState[Key]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setForm((prev) => ({
      customerId: prev.customerId || customers[0]?.id || '',
      propertyId: '',
      title: '',
      description: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '',
      priority: 'normal',
      templateId: '',
    }));
  }, [customers]);

  const createJob = useCallback(async () => {
    if (!form.customerId || !form.title.trim() || !form.scheduledDate) {
      setMessage('Customer, title, and scheduled date are required');
      return;
    }

    setLoading(true);
    try {
      const payload = buildJobPayload(form);

      const response = await fetch('/api/supervisor/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        setMessage('Job created successfully');
        resetForm();
        await loadJobs();
      } else {
        setMessage(data?.message || 'Failed to create job');
      }
    } catch (error) {
      console.error('Error creating job', error);
      setMessage('Error creating job');
    } finally {
      setLoading(false);
    }
  }, [form, resetForm, loadJobs]);

  const saveEdit = useCallback(
    async (id: string) => {
      if (!editingTitle.trim()) {
        setMessage('Job title cannot be empty');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/supervisor/jobs/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: editingTitle })
        });

        if (response.ok) {
          setMessage('Job updated successfully');
          setEditingId(null);
          await loadJobs();
        } else {
          setMessage('Failed to update job');
        }
      } catch (error) {
        console.error('Error updating job', error);
        setMessage('Error updating job');
      } finally {
        setLoading(false);
      }
    },
    [editingTitle, loadJobs]
  );

  const deleteJob = useCallback(
    async (id: string, title: string) => {
      if (!window.confirm(`Delete job "${title}"?`)) {
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/supervisor/jobs/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          setMessage('Job deleted successfully');
          await loadJobs();
        } else {
          setMessage('Failed to delete job');
        }
      } catch (error) {
        console.error('Error deleting job', error);
        setMessage('Error deleting job');
      } finally {
        setLoading(false);
      }
    },
    [loadJobs]
  );

  const updateJobStatus = useCallback(
    async (id: string, status: string) => {
      setLoading(true);
      try {
        const response = await fetch(`/api/supervisor/jobs/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        });

        if (response.ok) {
          setMessage(`Job status updated to ${status}`);
          await loadJobs();
        } else {
          setMessage('Failed to update job status');
        }
      } catch (error) {
        console.error('Error updating job status', error);
        setMessage('Error updating job status');
      } finally {
        setLoading(false);
      }
    },
    [loadJobs]
  );

  const beginEdit = useCallback((id: string, title: string) => {
    setEditingId(id);
    setEditingTitle(title);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingTitle('');
  }, []);

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Job Management</h1>
          <p className="mt-2 text-gray-400">
            Schedule and manage service jobs with customer and property assignments
          </p>
          {message && (
            <div className="mt-4 rounded-md bg-blue-900/50 border border-blue-700 px-4 py-2 text-blue-200">
              {message}
            </div>
          )}
        </div>

        <JobForm
          draft={form}
          customers={customers}
          properties={properties}
          onDraftChange={updateForm}
          onSubmit={createJob}
          onClear={resetForm}
          disabled={loading}
        />

        <JobList
          jobs={jobs}
          isLoading={loading}
          tenantAvailable={true}
          editingId={editingId}
          editingTitle={editingTitle}
          onEditChange={setEditingTitle}
          onStartEdit={beginEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onDelete={deleteJob}
          onRefresh={loadJobs}
          onStatusChange={updateJobStatus}
        />
      </div>
    </div>
  );
}

// Authentication handled by middleware.ts (checks session, role, tenant)
export default SupervisorJobsPage;

/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-jobs/useJobDev.ts
phase: dev-crud
domain: supervisor
purpose: Manage job CRUD state and operations for dev tooling
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 300
dependencies:
  internal:
    - '@/app/demo-jobs/utils'
    - '@/app/demo-jobs/_components/JobForm'
    - '@/app/demo-jobs/_components/JobList'
  external:
    - 'react'
voice_considerations:
  - Centralizes messaging so voice prompts stay consistent across actions
*/

import { useCallback, useMemo, useState } from 'react';
import type { DevAlertTone } from '@/hooks/useDevAlert';
import type { JobFormState } from '@/app/demo-jobs/utils';
import type { CustomerOption, PropertyOption } from '@/app/demo-jobs/_components/JobForm';
import type { JobRecord } from '@/app/demo-jobs/_components/JobList';
import { buildJobPayload } from '@/app/demo-jobs/utils';

interface UseJobDevArgs {
  tenantId: string | null;
  tenantHeaders: Record<string, string>;
  requireSignIn: boolean;
  setAlertMessage: (text: string, tone?: DevAlertTone) => void;
}

export function useJobDev({ tenantId, tenantHeaders, requireSignIn, setAlertMessage }: UseJobDevArgs) {
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
    notes: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const tenantAvailable = useMemo(() => Boolean(tenantId), [tenantId]);

  const loadCustomers = useCallback(async () => {
    if (!tenantId || requireSignIn) {
      return;
    }

    try {
      const response = await fetch('/api/supervisor/customers?limit=50', {
        headers: {
          Accept: 'application/json',
          ...tenantHeaders
        }
      });
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
    } catch {
      setAlertMessage('Unable to load customers', 'error');
    }
  }, [tenantId, requireSignIn, tenantHeaders, setAlertMessage]);

  const loadProperties = useCallback(async () => {
    if (!tenantId || requireSignIn) {
      return;
    }

    try {
      const response = await fetch('/api/supervisor/properties?limit=100', {
        headers: {
          Accept: 'application/json',
          ...tenantHeaders
        }
      });
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
    } catch {
      setAlertMessage('Unable to load properties', 'error');
    }
  }, [tenantId, requireSignIn, tenantHeaders, setAlertMessage]);

  const loadJobs = useCallback(async () => {
    if (!tenantId || requireSignIn) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/jobs?simple=true', {
        headers: {
          Accept: 'application/json',
          ...tenantHeaders
        }
      });
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
        setAlertMessage(`Loaded ${mapped.length} jobs`, 'success');
      } else {
        const message = typeof data?.error === 'object' 
          ? data.error.message || 'Failed to load jobs'
          : data?.error || data?.message || 'Failed to load jobs';
        setAlertMessage(message, 'error');
      }
    } catch {
      setAlertMessage('Error loading jobs', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, requireSignIn, tenantHeaders, setAlertMessage]);

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
      notes: ''
    }));
  }, [customers]);

  const createJob = useCallback(async () => {
    if (!tenantId || requireSignIn) {
      setAlertMessage('Sign in to create jobs', 'error');
      return;
    }

    if (!form.customerId || !form.title.trim() || !form.scheduledDate) {
      setAlertMessage('Customer, title, and scheduled date are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = buildJobPayload(form);

      const response = await fetch('/api/supervisor/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tenantHeaders
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        setAlertMessage('Job created successfully', 'success');
        resetForm();
        await loadJobs();
      } else {
        const message = data?.message || 'Failed to create job';
        setAlertMessage(message, 'error');
      }
    } catch {
      setAlertMessage('Error creating job', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, requireSignIn, form, tenantHeaders, resetForm, loadJobs, setAlertMessage]);

  const saveEdit = useCallback(
    async (id: string) => {
      if (!tenantId || requireSignIn) {
        setAlertMessage('Sign in to update jobs', 'error');
        return;
      }

      if (!editingTitle.trim()) {
        setAlertMessage('Job title cannot be empty', 'error');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/supervisor/jobs/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...tenantHeaders
          },
          body: JSON.stringify({ title: editingTitle })
        });

        if (response.ok) {
          setAlertMessage('Job updated successfully', 'success');
          setEditingId(null);
          await loadJobs();
        } else {
          const data = await response.json();
          const message = typeof data?.error === 'object' 
            ? data.error.message || 'Failed to update job'
            : data?.error || 'Failed to update job';
          setAlertMessage(message, 'error');
        }
      } catch {
        setAlertMessage('Error updating job', 'error');
      } finally {
        setLoading(false);
      }
    },
    [tenantId, requireSignIn, editingTitle, tenantHeaders, loadJobs, setAlertMessage]
  );

  const deleteJob = useCallback(
    async (id: string, title: string) => {
      if (!tenantId || requireSignIn) {
        setAlertMessage('Sign in to delete jobs', 'error');
        return;
      }

      if (!window.confirm(`Delete job "${title}"?`)) {
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/supervisor/jobs/${id}`, {
          method: 'DELETE',
          headers: tenantHeaders
        });

        if (response.ok) {
          setAlertMessage('Job deleted successfully', 'success');
          await loadJobs();
        } else {
          const data = await response.json();
          const message = typeof data?.error === 'object' 
            ? data.error.message || 'Failed to delete job'
            : data?.error || 'Failed to delete job';
          setAlertMessage(message, 'error');
        }
      } catch {
        setAlertMessage('Error deleting job', 'error');
      } finally {
        setLoading(false);
      }
    },
    [tenantId, requireSignIn, tenantHeaders, loadJobs, setAlertMessage]
  );

  const updateJobStatus = useCallback(
    async (id: string, status: string) => {
      if (!tenantId || requireSignIn) {
        setAlertMessage('Sign in to update job status', 'error');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/supervisor/jobs/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...tenantHeaders
          },
          body: JSON.stringify({ status })
        });

        if (response.ok) {
          setAlertMessage(`Job status updated to ${status}`, 'success');
          await loadJobs();
        } else {
          const data = await response.json();
          const message = typeof data?.error === 'object' 
            ? data.error.message || 'Failed to update job status'
            : data?.error || 'Failed to update job status';
          setAlertMessage(message, 'error');
        }
      } catch {
        setAlertMessage('Error updating job status', 'error');
      } finally {
        setLoading(false);
      }
    },
    [tenantId, requireSignIn, tenantHeaders, loadJobs, setAlertMessage]
  );

  const beginEdit = useCallback((id: string, title: string) => {
    setEditingId(id);
    setEditingTitle(title);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingTitle('');
  }, []);

  return {
    customers,
    properties,
    form,
    updateForm,
    resetForm,
    jobs,
    editingId,
    editingTitle,
    setEditingTitle,
    beginEdit,
    cancelEdit,
    saveEdit,
    deleteJob,
    createJob,
    updateJobStatus,
    loadCustomers,
    loadProperties,
    loadJobs,
    loading,
    tenantAvailable
  };
}
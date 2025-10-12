/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-jobs/page.tsx
phase: dev-crud
domain: supervisor
purpose: Dev CRUD surface for jobs using shared tenant/session plumbing
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 200
dependencies:
  internal:
    - '@/components/demo/DevAlert'
    - '@/components/demo/DevLayout'
    - '@/hooks/useDevAlert'
    - '@/hooks/useDevTenant'
    - '@/app/demo-jobs/_components/JobForm'
    - '@/app/demo-jobs/_components/JobList'
    - '@/app/demo-jobs/useJobDev'
  external:
    - 'react'
    - 'lucide-react'
voice_considerations:
  - Ensures prompts surface job information for voice-driven QA
*/

'use client';

import { useEffect } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import DevLayout from '@/components/demo/DevLayout';
import { DevAlert } from '@/components/demo/DevAlert';
import TenantUserInfo from '@/components/demo/TenantUserInfo';
import { useDevAlert } from '@/hooks/useDevAlert';
import { useDevTenant } from '@/hooks/useDevTenant';
import { JobForm } from '@/app/demo-jobs/_components/JobForm';
import { JobList } from '@/app/demo-jobs/_components/JobList';
import { useJobDev } from '@/app/demo-jobs/useJobDev';

export default function DemoJobsPage() {
  const {
    tenantId,
    tenantHeaders,
    loading: tenantLoading,
    statusMessage,
    requireSignIn,
    refreshTenant
  } = useDevTenant({ redirectPath: '/demo-jobs' });

  const { alert, setAlertMessage } = useDevAlert();

  const {
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
  } = useJobDev({
    tenantId,
    tenantHeaders,
    requireSignIn,
    setAlertMessage
  });

  const combinedLoading = tenantLoading || loading;

  useEffect(() => {
    if (statusMessage) {
      setAlertMessage(statusMessage, requireSignIn ? 'error' : 'info');
    }
  }, [statusMessage, requireSignIn, setAlertMessage]);

  useEffect(() => {
    if (tenantId && !requireSignIn) {
      loadCustomers();
      loadProperties();
      loadJobs();
    }
  }, [tenantId, requireSignIn, loadCustomers, loadProperties, loadJobs]);

  const handleRefresh = async () => {
    await refreshTenant();
    await loadCustomers();
    await loadProperties();
    await loadJobs();
  };

  return (
    <DevLayout
      title="JobEye Jobs"
      description="Schedule and manage service jobs with customer and property assignments."
      actions={
        <button
          type="button"
          onClick={handleRefresh}
          disabled={combinedLoading}
          className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-700 disabled:opacity-60"
        >
          {combinedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh Session
        </button>
      }
    >
      <DevAlert alert={alert} />

      <TenantUserInfo />

      <JobForm
        draft={form}
        customers={customers}
        properties={properties}
        onDraftChange={updateForm}
        onSubmit={createJob}
        onClear={resetForm}
        disabled={combinedLoading}
      />

      <JobList
        jobs={jobs}
        isLoading={combinedLoading}
        tenantAvailable={tenantAvailable}
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
    </DevLayout>
  );
}
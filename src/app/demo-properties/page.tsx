/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-properties/page.tsx
phase: dev-crud
domain: supervisor
purpose: Dev CRUD surface for properties using shared tenant/session plumbing
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 200
dependencies:
  internal:
    - '@/components/demo/DevAlert'
    - '@/components/demo/DevLayout'
    - '@/hooks/useDevAlert'
    - '@/hooks/useDevTenant'
    - '@/app/demo-properties/_components/PropertyForm'
    - '@/app/demo-properties/_components/PropertyList'
    - '@/app/demo-properties/usePropertyDev'
  external:
    - 'react'
    - 'lucide-react'
voice_considerations:
  - Ensures prompts surface address information for voice-driven QA
*/

'use client';

import { useEffect } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import DevLayout from '@/components/demo/DevLayout';
import { DevAlert } from '@/components/demo/DevAlert';
import { useDevAlert } from '@/hooks/useDevAlert';
import { useDevTenant } from '@/hooks/useDevTenant';
import { PropertyForm } from '@/app/demo-properties/_components/PropertyForm';
import { PropertyList } from '@/app/demo-properties/_components/PropertyList';
import { usePropertyDev } from '@/app/demo-properties/usePropertyDev';

export default function DemoPropertiesPage() {
  const {
    tenantId,
    tenantHeaders,
    loading: tenantLoading,
    statusMessage,
    requireSignIn,
    refreshTenant
  } = useDevTenant({ redirectPath: '/demo-properties' });

  const { alert, setAlertMessage } = useDevAlert();

  const {
    customers,
    form,
    updateForm,
    resetForm,
    properties,
    editingId,
    editingName,
    setEditingName,
    beginEdit,
    cancelEdit,
    saveEdit,
    deleteProperty,
    createProperty,
    loadCustomers,
    loadProperties,
    loading,
    tenantAvailable
  } = usePropertyDev({
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
    }
  }, [tenantId, requireSignIn, loadCustomers, loadProperties]);

  const handleRefresh = async () => {
    await refreshTenant();
    await loadCustomers();
    await loadProperties();
  };

  return (
    <DevLayout
      title="JobEye Properties"
      description="Link properties to customers and manage addresses quickly."
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

      <PropertyForm
        draft={form}
        customers={customers}
        onDraftChange={updateForm}
        onSubmit={createProperty}
        onClear={resetForm}
        disabled={combinedLoading}
      />

      <PropertyList
        properties={properties}
        isLoading={combinedLoading}
        tenantAvailable={tenantAvailable}
        editingId={editingId}
        editingName={editingName}
        onEditChange={setEditingName}
        onStartEdit={beginEdit}
        onCancelEdit={cancelEdit}
        onSaveEdit={saveEdit}
        onDelete={deleteProperty}
        onRefresh={loadProperties}
      />
    </DevLayout>
  );
}

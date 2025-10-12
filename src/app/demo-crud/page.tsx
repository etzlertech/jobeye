/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-crud/page.tsx
phase: dev-crud
domain: supervisor
purpose: Customer CRUD playground using shared dev layout and tenant hook
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 220
dependencies:
  internal:
    - '@/components/demo/DevAlert'
    - '@/components/demo/DevLayout'
    - '@/hooks/useDevAlert'
    - '@/hooks/useDevTenant'
    - '@/app/demo-crud/_components/CustomerForm'
    - '@/app/demo-crud/_components/CustomerList'
  external:
    - 'react'
    - 'lucide-react'
voice_considerations:
  - Provide clear prompts when sign-in is required for voice-guided testing
*/

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import DevLayout from '@/components/demo/DevLayout';
import { DevAlert } from '@/components/demo/DevAlert';
import { useDevAlert } from '@/hooks/useDevAlert';
import { useDevTenant } from '@/hooks/useDevTenant';
import { CustomerForm, CustomerDraft } from '@/app/demo-crud/_components/CustomerForm';
import { CustomerList, CustomerRecord } from '@/app/demo-crud/_components/CustomerList';

const initialDraft: CustomerDraft = { name: '', email: '', phone: '' };

export default function DemoCustomersPage() {
  const {
    tenantId,
    tenantHeaders,
    loading: tenantLoading,
    statusMessage,
    requireSignIn,
    refreshTenant
  } = useDevTenant({ redirectPath: '/demo-crud' });

  const { alert, setAlertMessage } = useDevAlert();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [draft, setDraft] = useState<CustomerDraft>(initialDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);

  const combinedLoading = tenantLoading || loading;

  useEffect(() => {
    if (statusMessage) {
      setAlertMessage(statusMessage, requireSignIn ? 'error' : 'info');
    }
  }, [statusMessage, requireSignIn, setAlertMessage]);

  const loadCustomers = useCallback(async () => {
    if (!tenantId || requireSignIn) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/customers?demo=true', {
        headers: {
          Accept: 'application/json',
          ...tenantHeaders
        }
      });
      const data = await response.json();

      if (response.ok && Array.isArray(data.customers)) {
        setCustomers(data.customers);
        setAlertMessage(`Loaded ${data.customers.length} customers`, 'success');
      } else {
        const message = data?.error || data?.message || 'Failed to fetch customers';
        setAlertMessage(message, 'error');
      }
    } catch {
      setAlertMessage('Error loading customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantHeaders, requireSignIn, setAlertMessage]);

  useEffect(() => {
    if (tenantId && !requireSignIn) {
      loadCustomers();
    }
  }, [tenantId, requireSignIn, loadCustomers]);

  const updateDraft = useCallback((field: keyof CustomerDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetDraft = () => setDraft(initialDraft);

  const handleCreate = async () => {
    if (!tenantId || requireSignIn) {
      setAlertMessage('Sign in to create customers', 'error');
      return;
    }

    if (!draft.name.trim() || !draft.email.trim()) {
      setAlertMessage('Name and email are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/customers?demo=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tenantHeaders
        },
        body: JSON.stringify(draft)
      });
      const data = await response.json();

      if (response.ok) {
        setAlertMessage('Customer created successfully!', 'success');
        resetDraft();
        await loadCustomers();
      } else {
        const message = data?.message || 'Failed to create customer';
        setAlertMessage(message, 'error');
      }
    } catch {
      setAlertMessage('Error creating customer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!tenantId || requireSignIn) {
      setAlertMessage('Sign in to update customers', 'error');
      return;
    }

    if (!editName.trim()) {
      setAlertMessage('Name cannot be empty', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/customers/${id}?demo=true`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...tenantHeaders
        },
        body: JSON.stringify({ customer_name: editName })
      });

      if (response.ok) {
        setAlertMessage('Customer updated successfully!', 'success');
        setEditingId(null);
        await loadCustomers();
      } else {
        const data = await response.json();
        const message = data?.error || 'Failed to update customer';
        setAlertMessage(message, 'error');
      }
    } catch {
      setAlertMessage('Error updating customer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!tenantId || requireSignIn) {
      setAlertMessage('Sign in to delete customers', 'error');
      return;
    }

    if (!window.confirm(`Delete customer "${name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/customers/${id}?demo=true`, {
        method: 'DELETE',
        headers: tenantHeaders
      });

      if (response.ok) {
        setAlertMessage('Customer deleted successfully!', 'success');
        await loadCustomers();
      } else {
        const data = await response.json();
        const message = data?.error || 'Failed to delete customer';
        setAlertMessage(message, 'error');
      }
    } catch {
      setAlertMessage('Error deleting customer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    await refreshTenant();
    await loadCustomers();
  }, [refreshTenant, loadCustomers]);

  return (
    <DevLayout
      title="JobEye Customers"
      description="Lightweight CRUD interface backed by live Supabase data."
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

      <CustomerForm
        draft={draft}
        onChange={updateDraft}
        onSubmit={handleCreate}
        onClear={resetDraft}
        disabled={combinedLoading}
      />

      <CustomerList
        customers={customers}
        isLoading={combinedLoading}
        tenantAvailable={Boolean(tenantId)}
        editingId={editingId}
        editName={editName}
        onEditChange={setEditName}
        onStartEdit={(id, name) => {
          setEditingId(id);
          setEditName(name);
        }}
        onCancelEdit={() => setEditingId(null)}
        onSaveEdit={handleUpdate}
        onDelete={handleDelete}
        onRefresh={loadCustomers}
      />
    </DevLayout>
  );
}

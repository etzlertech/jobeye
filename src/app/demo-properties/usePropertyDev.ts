/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-properties/usePropertyDev.ts
phase: dev-crud
domain: supervisor
purpose: Manage property CRUD state and operations for dev tooling
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 260
dependencies:
  internal:
    - '@/components/demo/DevAlert'
    - '@/app/demo-properties/_components/PropertyForm'
    - '@/app/demo-properties/_components/PropertyList'
  external:
    - 'react'
voice_considerations:
  - Centralizes messaging so voice prompts stay consistent across actions
*/

import { useCallback, useMemo, useState } from 'react';
import type { DevAlertTone } from '@/hooks/useDevAlert';
import type { PropertyFormState, CustomerOption } from '@/app/demo-properties/_components/PropertyForm';
import type { PropertyRecord } from '@/app/demo-properties/_components/PropertyList';
import { buildPropertyPayload, formatPropertyAddress } from '@/app/demo-properties/utils';

interface UsePropertyDevArgs {
  tenantId: string | null;
  tenantHeaders: Record<string, string>;
  requireSignIn: boolean;
  setAlertMessage: (text: string, tone?: DevAlertTone) => void;
}

export function usePropertyDev({ tenantId, tenantHeaders, requireSignIn, setAlertMessage }: UsePropertyDevArgs) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [form, setForm] = useState<PropertyFormState>({
    customerId: '',
    propertyName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    notes: ''
  });
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
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
      setAlertMessage('Unable to load customers for property assignment', 'error');
    }
  }, [tenantId, requireSignIn, tenantHeaders, setAlertMessage]);

  const loadProperties = useCallback(async () => {
    if (!tenantId || requireSignIn) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/properties', {
        headers: {
          Accept: 'application/json',
          ...tenantHeaders
        }
      });
      const data = await response.json();

      if (response.ok && Array.isArray(data.properties)) {
        const mapped: PropertyRecord[] = data.properties.map((property: any) => ({
          id: property.id,
          name: property.name || property.address?.line1 || 'Unnamed property',
          addressLabel: formatPropertyAddress(property.address),
          customerName: property.customer?.name || 'Unknown customer',
          createdAt: property.created_at
        }));
        setProperties(mapped);
        setAlertMessage(`Loaded ${mapped.length} properties`, 'success');
      } else {
        // Handle nested error structure from API
        const message = typeof data?.error === 'object' 
          ? data.error.message || 'Failed to load properties'
          : data?.error || data?.message || 'Failed to load properties';
        setAlertMessage(message, 'error');
      }
    } catch {
      setAlertMessage('Error loading properties', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, requireSignIn, tenantHeaders, setAlertMessage]);

  const updateForm = useCallback(
    <Key extends keyof PropertyFormState>(field: Key, value: PropertyFormState[Key]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setForm((prev) => ({
      customerId: prev.customerId || customers[0]?.id || '',
      propertyName: '',
      addressLine1: '',
      city: '',
      state: '',
      postalCode: '',
      notes: ''
    }));
  }, [customers]);

  const createProperty = useCallback(async () => {
    if (!tenantId || requireSignIn) {
      setAlertMessage('Sign in to create properties', 'error');
      return;
    }

    if (!form.customerId || !form.addressLine1.trim()) {
      setAlertMessage('Customer and address are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = buildPropertyPayload(form);

      const response = await fetch('/api/supervisor/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tenantHeaders
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        setAlertMessage('Property created successfully', 'success');
        resetForm();
        await loadProperties();
      } else {
        const message = data?.message || 'Failed to create property';
        setAlertMessage(message, 'error');
      }
    } catch {
      setAlertMessage('Error creating property', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, requireSignIn, form, tenantHeaders, resetForm, loadProperties, setAlertMessage]);

  const saveEdit = useCallback(
    async (id: string) => {
      if (!tenantId || requireSignIn) {
        setAlertMessage('Sign in to update properties', 'error');
        return;
      }

      if (!editingName.trim()) {
        setAlertMessage('Property name cannot be empty', 'error');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/supervisor/properties/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...tenantHeaders
          },
          body: JSON.stringify({ name: editingName })
        });

        if (response.ok) {
          setAlertMessage('Property updated successfully', 'success');
          setEditingId(null);
          await loadProperties();
        } else {
          const data = await response.json();
          const message = typeof data?.error === 'object' 
            ? data.error.message || 'Failed to update property'
            : data?.error || 'Failed to update property';
          setAlertMessage(message, 'error');
        }
      } catch {
        setAlertMessage('Error updating property', 'error');
      } finally {
        setLoading(false);
      }
    },
    [tenantId, requireSignIn, editingName, tenantHeaders, loadProperties, setAlertMessage]
  );

  const deleteProperty = useCallback(
    async (id: string, label: string) => {
      if (!tenantId || requireSignIn) {
        setAlertMessage('Sign in to delete properties', 'error');
        return;
      }

      if (!window.confirm(`Delete property "${label}"?`)) {
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/supervisor/properties/${id}`, {
          method: 'DELETE',
          headers: tenantHeaders
        });

        if (response.ok) {
          setAlertMessage('Property deleted successfully', 'success');
          await loadProperties();
        } else {
          const data = await response.json();
          const message = typeof data?.error === 'object' 
            ? data.error.message || 'Failed to delete property'
            : data?.error || 'Failed to delete property';
          setAlertMessage(message, 'error');
        }
      } catch {
        setAlertMessage('Error deleting property', 'error');
      } finally {
        setLoading(false);
      }
    },
    [tenantId, requireSignIn, tenantHeaders, loadProperties, setAlertMessage]
  );

  const beginEdit = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  return {
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
  };
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Trash2, Edit, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export default function DemoCRUDPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [tenantId, setTenantId] = useState<string | null>(null);

  const loadCustomers = useCallback(async (tenant: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/supervisor/customers?demo=true', {
        headers: {
          'x-tenant-id': tenant
        }
      });
      const data = await response.json();

      if (response.ok && data.customers) {
        setCustomers(data.customers);
        setMessage(`Loaded ${data.customers.length} customers`);
      } else {
        setMessage(data.error || 'Failed to fetch customers');
      }
    } catch (error) {
      setMessage('Error loading customers');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize tenant context and load customers
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          setMessage('Please sign in via /simple-signin?redirectTo=/demo-crud');
          return;
        }

        const tenant =
          (data.session.user.app_metadata?.tenant_id as string | undefined) ||
          (data.session.user.user_metadata?.tenant_id as string | undefined) ||
          'demo-company';

        setTenantId(tenant);
        await loadCustomers(tenant);
      } catch (err) {
        setMessage('Unable to initialize session.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [loadCustomers]);

  const createCustomer = async () => {
    if (!tenantId) {
      setMessage('Missing tenant context');
      return;
    }

    if (!newCustomer.name || !newCustomer.email) {
      setMessage('Name and email are required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/supervisor/customers?demo=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify(newCustomer)
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Customer created successfully!');
        setNewCustomer({ name: '', email: '', phone: '' });
        await loadCustomers(tenantId);
      } else {
        setMessage(`Error: ${data.message || 'Failed to create customer'}`);
      }
    } catch (error) {
      setMessage('Error creating customer');
    } finally {
      setLoading(false);
    }
  };

  const updateCustomer = async (id: string) => {
    if (!tenantId) {
      setMessage('Missing tenant context');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/supervisor/customers/${id}?demo=true`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ customer_name: editName })
      });

      if (response.ok) {
        setMessage('Customer updated successfully!');
        setEditingId(null);
        await loadCustomers(tenantId);
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to update customer');
      }
    } catch (error) {
      setMessage('Error updating customer');
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id: string, name: string) => {
    if (!tenantId) {
      setMessage('Missing tenant context');
      return;
    }

    if (!confirm(`Delete customer "${name}"?`)) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/supervisor/customers/${id}?demo=true`, {
        method: 'DELETE',
        headers: {
          'x-tenant-id': tenantId
        }
      });

      if (response.ok) {
        setMessage('Customer deleted successfully!');
        await loadCustomers(tenantId);
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to delete customer');
      }
    } catch (error) {
      setMessage('Error deleting customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">JobEye CRUD Demo</h1>
        <p className="text-gray-400">
          Railway Production - Direct Supabase Operations (ensure you sign in via 
          <span className="underline">/simple-signin?redirectTo=/demo-crud</span>)
        </p>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg">
          {message}
        </div>
      )}

      {/* Create Customer Form */}
      <div className="mb-8 p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <h2 className="text-xl font-semibold text-green-400 mb-4">Create New Customer</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Customer Name"
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
            className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-green-400"
          />
          <input
            type="email"
            placeholder="Email"
            value={newCustomer.email}
            onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
            className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-green-400"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
            className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-green-400"
          />
        </div>
        <button
          onClick={createCustomer}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Customer
        </button>
      </div>

      {/* Customer List */}
      <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-blue-400">Customer List</h2>
          <button
            onClick={() => tenantId && loadCustomers(tenantId)}
            disabled={loading || !tenantId}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {loading && customers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading customers...
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No customers found. Create one above!
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map((customer) => (
              <div key={customer.id} className="p-3 bg-gray-800 rounded-lg flex items-center justify-between">
                {editingId === customer.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="px-3 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-400"
                      autoFocus
                    />
                    <button
                      onClick={() => updateCustomer(customer.id)}
                      disabled={loading}
                      className="p-2 bg-green-600 hover:bg-green-700 rounded text-white"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditName('');
                      }}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-lg">{customer.name}</p>
                    <p className="text-sm text-gray-300">{customer.email}</p>
                    {customer.phone && <p className="text-sm text-gray-400">{customer.phone}</p>}
                  </div>
                )}

                {editingId !== customer.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(customer.id);
                        setEditName(customer.name);
                      }}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteCustomer(customer.id, customer.name)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

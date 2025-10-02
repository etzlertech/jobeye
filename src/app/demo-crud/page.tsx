'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit, Check, X, Loader2 } from 'lucide-react';

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

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/supervisor/customers?demo=true');
      const data = await response.json();
      
      if (data.customers) {
        setCustomers(data.customers);
        setMessage(`Loaded ${data.customers.length} customers`);
      }
    } catch (error) {
      setMessage('Error loading customers');
    } finally {
      setLoading(false);
    }
  };

  const createCustomer = async () => {
    if (!newCustomer.name || !newCustomer.email) {
      setMessage('Name and email are required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/supervisor/customers?demo=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      
      const data = await response.json();
      if (response.ok) {
        setMessage('Customer created successfully!');
        setNewCustomer({ name: '', email: '', phone: '' });
        loadCustomers();
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
    try {
      setLoading(true);
      const response = await fetch(`/api/supervisor/customers/${id}?demo=true`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: editName })
      });
      
      if (response.ok) {
        setMessage('Customer updated successfully!');
        setEditingId(null);
        loadCustomers();
      }
    } catch (error) {
      setMessage('Error updating customer');
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/supervisor/customers/${id}?demo=true`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setMessage('Customer deleted successfully!');
        loadCustomers();
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
        <p className="text-gray-400">Railway Production - Direct Supabase Operations</p>
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
            onClick={loadCustomers}
            disabled={loading}
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
                      className="p-1 text-green-400 hover:text-green-300"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="font-semibold">{customer.name}</div>
                      <div className="text-sm text-gray-400">{customer.email}</div>
                      {customer.phone && <div className="text-sm text-gray-500">{customer.phone}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(customer.id);
                          setEditName(customer.name);
                        }}
                        className="p-2 text-blue-400 hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCustomer(customer.id, customer.name)}
                        disabled={loading}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CRUD Summary */}
      <div className="mt-8 p-4 bg-gray-900 border border-yellow-600 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-400 mb-2">CRUD Operations Demo</h3>
        <ul className="space-y-1 text-sm text-gray-300">
          <li>✅ <strong>CREATE:</strong> Add new customers with the form above</li>
          <li>✅ <strong>READ:</strong> View all customers in the list</li>
          <li>✅ <strong>UPDATE:</strong> Click edit icon to modify customer names</li>
          <li>✅ <strong>DELETE:</strong> Click trash icon to remove customers</li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          Connected to Railway Supabase: rtwigjwqufozqfwozpvo
        </p>
      </div>
    </div>
  );
}
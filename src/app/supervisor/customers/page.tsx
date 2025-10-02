/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/supervisor/customers/page.tsx
 * phase: 3
 * domain: supervisor
 * purpose: Customer management page for supervisors
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-ui.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['loading', 'list_view', 'create_mode', 'edit_mode'],
 *   transitions: [
 *     'loading->list_view: dataLoaded()',
 *     'list_view->create_mode: clickCreate()',
 *     'list_view->edit_mode: selectCustomer()',
 *     'create_mode->list_view: saveComplete()',
 *     'edit_mode->list_view: updateComplete()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "ui": "$0.00"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: ['@/components/ui/ButtonLimiter'],
 *   external: ['react', 'next/navigation'],
 *   supabase: []
 * }
 * exports: ['default']
 * voice_considerations: Voice commands for customer search and creation
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/supervisor-customers.test.ts'
 * }
 * tasks: [
 *   'Create customer list view',
 *   'Add customer creation form',
 *   'Implement search and filtering',
 *   'Professional UI styling'
 * ]
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  MapPin,
  Building,
  Edit,
  Trash2,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Home,
  X,
  Save,
  Loader2
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  property_count?: number;
  created_at: string;
}

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

export default function SupervisorCustomersPage() {
  const router = useRouter();
  const { actions, addAction, clearActions } = useButtonActions();

  // State
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<CustomerFormData>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Set up button actions based on view
  useEffect(() => {
    clearActions();

    if (view === 'list') {
      addAction({
        id: 'back',
        label: 'Back to Dashboard',
        priority: 'medium',
        icon: ArrowLeft,
        onClick: () => router.push('/supervisor'),
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });

      addAction({
        id: 'create-customer',
        label: 'Add New Customer',
        priority: 'high',
        icon: Plus,
        onClick: () => {
          setView('create');
          resetForm();
        },
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });
    } else if (view === 'create' || view === 'edit') {
      addAction({
        id: 'cancel',
        label: 'Cancel',
        priority: 'medium',
        icon: X,
        onClick: () => {
          setView('list');
          resetForm();
        },
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });

      addAction({
        id: 'save',
        label: isSaving ? 'Saving...' : 'Save Customer',
        priority: 'high',
        icon: Save,
        disabled: isSaving,
        onClick: handleSubmit,
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });
    }
  }, [view, isSaving, clearActions, addAction, router]);

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/supervisor/customers');
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setCustomers(data.customers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      notes: ''
    });
    setFormErrors({});
    setSelectedCustomer(null);
  };

  const validateForm = (): boolean => {
    const errors: Partial<CustomerFormData> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const url = view === 'edit' && selectedCustomer
        ? `/api/supervisor/customers/${selectedCustomer.id}`
        : '/api/supervisor/customers';

      const method = view === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setSuccess(view === 'edit' ? 'Customer updated successfully' : 'Customer created successfully');
      setTimeout(() => setSuccess(null), 3000);

      // Refresh list and return to list view
      await loadCustomers();
      setView('list');
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || ''
    });
    setView('edit');
  };

  const handleDelete = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const response = await fetch(`/api/supervisor/customers/${customerId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message);
      }

      setSuccess('Customer deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete customer');
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (customer.phone && customer.phone.includes(searchQuery))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading customers...</p>
        </div>
      </div>
    );
  }

  // List View
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="bg-white shadow-lg border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-emerald-600" />
                <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
              </div>
              <div className="text-sm text-gray-500">
                {filteredCustomers.length} customers
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-800">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="text-emerald-800">{success}</span>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Search Bar */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search customers by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Customer List */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {filteredCustomers.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers found</h3>
                    <p className="text-gray-500">
                      {searchQuery ? 'Try adjusting your search' : 'Add your first customer to get started'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleEdit(customer)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {customer.name}
                              </h3>
                              {customer.property_count && customer.property_count > 0 && (
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                                  {customer.property_count} properties
                                </span>
                              )}
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <Mail className="w-4 h-4" />
                                <span>{customer.email}</span>
                              </div>
                              
                              {customer.phone && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Phone className="w-4 h-4" />
                                  <span>{customer.phone}</span>
                                </div>
                              )}
                              
                              {customer.address && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <MapPin className="w-4 h-4" />
                                  <span>{customer.address}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(customer);
                              }}
                              className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(customer.id);
                              }}
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Actions */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
                <ButtonLimiter
                  actions={actions}
                  maxVisibleButtons={4}
                  showVoiceButton={false}
                  layout="stack"
                  buttonSize="md"
                  className="w-full"
                />
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Overview</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Properties</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {customers.reduce((sum, c) => sum + (c.property_count || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Create/Edit Form View
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <Users className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              {view === 'edit' ? 'Edit Customer' : 'Add New Customer'}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  formErrors.name 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-emerald-500'
                }`}
                placeholder="Enter customer name"
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  formErrors.email 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-emerald-500'
                }`}
                placeholder="customer@example.com"
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Address Field */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter customer address"
              />
            </div>

            {/* Notes Field */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Additional notes about the customer..."
              />
            </div>

            {/* Form Actions */}
            <div className="pt-4">
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={false}
                layout="inline"
                buttonSize="lg"
                className="w-full justify-end"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
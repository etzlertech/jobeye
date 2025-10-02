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
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  Plus,
  Search,
  Users,
  MapPin,
  Mail,
  Phone,
  Edit,
  Trash2,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
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

  // Demo auth helper
  const authenticateAsDemo = async () => {
    try {
      // Call demo auth API
      const response = await fetch('/api/demo/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        // Reload to trigger middleware with demo auth
        window.location.reload();
      } else {
        setError('Failed to activate demo mode');
      }
    } catch (err) {
      console.error('Demo auth error:', err);
      setError('Failed to activate demo mode');
    }
  };

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      // Add demo parameter for unauthenticated access
      const response = await fetch('/api/supervisor/customers?demo=true');
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

      // Add demo flag to body for unauthenticated access
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, demo: true })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      // Use the specific message from the API response that indicates if it was saved to database
      setSuccess(data.message || (view === 'edit' ? 'Customer updated successfully' : 'Customer created successfully'));
      setTimeout(() => setSuccess(null), 5000); // Longer display time for database confirmation

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
      // Add tenant ID header for demo mode
      const headers: HeadersInit = {};
      const isDemo = document.cookie.includes('isDemo=true');
      if (isDemo) {
        headers['x-tenant-id'] = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'; // Demo tenant ID
      }

      const response = await fetch(`/api/supervisor/customers/${customerId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message);
      }

      // Use the specific message from the API response that indicates if it was deleted from database
      setSuccess(data.message || 'Customer deleted successfully');
      setTimeout(() => setSuccess(null), 5000); // Longer display time for database confirmation
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
      <div className="w-full max-w-[375px] h-screen max-h-[812px] mx-auto bg-black text-white overflow-hidden flex flex-col items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-golden mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading customers...</p>
        </div>
      </div>
    );
  }

  // List View
  if (view === 'list') {
    return (
      <div className="w-full max-w-[375px] h-screen max-h-[812px] mx-auto bg-black text-white overflow-hidden flex flex-col">
        {/* Mobile Navigation */}
        <MobileNavigation 
          currentRole="supervisor" 
          onLogout={() => router.push('/sign-in')}
        />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-black bg-opacity-90">
          <div>
            <h1 className="text-xl font-semibold">Customer Management</h1>
            <p className="text-xs text-gray-500 mt-1">{filteredCustomers.length} customers</p>
          </div>
        </div>


        {/* Notifications */}
        {error && (
          <div className="flex items-center gap-2 p-3 mx-4 my-2 bg-red-900 bg-opacity-20 border border-red-500 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 mx-4 my-2 bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-lg">
            <CheckCircle className="w-5 h-5 text-golden flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="px-4 py-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
              />
            </div>
          </div>

          {/* Customer List */}
          <div className="px-4">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">
                  {searchQuery ? 'Try adjusting your search' : 'Add your first customer to get started'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="bg-white bg-opacity-5 border border-yellow-500 border-opacity-20 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:bg-opacity-8 hover:border-opacity-40 hover:translate-x-0.5"
                    onClick={() => handleEdit(customer)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                          <Users className="w-5 h-5 text-golden mt-0.5" />
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">
                              {customer.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              {customer.property_count && customer.property_count > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-yellow-500 bg-opacity-20 text-yellow-400 rounded-full uppercase">
                                  {customer.property_count} properties
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="ml-8 space-y-1 text-xs">
                          <div className="flex items-center gap-2 text-gray-400">
                            <Mail className="w-3 h-3" />
                            <span>{customer.email}</span>
                          </div>
                          
                          {customer.phone && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Phone className="w-3 h-3" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          
                          {customer.address && (
                            <div className="flex items-start gap-2 text-gray-500">
                              <MapPin className="w-3 h-3 mt-0.5" />
                              <span className="line-clamp-2">{customer.address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(customer);
                          }}
                          className="p-1.5 bg-white bg-opacity-10 text-white border border-yellow-500 border-opacity-20 rounded-md cursor-pointer transition-all duration-200 hover:bg-yellow-500 hover:bg-opacity-20 hover:border-yellow-400"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(customer.id);
                          }}
                          className="p-1.5 bg-white bg-opacity-10 text-red-500 border border-red-500 border-opacity-20 rounded-md cursor-pointer transition-all duration-200 hover:bg-red-500 hover:bg-opacity-20 hover:border-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex gap-3 p-4 bg-black bg-opacity-90 border-t border-gray-700">
          <button
            onClick={() => router.push('/supervisor')}
            className="flex items-center justify-center px-4 py-3 bg-white bg-opacity-10 text-white font-semibold rounded-lg border border-yellow-500 border-opacity-30 text-sm cursor-pointer transition-all duration-200 hover:bg-opacity-15 hover:border-yellow-400 flex-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <button
            onClick={() => {
              setView('create');
              resetForm();
            }}
            className="flex items-center justify-center px-4 py-3 bg-yellow-500 text-black font-semibold rounded-lg border-none text-sm cursor-pointer transition-all duration-200 hover:bg-yellow-400 flex-1"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Customer
          </button>
        </div>
      </div>
    );
  }

  // Create/Edit Form View
  return (
    <div className="w-full max-w-[375px] h-screen max-h-[812px] mx-auto bg-black text-white overflow-hidden flex flex-col">
      {/* Mobile Navigation */}
      <MobileNavigation 
        currentRole="supervisor" 
        onLogout={() => router.push('/sign-in')}
        showBackButton={true}
        backTo="/supervisor/customers"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-black bg-opacity-90">
        <div>
          <h1 className="text-xl font-semibold">
            {view === 'edit' ? 'Edit Customer' : 'Add New Customer'}
          </h1>
        </div>
        <Users className="w-6 h-6 text-golden" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">
              Customer Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                formErrors.name 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-800 focus:ring-golden focus:border-golden'
              }`}
              placeholder="Enter customer name"
            />
            {formErrors.name && (
              <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                formErrors.email 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-800 focus:ring-golden focus:border-golden'
              }`}
              placeholder="customer@example.com"
            />
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-2">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Address Field */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-2">
              Address
            </label>
            <textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
              placeholder="Enter customer address"
            />
          </div>

          {/* Notes Field */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-400 mb-2">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
              placeholder="Additional notes about the customer..."
            />
          </div>
        </form>
      </div>

      {/* Bottom Actions */}
      <div className="flex gap-3 p-4 bg-black bg-opacity-90 border-t border-gray-700">
        <button
          onClick={() => {
            setView('list');
            resetForm();
          }}
          className="flex items-center justify-center px-4 py-3 bg-white bg-opacity-10 text-white font-semibold rounded-lg border border-yellow-500 border-opacity-30 text-sm cursor-pointer transition-all duration-200 hover:bg-opacity-15 hover:border-yellow-400 flex-1"
        >
          <X className="w-5 h-5 mr-2" />
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex items-center justify-center px-4 py-3 bg-yellow-500 text-black font-semibold rounded-lg border-none text-sm cursor-pointer transition-all duration-200 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed flex-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Save
            </>
          )}
        </button>
      </div>

    </div>
  );
}
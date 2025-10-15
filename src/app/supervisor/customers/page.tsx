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
    setError(null); // Clear any previous errors
    
    try {
      const url = view === 'edit' && selectedCustomer
        ? `/api/supervisor/customers/${selectedCustomer.id}`
        : '/api/supervisor/customers';

      const method = view === 'edit' ? 'PATCH' : 'POST';

      console.log('Submitting customer data:', formData);
      console.log('API URL:', url, 'Method:', method);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      console.log('API Response:', response.status, data);

      if (!response.ok) {
        console.error('API Error:', data);
        throw new Error(data.error?.message || data.message || 'Failed to save customer');
      }

      // Use the specific message from the API response that indicates if it was saved to database
      setSuccess(data.message || (view === 'edit' ? 'Customer updated successfully' : 'Customer created successfully'));
      setTimeout(() => setSuccess(null), 5000); // Longer display time for database confirmation

      // Refresh list and return to list view
      await loadCustomers();
      setView('list');
      resetForm();
    } catch (err) {
      console.error('Save error:', err);
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

      // Use the specific message from the API response that indicates if it was deleted from database
      setSuccess('Customer deleted successfully');
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
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading customers...</p>
          </div>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
        `}</style>
      </div>
    );
  }

  // List View
  if (view === 'list') {
    return (
      <div className="mobile-container">
        {/* Mobile Navigation */}
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/sign-in')}
        />

        {/* Header */}
        <div className="header-bar">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6" style={{ color: '#FFD700' }} />
            <div>
              <h1 className="text-xl font-semibold">Customers</h1>
              <p className="text-xs text-gray-500">{filteredCustomers.length} total</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="notification-bar error">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="notification-bar success">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          {/* Customer List */}
          <div className="px-4 pb-4">
            {filteredCustomers.length === 0 ? (
              <div className="empty-state">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">
                  {searchQuery ? 'Try adjusting your search' : 'Add your first customer to get started'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="customer-card"
                    onClick={() => handleEdit(customer)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                          <Users className="w-5 h-5 mt-0.5" style={{ color: '#FFD700' }} />
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">
                              {customer.name}
                            </h3>
                            {customer.property_count && customer.property_count > 0 && (
                              <span className="property-badge">
                                {customer.property_count} properties
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="ml-8 space-y-1 text-xs text-gray-400">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span>{customer.email}</span>
                          </div>

                          {customer.phone && (
                            <div className="flex items-center gap-2">
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
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(customer);
                          }}
                          className="icon-button"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(customer.id);
                          }}
                          className="icon-button delete"
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
        <div className="bottom-actions">
          <button
            type="button"
            onClick={() => router.push('/supervisor')}
            className="btn-secondary flex-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              setView('create');
              resetForm();
            }}
            className="btn-primary flex-1"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Customer
          </button>
        </div>

        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .header-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem;
            border-bottom: 1px solid #333;
            background: rgba(0, 0, 0, 0.9);
          }

          .notification-bar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            margin: 0.5rem 1rem;
            border-radius: 0.5rem;
          }

          .notification-bar.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
          }

          .notification-bar.success {
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.3);
            color: #FFD700;
          }

          .input-field {
            width: 100%;
            padding: 0.75rem 1rem;
            background: #111827;
            border: 1px solid #374151;
            border-radius: 0.5rem;
            color: white;
            font-size: 1rem;
          }

          .input-field:focus {
            outline: none;
            border-color: #FFD700;
            box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
          }

          .input-field::placeholder {
            color: #9CA3AF;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }

          .customer-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
            padding: 1rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .customer-card:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 215, 0, 0.4);
            transform: translateX(2px);
          }

          .property-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.125rem 0.5rem;
            font-size: 0.75rem;
            font-weight: 500;
            background: rgba(255, 215, 0, 0.2);
            color: #FFD700;
            border-radius: 9999px;
            text-transform: uppercase;
            margin-top: 0.25rem;
          }

          .icon-button {
            padding: 0.375rem;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .icon-button:hover {
            background: rgba(255, 215, 0, 0.2);
            border-color: #FFD700;
          }

          .icon-button.delete {
            color: #ef4444;
            border-color: rgba(239, 68, 68, 0.2);
          }

          .icon-button.delete:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: #ef4444;
          }

          .bottom-actions {
            display: flex;
            gap: 0.75rem;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.9);
            border-top: 1px solid #333;
          }

          .btn-primary {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.75rem 1rem;
            background: #FFD700;
            color: #000;
            font-weight: 600;
            border-radius: 0.5rem;
            border: none;
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-primary:hover:not(:disabled) {
            background: #FFC700;
          }

          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-weight: 600;
            border-radius: 0.5rem;
            border: 1px solid rgba(255, 215, 0, 0.3);
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: #FFD700;
          }
        `}</style>
      </div>
    );
  }

  // Create/Edit Form View
  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/sign-in')}
        showBackButton={true}
        backTo="/supervisor/customers"
      />

      {/* Header */}
      <div className="header-bar">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6" style={{ color: '#FFD700' }} />
          <h1 className="text-xl font-semibold">
            {view === 'edit' ? 'Edit Customer' : 'New Customer'}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="form-label">
              Customer Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`input-field ${formErrors.name ? 'error' : ''}`}
              placeholder="Enter customer name"
            />
            {formErrors.name && (
              <p className="error-text">{formErrors.name}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="form-label">
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`input-field ${formErrors.email ? 'error' : ''}`}
              placeholder="customer@example.com"
            />
            {formErrors.email && (
              <p className="error-text">{formErrors.email}</p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="form-label">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input-field"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Address Field */}
          <div>
            <label htmlFor="address" className="form-label">
              Address
            </label>
            <textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="input-field"
              placeholder="Enter customer address"
            />
          </div>

          {/* Notes Field */}
          <div>
            <label htmlFor="notes" className="form-label">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="input-field"
              placeholder="Additional notes about the customer..."
            />
          </div>
        </form>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => {
            setView('list');
            resetForm();
          }}
          className="btn-secondary flex-1"
        >
          <X className="w-5 h-5 mr-2" />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="btn-primary flex-1"
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

      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #9CA3AF;
          margin-bottom: 0.5rem;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          color: white;
          font-size: 1rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .input-field::placeholder {
          color: #9CA3AF;
        }

        .input-field.error {
          border-color: #ef4444;
        }

        .input-field.error:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
        }

        .error-text {
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: #ef4444;
        }

        .bottom-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.9);
          border-top: 1px solid #333;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }
      `}</style>
    </div>
  );
}

/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/supervisor/properties/page.tsx
 * phase: 3
 * domain: supervisor
 * purpose: Property management page for supervisors
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-ui.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['loading', 'list_view', 'create_mode', 'edit_mode'],
 *   transitions: [
 *     'loading->list_view: dataLoaded()',
 *     'list_view->create_mode: clickCreate()',
 *     'list_view->edit_mode: selectProperty()',
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
 * voice_considerations: Voice commands for property search and creation
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/supervisor-properties.test.ts'
 * }
 * tasks: [
 *   'Create property list view',
 *   'Add property creation form',
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
  Building,
  MapPin,
  Users,
  Ruler,
  FileText,
  Edit,
  Trash2,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Home,
  X,
  Save,
  Loader2,
  Trees,
  Building2,
  Warehouse
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';

interface Property {
  id: string;
  customer_id: string;
  address: string;
  type: 'residential' | 'commercial' | 'industrial';
  size?: string;
  notes?: string;
  customer?: { name: string };
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
}

interface PropertyFormData {
  customer_id: string;
  address: string;
  type: 'residential' | 'commercial' | 'industrial';
  size: string;
  notes: string;
}

const propertyTypeIcons = {
  residential: Home,
  commercial: Building2,
  industrial: Warehouse
};

const propertyTypeLabels = {
  residential: 'Residential',
  commercial: 'Commercial', 
  industrial: 'Industrial'
};

export default function SupervisorPropertiesPage() {
  const router = useRouter();
  const { actions, addAction, clearActions } = useButtonActions();

  // State
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<PropertyFormData>({
    customer_id: '',
    address: '',
    type: 'residential',
    size: '',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<PropertyFormData>>({});
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
        id: 'create-property',
        label: 'Add New Property',
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
        label: isSaving ? 'Saving...' : 'Save Property',
        priority: 'high',
        icon: Save,
        disabled: isSaving,
        onClick: handleSubmit,
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });
    }
  }, [view, isSaving, clearActions, addAction, router]);

  // Load data on mount
  useEffect(() => {
    loadProperties();
    loadCustomers();
  }, []);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterCustomerId) params.append('customer_id', filterCustomerId);
      
      const response = await fetch(`/api/supervisor/properties?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setProperties(data.properties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load properties');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/supervisor/customers');
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setCustomers(data.customers || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      address: '',
      type: 'residential',
      size: '',
      notes: ''
    });
    setFormErrors({});
    setSelectedProperty(null);
  };

  const validateForm = (): boolean => {
    const errors: Partial<PropertyFormData> = {};

    if (!formData.customer_id) {
      errors.customer_id = 'Customer is required';
    }

    if (!formData.address.trim()) {
      errors.address = 'Address is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const url = view === 'edit' && selectedProperty
        ? `/api/supervisor/properties/${selectedProperty.id}`
        : '/api/supervisor/properties';

      const method = view === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setSuccess(view === 'edit' ? 'Property updated successfully' : 'Property created successfully');
      setTimeout(() => setSuccess(null), 3000);

      // Refresh list and return to list view
      await loadProperties();
      setView('list');
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save property');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (property: Property) => {
    setSelectedProperty(property);
    setFormData({
      customer_id: property.customer_id,
      address: property.address,
      type: property.type,
      size: property.size || '',
      notes: property.notes || ''
    });
    setView('edit');
  };

  const handleDelete = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      const response = await fetch(`/api/supervisor/properties/${propertyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message);
      }

      setSuccess('Property deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete property');
    }
  };

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCustomer = !filterCustomerId || property.customer_id === filterCustomerId;
    const matchesType = !filterType || property.type === filterType;

    return matchesSearch && matchesCustomer && matchesType;
  });

  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-golden mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading properties...</p>
        </div>
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
          <div>
            <h1 className="text-xl font-semibold">Property Management</h1>
            <p className="text-xs text-gray-500 mt-1">{filteredProperties.length} properties</p>
          </div>
          <Building className="w-6 h-6 text-golden" />
        </div>

        {/* Notifications */}
        {error && (
          <div className="notification-bar error">
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
          <div className="notification-bar success">
            <CheckCircle className="w-5 h-5 text-golden flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Search and Filters */}
          <div className="px-4 py-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={filterCustomerId}
                onChange={(e) => setFilterCustomerId(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-golden"
              >
                <option value="">All Customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-golden"
              >
                <option value="">All Types</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
          </div>

          {/* Property List */}
          <div className="px-4">
            {filteredProperties.length === 0 ? (
              <div className="empty-state">
                <Building className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">
                  {searchQuery || filterCustomerId || filterType
                    ? 'Try adjusting your filters'
                    : 'Add your first property to get started'}
                </p>
              </div>
            ) : (
              <div className="property-list">
                {filteredProperties.map((property) => {
                  const TypeIcon = propertyTypeIcons[property.type];
                  return (
                    <div
                      key={property.id}
                      className="property-card"
                      onClick={() => handleEdit(property)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-2">
                            <TypeIcon className="w-5 h-5 text-golden mt-0.5" />
                            <div className="flex-1">
                              <h3 className="font-semibold text-white">
                                {property.address}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="property-type-badge">
                                  {propertyTypeLabels[property.type]}
                                </span>
                                {property.size && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Ruler className="w-3 h-3" />
                                    {property.size}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-8 space-y-1 text-xs">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Users className="w-3 h-3" />
                              <span>{property.customer?.name || 'Unknown Customer'}</span>
                            </div>
                            
                            {property.notes && (
                              <div className="flex items-start gap-2 text-gray-500">
                                <FileText className="w-3 h-3 mt-0.5" />
                                <span className="line-clamp-2">{property.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(property);
                            }}
                            className="icon-button"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(property.id);
                            }}
                            className="icon-button text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="bottom-actions">
          <button
            onClick={() => router.push('/supervisor')}
            className="btn-secondary flex-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <button
            onClick={() => {
              setView('create');
              resetForm();
            }}
            className="btn-primary flex-1"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Property
          </button>
        </div>

        {/* Styled JSX */}
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
          }

          .notification-bar.success {
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.3);
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
          }

          .property-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .property-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
            padding: 1rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .property-card:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 215, 0, 0.4);
            transform: translateX(2px);
          }

          .property-type-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.125rem 0.5rem;
            font-size: 0.7rem;
            font-weight: 500;
            background: rgba(255, 215, 0, 0.2);
            color: #FFD700;
            border-radius: 9999px;
            text-transform: uppercase;
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

          .btn-primary:hover {
            background: #FFC700;
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

          .golden { color: #FFD700; }
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
        backTo="/supervisor/properties"
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">
            {view === 'edit' ? 'Edit Property' : 'Add New Property'}
          </h1>
        </div>
        <Building className="w-6 h-6 text-golden" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
          {/* Customer Field */}
          <div>
            <label htmlFor="customer" className="block text-sm font-medium text-gray-400 mb-2">
              Customer *
            </label>
            <select
              id="customer"
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-900 border rounded-lg text-white focus:outline-none focus:ring-2 ${
                formErrors.customer_id 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-800 focus:ring-golden focus:border-golden'
              }`}
            >
              <option value="">Select a customer...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            {formErrors.customer_id && (
              <p className="mt-1 text-sm text-red-500">{formErrors.customer_id}</p>
            )}
          </div>

          {/* Address Field */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-2">
              Property Address *
            </label>
            <textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className={`w-full px-4 py-3 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                formErrors.address 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-800 focus:ring-golden focus:border-golden'
              }`}
              placeholder="Enter the full property address"
            />
            {formErrors.address && (
              <p className="mt-1 text-sm text-red-500">{formErrors.address}</p>
            )}
          </div>

          {/* Property Type Field */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-400 mb-2">
              Property Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['residential', 'commercial', 'industrial'] as const).map((type) => {
                const Icon = propertyTypeIcons[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={`p-3 border-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                      formData.type === type
                        ? 'border-golden bg-golden/20 text-golden'
                        : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium">{propertyTypeLabels[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Field */}
          <div>
            <label htmlFor="size" className="block text-sm font-medium text-gray-400 mb-2">
              Property Size
            </label>
            <input
              id="size"
              type="text"
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
              placeholder="e.g., 0.25 acres, 2500 sq ft"
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
              placeholder="Additional notes about the property..."
            />
          </div>
        </form>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
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

      {/* Styled JSX */}
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

        .golden { color: #FFD700; }
      `}</style>
    </div>
  );
}
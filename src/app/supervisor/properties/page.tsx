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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading properties...</p>
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
                <Building className="w-8 h-8 text-emerald-600" />
                <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
              </div>
              <div className="text-sm text-gray-500">
                {filteredProperties.length} properties
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
              {/* Search and Filters */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search properties by address or customer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Filter by Customer
                      </label>
                      <select
                        value={filterCustomerId}
                        onChange={(e) => setFilterCustomerId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">All Customers</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Filter by Type
                      </label>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">All Types</option>
                        <option value="residential">Residential</option>
                        <option value="commercial">Commercial</option>
                        <option value="industrial">Industrial</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Property List */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {filteredProperties.length === 0 ? (
                  <div className="p-12 text-center">
                    <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No properties found</h3>
                    <p className="text-gray-500">
                      {searchQuery || filterCustomerId || filterType
                        ? 'Try adjusting your filters'
                        : 'Add your first property to get started'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredProperties.map((property) => {
                      const TypeIcon = propertyTypeIcons[property.type];
                      return (
                        <div
                          key={property.id}
                          className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleEdit(property)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-start gap-3 mb-2">
                                <TypeIcon className="w-6 h-6 text-emerald-600 mt-0.5" />
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {property.address}
                                  </h3>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                                      {propertyTypeLabels[property.type]}
                                    </span>
                                    {property.size && (
                                      <span className="text-sm text-gray-600 flex items-center gap-1">
                                        <Ruler className="w-4 h-4" />
                                        {property.size}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="ml-9 space-y-1 text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Users className="w-4 h-4" />
                                  <span>{property.customer?.name || 'Unknown Customer'}</span>
                                </div>
                                
                                {property.notes && (
                                  <div className="flex items-start gap-2 text-gray-600">
                                    <FileText className="w-4 h-4 mt-0.5" />
                                    <span className="line-clamp-2">{property.notes}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(property);
                                }}
                                className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(property.id);
                                }}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
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
                    <p className="text-sm text-gray-600">Total Properties</p>
                    <p className="text-2xl font-bold text-gray-900">{properties.length}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Residential</span>
                      <span className="font-semibold">
                        {properties.filter(p => p.type === 'residential').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Commercial</span>
                      <span className="font-semibold">
                        {properties.filter(p => p.type === 'commercial').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Industrial</span>
                      <span className="font-semibold">
                        {properties.filter(p => p.type === 'industrial').length}
                      </span>
                    </div>
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
            <Building className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              {view === 'edit' ? 'Edit Property' : 'Add New Property'}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
            {/* Customer Field */}
            <div>
              <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-2">
                Customer *
              </label>
              <select
                id="customer"
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  formErrors.customer_id 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-emerald-500'
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
                <p className="mt-1 text-sm text-red-600">{formErrors.customer_id}</p>
              )}
            </div>

            {/* Address Field */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Property Address *
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  formErrors.address 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-emerald-500'
                }`}
                placeholder="Enter the full property address"
              />
              {formErrors.address && (
                <p className="mt-1 text-sm text-red-600">{formErrors.address}</p>
              )}
            </div>

            {/* Property Type Field */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                Property Type *
              </label>
              <div className="grid grid-cols-3 gap-4">
                {(['residential', 'commercial', 'industrial'] as const).map((type) => {
                  const Icon = propertyTypeIcons[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type })}
                      className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                        formData.type === type
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Icon className="w-8 h-8" />
                      <span className="text-sm font-medium">{propertyTypeLabels[type]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size Field */}
            <div>
              <label htmlFor="size" className="block text-sm font-medium text-gray-700 mb-2">
                Property Size
              </label>
              <input
                id="size"
                type="text"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., 0.25 acres, 2500 sq ft"
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
                placeholder="Additional notes about the property..."
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
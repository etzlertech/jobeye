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

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  Plus,
  Search,
  Building,
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
  Building2,
  Warehouse
} from 'lucide-react';

interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface Property {
  id: string;
  name?: string;
  customer_id: string;
  address?: string | Address;
  safeAddress?: string; // Normalized address string, set during data loading
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
  name: string;
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

// Helper to convert address to display string
const getAddressString = (address?: string | Address): string => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return `${address.street ?? ''} ${address.city ?? ''} ${address.state ?? ''} ${address.zip ?? ''}`.trim();
};

export default function SupervisorPropertiesPage() {
  const router = useRouter();

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
    name: '',
    customer_id: '',
    address: '',
    type: 'residential',
    size: '',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<PropertyFormData>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ButtonLimiter setup - not used in this page but imported
  // The page uses standard bottom-actions bar instead

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

      // Normalize data: API returns property_type but UI expects type
      // Also normalize address immediately to prevent undefined access
      const normalized = (data.properties || []).map((p: any) => ({
        ...p,
        type: (p.property_type || 'residential') as Property['type'],
        safeAddress: getAddressString(p.address)
      }));

      setProperties(normalized);
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
      name: '',
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

    if (!formData.name.trim()) {
      errors.name = 'Property name is required';
    }

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

      // Map form data to API format
      const apiData = {
        name: formData.name,             // Required field
        customer_id: formData.customer_id,
        address: formData.address,
        property_type: formData.type,    // Map 'type' to 'property_type'
        size_sqft: formData.size,        // Map 'size' to 'size_sqft'
        access_notes: formData.notes     // Map 'notes' to 'access_notes'
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      // Use the specific message from the API response that indicates if it was saved to database
      setSuccess(data.message || (view === 'edit' ? 'Property updated successfully' : 'Property created successfully'));
      setTimeout(() => setSuccess(null), 5000); // Longer display time for database confirmation

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
    const addressString = getAddressString(property.address);
    setFormData({
      name: property.name || '',
      customer_id: property.customer_id,
      address: addressString,
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message);
      }

      // Use the specific message from the API response that indicates if it was deleted from database
      setSuccess(data.message || 'Property deleted successfully');
      setTimeout(() => setSuccess(null), 5000); // Longer display time for database confirmation
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete property');
    }
  };

  const filteredProperties = properties.filter(property => {
    // Use pre-normalized safeAddress to avoid undefined access
    const addressString = property.safeAddress || '';
    const matchesSearch = addressString.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (property.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());

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
          .golden { color: #FFD700; }
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
          <div>
            <h1 className="text-xl font-semibold">Property Management</h1>
            <p className="text-xs text-gray-500 mt-1">{filteredProperties.length} properties</p>
          </div>
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
                className="filter-select"
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
                className="filter-select"
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
                  // Guard against undefined type
                  const propertyType = property.type || 'residential';
                  const TypeIcon = propertyTypeIcons[propertyType] || Home;
                  const typeLabel = propertyTypeLabels[propertyType] || 'Residential';

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
                                {property.name || getAddressString(property.address) || 'Unnamed Property'}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="property-type-badge">
                                  {typeLabel}
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

          .filter-select {
            width: 100%;
            padding: 0.75rem 1rem;
            background: #111827;
            border: 1px solid #374151;
            border-radius: 0.5rem;
            color: white;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .filter-select:focus {
            outline: none;
            border-color: #FFD700;
            box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
          }

          .filter-select option {
            background: #111827;
            color: white;
            padding: 0.5rem;
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
            <label htmlFor="customer" className="form-label">
              Customer *
            </label>
            <select
              id="customer"
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              className={`input-field ${formErrors.customer_id ? 'error' : ''}`}
            >
              <option value="">Select a customer...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            {formErrors.customer_id && (
              <p className="error-text">{formErrors.customer_id}</p>
            )}
          </div>

          {/* Property Name Field */}
          <div>
            <label htmlFor="name" className="form-label">
              Property Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`input-field ${formErrors.name ? 'error' : ''}`}
              placeholder="e.g., Main Street House, Downtown Office"
            />
            {formErrors.name && (
              <p className="error-text">{formErrors.name}</p>
            )}
          </div>

          {/* Address Field */}
          <div>
            <label htmlFor="address" className="form-label">
              Property Address *
            </label>
            <textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className={`input-field ${formErrors.address ? 'error' : ''}`}
              placeholder="Enter the full property address"
            />
            {formErrors.address && (
              <p className="error-text">{formErrors.address}</p>
            )}
          </div>

          {/* Property Type Field */}
          <div>
            <label htmlFor="type" className="form-label">
              Property Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['residential', 'commercial', 'industrial'] as const).map((type) => {
                const Icon = propertyTypeIcons[type];
                const isSelected = formData.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFormData({ ...formData, type });
                    }}
                    className={`property-type-btn ${isSelected ? 'selected' : ''}`}
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
            <label htmlFor="size" className="form-label">
              Property Size
            </label>
            <input
              id="size"
              type="text"
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              className="input-field"
              placeholder="e.g., 0.25 acres, 2500 sq ft"
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
              placeholder="Additional notes about the property..."
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
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit();
          }}
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

        .golden { color: #FFD700; }

        /* Property type button styles */
        :global(.property-type-btn) {
          padding: 0.75rem;
          border-width: 2px;
          border-radius: 0.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          transition: all 0.2s;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        :global(.property-type-btn.selected) {
          border-color: #FFD700;
          background: rgba(255, 215, 0, 0.2);
          color: #FFD700;
        }

        :global(.property-type-btn:not(.selected)) {
          border-color: #374151;
          background: #111827;
          color: #9CA3AF;
        }

        :global(.property-type-btn:hover) {
          border-color: #4B5563;
        }
      `}</style>
    </div>
  );
}
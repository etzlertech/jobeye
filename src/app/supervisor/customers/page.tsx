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

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';
import { voiceProcessor } from '@/lib/voice/voice-processor';
import { voiceNavigator } from '@/lib/voice/voice-navigator';
import { 
  Users, Search, Plus, Edit, Trash2, Phone, Mail, MapPin, 
  AlertCircle, CheckCircle, X, Loader2, Settings, ChevronLeft 
} from 'lucide-react';

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
  
  // State
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  
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

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Voice command handling
  const handleVoiceTranscript = (text: string) => {
    setTranscript(text);
    setTimeout(() => setTranscript(null), 3000);
  };

  const handleVoiceCommand = async (transcript: string, confidence: number) => {
    const lowerTranscript = transcript.toLowerCase();

    if (lowerTranscript.includes('create') || lowerTranscript.includes('add') || lowerTranscript.includes('new')) {
      if (lowerTranscript.includes('customer')) {
        setView('create');
        resetForm();
      }
    } else if (lowerTranscript.includes('search') || lowerTranscript.includes('find')) {
      const searchMatch = lowerTranscript.match(/(?:search|find)\s+(.+)/i);
      if (searchMatch) {
        setSearchQuery(searchMatch[1]);
      }
    } else if (lowerTranscript.includes('back') || lowerTranscript.includes('cancel')) {
      setView('list');
      resetForm();
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

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

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

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
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
      <div className="mobile-container flex items-center justify-center">
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
      <div className="mobile-container">
        {/* Header */}
        <div className="header-bar">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-golden" />
            <h1 className="text-xl font-semibold">Customers</h1>
          </div>
          <div className="text-sm text-gray-500">
            {filteredCustomers.length} total
          </div>
        </div>

        {/* Voice Transcript */}
        {transcript && mounted && createPortal(
          <div className="transcript-overlay">
            <p className="text-golden">{transcript}</p>
          </div>,
          document.body
        )}

        {/* Notifications */}
        {error && (
          <div className="notification-container mt-4">
            <div className="notification error">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {showSuccess && (
          <div className="notification-container mt-4">
            <div className="notification success">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>Operation completed successfully</span>
            </div>
          </div>
        )}

        <div className="px-4 py-4">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                setView('create');
                resetForm();
              }}
              className="btn-primary w-full"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add New Customer
            </button>

            {/* Customer List */}
            <div className="card">
              {filteredCustomers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">No customers found</h3>
                  <p className="text-gray-500">
                    {searchQuery ? 'Try adjusting your search' : 'Add your first customer to get started'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="customer-item"
                      onClick={() => handleEdit(customer)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">
                              {customer.name}
                            </h3>
                            {customer.property_count && customer.property_count > 0 && (
                              <span className="badge">
                                {customer.property_count} properties
                              </span>
                            )}
                          </div>
                            
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Mail className="w-4 h-4 text-golden" />
                              <span>{customer.email}</span>
                            </div>
                            
                            {customer.phone && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Phone className="w-4 h-4 text-golden" />
                                <span>{customer.phone}</span>
                              </div>
                            )}
                            
                            {customer.address && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <MapPin className="w-4 h-4 text-golden" />
                                <span className="truncate">{customer.address}</span>
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
                            className="icon-button"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(customer.id);
                            }}
                            className="icon-button text-red-400 hover:text-red-300"
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

          {/* Voice Command Button */}
          <div className="voice-fab">
            <VoiceCommandButton
              onTranscript={handleVoiceTranscript}
              onCommand={handleVoiceCommand}
              size="lg"
              autoSpeak={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // Create/Edit Form View
  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="header-bar">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setView('list');
              resetForm();
            }}
            className="icon-button"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">
            {view === 'edit' ? 'Edit Customer' : 'Add Customer'}
          </h1>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="card">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
            {/* Name Field */}
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Customer Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`form-input ${formErrors.name ? 'error' : ''}`}
                placeholder="Enter customer name"
              />
              {formErrors.name && (
                <p className="form-error">{formErrors.name}</p>
              )}
            </div>

            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`form-input ${formErrors.email ? 'error' : ''}`}
                placeholder="customer@example.com"
              />
              {formErrors.email && (
                <p className="form-error">{formErrors.email}</p>
              )}
            </div>

            {/* Phone Field */}
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="form-input"
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Address Field */}
            <div className="form-group">
              <label htmlFor="address" className="form-label">
                Address
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="form-input"
                placeholder="Enter customer address"
              />
            </div>

            {/* Notes Field */}
            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="form-input"
                placeholder="Additional notes about the customer..."
              />
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setView('list');
                  resetForm();
                }}
                className="btn-secondary flex-1"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    {view === 'edit' ? 'Update' : 'Create'} Customer
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Voice Command Button */}
      <div className="voice-fab">
        <VoiceCommandButton
          onTranscript={handleVoiceTranscript}
          onCommand={handleVoiceCommand}
          size="lg"
          autoSpeak={true}
        />
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

        .card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 1.25rem;
          backdrop-filter: blur(10px);
        }

        .search-container {
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .search-input:focus {
          outline: none;
          border-color: #FFD700;
          background: rgba(255, 255, 255, 0.08);
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          width: 1.25rem;
          height: 1.25rem;
          color: #FFD700;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1.5rem;
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
          transform: translateY(-1px);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .customer-item {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.1);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .customer-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 215, 0, 0.3);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0.125rem 0.5rem;
          background: rgba(255, 215, 0, 0.2);
          color: #FFD700;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: 9999px;
        }

        .icon-button {
          padding: 0.5rem;
          background: transparent;
          color: #FFD700;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-button:hover {
          background: rgba(255, 215, 0, 0.1);
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          margin-bottom: 0.5rem;
          color: #FFD700;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .form-input {
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .form-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .form-input:focus {
          outline: none;
          border-color: #FFD700;
          background: rgba(255, 255, 255, 0.08);
        }

        .form-input.error {
          border-color: #ef4444;
        }

        .form-error {
          margin-top: 0.25rem;
          color: #ef4444;
          font-size: 0.75rem;
        }

        .notification-container {
          padding: 0 1rem;
        }

        .notification {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }

        .notification.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        .notification.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .voice-fab {
          position: fixed;
          bottom: 2rem;
          right: 50%;
          transform: translateX(50%);
          z-index: 1000;
        }

        .transcript-overlay {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid #FFD700;
          border-radius: 0.75rem;
          padding: 1.5rem 2rem;
          box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
          z-index: 2000;
          animation: fadeInOut 3s ease-in-out;
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          20%, 80% { opacity: 1; }
        }

        .golden { color: #FFD700; }
      `}</style>
    </div>
  );
}
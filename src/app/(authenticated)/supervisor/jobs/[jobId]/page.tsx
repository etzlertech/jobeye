'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  ArrowLeft,
  Briefcase,
  Package,
  Plus,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  Trash2
} from 'lucide-react';

interface Job {
  id: string;
  job_number: string;
  title: string;
  status: string;
}

interface AssignedItem {
  transaction_id: string;
  item_id: string;
  item_name: string;
  item_type: string;
  category: string;
  quantity: number;
  unit_of_measure: string;
  transaction_type: string;
  assigned_at: string;
  notes?: string;
  status: string;
}

interface Item {
  id: string;
  name: string;
  item_type: string;
  category: string;
  unit_of_measure: string;
  current_quantity: number;
}

export default function JobItemsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [assignedItems, setAssignedItems] = useState<AssignedItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadJobItems() {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/supervisor/jobs/${jobId}/items`);
      const data = await res.json();

      if (res.ok) {
        setJob(data.job);
        setAssignedItems(data.assignedItems || []);
      } else {
        setError(data.error || 'Failed to load job items');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading job items');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAvailableItems() {
    try {
      const res = await fetch('/api/supervisor/items');
      const data = await res.json();

      if (res.ok && data.items) {
        setAvailableItems(data.items);
        if (data.items.length === 0) {
          setError('No items found. Please create some items first.');
        }
      } else {
        setError(data.error || 'Failed to load items');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading items');
    }
  }

  async function addItemToJob() {
    if (!selectedItemId) return;

    const selectedItem = availableItems.find(i => i.id === selectedItemId);
    if (!selectedItem) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/supervisor/jobs/${jobId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedItem.id,
          quantity: parseFloat(quantity)
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Added ${selectedItem.name} to job`);
        setSelectedItemId('');
        setQuantity('1');
        loadJobItems();
      } else {
        setError(data.error || 'Failed to add item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setIsLoading(false);
    }
  }

  async function removeItem(itemId: string) {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/supervisor/jobs/${jobId}/items/${itemId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setSuccess('Item returned successfully');
        loadJobItems();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error removing item');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadJobItems();
    loadAvailableItems();
  }, [jobId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'in_progress': return '#3b82f6';
      case 'scheduled': return '#FFD700';
      default: return '#6b7280';
    }
  };

  if (isLoading && !job) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading job details...</p>
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

  if (!job) {
    return (
      <div className="mobile-container">
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/sign-in')}
        />
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-gray-400">Job not found</p>
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
          <Briefcase className="w-6 h-6" style={{ color: '#FFD700' }} />
          <div>
            <h1 className="text-xl font-semibold">{job.title}</h1>
            <p className="text-xs text-gray-500">Job #{job.job_number}</p>
          </div>
        </div>
        <span
          className="status-badge"
          style={{
            background: `${getStatusColor(job.status)}20`,
            color: getStatusColor(job.status),
            border: `1px solid ${getStatusColor(job.status)}40`
          }}
        >
          {job.status}
        </span>
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
        {/* Add Item Form */}
        <div className="p-4">
          <div className="section-header">
            <Package className="w-5 h-5" style={{ color: '#FFD700' }} />
            <h2 className="text-lg font-semibold">Add Item to Job</h2>
          </div>

          <div className="space-y-3 mt-4">
            <div>
              <label className="input-label">Select Item</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="input-field"
              >
                <option value="">Choose an item...</option>
                {availableItems.length === 0 && (
                  <option disabled>No items available</option>
                )}
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.item_type} ({item.current_quantity} {item.unit_of_measure})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input-field"
                min="1"
              />
            </div>

            <button
              type="button"
              onClick={addItemToJob}
              disabled={isLoading || !selectedItemId}
              className="btn-primary w-full"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add to Job
            </button>
          </div>
        </div>

        {/* Assigned Items */}
        <div className="p-4 pt-0">
          <div className="section-header">
            <Package className="w-5 h-5" style={{ color: '#FFD700' }} />
            <h2 className="text-lg font-semibold">
              Assigned Items ({assignedItems.length})
            </h2>
          </div>

          {assignedItems.length === 0 ? (
            <div className="empty-state">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No items assigned to this job yet</p>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {assignedItems.map((item) => (
                <div key={item.transaction_id} className="item-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{item.item_name}</h3>
                      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                        <div>Type: {item.item_type}</div>
                        <div>Category: {item.category}</div>
                        <div>Quantity: {item.quantity} {item.unit_of_measure}</div>
                        <div>Assigned: {new Date(item.assigned_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.item_id)}
                      disabled={isLoading}
                      className="delete-button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
          onClick={() => router.push('/supervisor/jobs')}
          className="btn-secondary w-full"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Jobs
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

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.25rem;
          text-transform: capitalize;
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

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255, 215, 0, 0.2);
        }

        .input-label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #d1d5db;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          margin-top: 1rem;
        }

        .item-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 1rem;
          transition: all 0.2s;
        }

        .item-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
        }

        .delete-button {
          padding: 0.5rem;
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.375rem;
          background: rgba(239, 68, 68, 0.1);
          transition: all 0.2s;
        }

        .delete-button:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .delete-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

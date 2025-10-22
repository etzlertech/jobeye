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
  Trash2,
  Save,
  Calendar,
  FileText,
  Flag
} from 'lucide-react';

interface Job {
  id: string;
  job_number: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  scheduled_start: string;
  scheduled_end?: string;
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
  thumbnail_url?: string;
}

interface Item {
  id: string;
  name: string;
  item_type: string;
  category: string;
  unit_of_measure: string;
  current_quantity: number;
}

const JOB_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' }
];

const JOB_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' }
];

export default function JobEditPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [assignedItems, setAssignedItems] = useState<AssignedItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [priority, setPriority] = useState('normal');
  const [scheduledStartDate, setScheduledStartDate] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState('09:00');
  const [scheduledEndDate, setScheduledEndDate] = useState('');
  const [scheduledEndTime, setScheduledEndTime] = useState('17:00');

  // Item management
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');

  async function loadJobDetails() {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/supervisor/jobs/${jobId}`);
      const data = await res.json();

      if (res.ok && data.job) {
        const jobData = data.job;
        setJob(jobData);

        // Populate form fields
        setTitle(jobData.title || '');
        setDescription(jobData.description || '');
        setStatus(jobData.status || 'draft');
        setPriority(jobData.priority || 'normal');

        // Parse scheduled_start
        if (jobData.scheduled_start) {
          const startDate = new Date(jobData.scheduled_start);
          setScheduledStartDate(startDate.toISOString().split('T')[0]);
          setScheduledStartTime(startDate.toTimeString().slice(0, 5));
        }

        // Parse scheduled_end
        if (jobData.scheduled_end) {
          const endDate = new Date(jobData.scheduled_end);
          setScheduledEndDate(endDate.toISOString().split('T')[0]);
          setScheduledEndTime(endDate.toTimeString().slice(0, 5));
        }

        setAssignedItems(data.job.checklist_items || []);
      } else {
        setError(data.error || 'Failed to load job details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading job details');
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
      }
    } catch (err) {
      console.error('Error loading items:', err);
    }
  }

  async function handleSaveJob() {
    if (!title.trim()) {
      setError('Job title is required');
      return;
    }

    if (!scheduledStartDate) {
      setError('Scheduled start date is required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        scheduled_start: `${scheduledStartDate}T${scheduledStartTime}:00`
      };

      if (scheduledEndDate) {
        payload.scheduled_end = `${scheduledEndDate}T${scheduledEndTime}:00`;
      }

      const res = await fetch(`/api/supervisor/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Job updated successfully!');
        setTimeout(() => {
          router.push(`/supervisor/jobs/${jobId}`);
        }, 1000);
      } else {
        setError(data.error || 'Failed to update job');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setIsSaving(false);
    }
  }

  async function addItemToJob() {
    if (!selectedItemId) return;

    const selectedItem = availableItems.find(i => i.id === selectedItemId);
    if (!selectedItem) return;

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
        loadJobDetails();
      } else {
        setError(data.error || 'Failed to add item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  }

  async function removeItem(itemId: string) {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/supervisor/jobs/${jobId}/items/${itemId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setSuccess('Item removed successfully');
        loadJobDetails();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error removing item');
    }
  }

  useEffect(() => {
    loadJobDetails();
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
            <p className="text-gray-400 text-lg">Loading job...</p>
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
          onLogout={() => router.push('/')}
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
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Edit Job</h1>
          <p className="text-xs text-gray-500">#{job.job_number}</p>
        </div>
        <span
          className="status-badge"
          style={{
            background: `${getStatusColor(status)}20`,
            color: getStatusColor(status),
            border: `1px solid ${getStatusColor(status)}40`
          }}
        >
          {status}
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
        {/* Basic Information */}
        <div className="p-4">
          <div className="section-header">
            <FileText className="w-5 h-5" style={{ color: '#FFD700' }} />
            <h2 className="text-lg font-semibold">Basic Information</h2>
          </div>

          <div className="space-y-3 mt-4">
            <div>
              <label className="input-label">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="Enter job title"
              />
            </div>

            <div>
              <label className="input-label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                rows={3}
                placeholder="Enter job description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Status *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input-field"
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Priority *</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="input-field"
                >
                  {JOB_PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="p-4 pt-0">
          <div className="section-header">
            <Calendar className="w-5 h-5" style={{ color: '#FFD700' }} />
            <h2 className="text-lg font-semibold">Schedule</h2>
          </div>

          <div className="space-y-3 mt-4">
            <div>
              <label className="input-label">Scheduled Start *</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={scheduledStartDate}
                  onChange={(e) => setScheduledStartDate(e.target.value)}
                  className="input-field"
                />
                <input
                  type="time"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Scheduled End (Optional)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={scheduledEndDate}
                  onChange={(e) => setScheduledEndDate(e.target.value)}
                  className="input-field"
                />
                <input
                  type="time"
                  value={scheduledEndTime}
                  onChange={(e) => setScheduledEndTime(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="p-4 pt-0">
          <div className="section-header">
            <Package className="w-5 h-5" style={{ color: '#FFD700' }} />
            <h2 className="text-lg font-semibold">Tools & Materials</h2>
          </div>

          <div className="space-y-3 mt-4">
            <div>
              <label className="input-label">Add Item</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="input-field"
              >
                <option value="">Choose an item...</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.item_type} ({item.current_quantity} {item.unit_of_measure})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="input-label">Qty</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input-field"
                  min="1"
                />
              </div>
              <div className="col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={addItemToJob}
                  disabled={!selectedItemId}
                  className="btn-primary w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Assigned Items List */}
          {assignedItems.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Assigned Items ({assignedItems.length})
              </h3>
              <div className="space-y-2">
                {assignedItems.map((item) => (
                  <div key={item.transaction_id} className="item-card">
                    <div className="flex items-center gap-3">
                      <div className="item-thumbnail">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.item_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white">{item.item_name}</h4>
                        <p className="text-xs text-gray-500">
                          {item.quantity} {item.unit_of_measure}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.item_id)}
                        className="delete-button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push(`/supervisor/jobs/${jobId}`)}
          className="btn-secondary"
          disabled={isSaving}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveJob}
          disabled={isSaving || !title.trim() || !scheduledStartDate}
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
              Save Changes
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
          padding: 0 0.5rem;
          box-sizing: border-box;
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

        textarea.input-field {
          resize: vertical;
          font-family: inherit;
        }

        .item-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 0.75rem;
          transition: all 0.2s;
        }

        .item-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
        }

        .item-thumbnail {
          width: 2.5rem;
          height: 2.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.375rem;
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
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

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }

        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .grid {
          display: grid;
        }

        .grid-cols-2 {
          grid-template-columns: repeat(2, 1fr);
        }

        .grid-cols-3 {
          grid-template-columns: repeat(3, 1fr);
        }

        .col-span-1 {
          grid-column: span 1;
        }

        .col-span-2 {
          grid-column: span 2;
        }

        .gap-2 {
          gap: 0.5rem;
        }

        .gap-3 {
          gap: 0.75rem;
        }

        .space-y-2 > * + * {
          margin-top: 0.5rem;
        }

        .space-y-3 > * + * {
          margin-top: 0.75rem;
        }

        .flex {
          display: flex;
        }

        .flex-1 {
          flex: 1;
        }

        .items-center {
          align-items: center;
        }

        .items-end {
          align-items: flex-end;
        }
      `}</style>
    </div>
  );
}

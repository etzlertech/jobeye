/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-jobs/_components/JobForm.tsx
phase: dev-crud
domain: supervisor
purpose: Job creation form component
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 200
dependencies:
  internal:
    - '@/app/demo-jobs/utils'
  external:
    - 'react'
    - 'lucide-react'
voice_considerations:
  - Form fields optimized for voice input
*/

import { Calendar, Clock, FileText, AlertCircle } from 'lucide-react';
import type { JobFormState } from '@/app/demo-jobs/utils';

export interface CustomerOption {
  id: string;
  name: string;
}

export interface PropertyOption {
  id: string;
  name: string;
  address?: string;
}

export interface JobFormProps {
  draft: JobFormState;
  customers: CustomerOption[];
  properties: PropertyOption[];
  onDraftChange: <K extends keyof JobFormState>(field: K, value: JobFormState[K]) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export function JobForm({
  draft,
  customers,
  properties,
  onDraftChange,
  onSubmit,
  onClear,
  disabled
}: JobFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="mb-8 rounded-lg bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">Create New Job</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        {/* Customer Selection */}
        <div>
          <label htmlFor="customer" className="mb-1 block text-sm font-medium text-gray-300">
            Customer <span className="text-red-400">*</span>
          </label>
          <select
            id="customer"
            value={draft.customerId}
            onChange={(e) => onDraftChange('customerId', e.target.value)}
            className="w-full rounded-md bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={disabled || customers.length === 0}
            required
          >
            <option value="">Select a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        {/* Property Selection */}
        <div>
          <label htmlFor="property" className="mb-1 block text-sm font-medium text-gray-300">
            Property
          </label>
          <select
            id="property"
            value={draft.propertyId}
            onChange={(e) => onDraftChange('propertyId', e.target.value)}
            className="w-full rounded-md bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={disabled || properties.length === 0}
          >
            <option value="">No specific property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name || property.address || 'Unnamed property'}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="md:col-span-2">
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-300">
            Job Title <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="title"
              type="text"
              value={draft.title}
              onChange={(e) => onDraftChange('title', e.target.value)}
              placeholder="e.g., Lawn maintenance, Spring cleanup"
              className="w-full rounded-md bg-gray-800 py-2 pl-10 pr-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={disabled}
              required
            />
          </div>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-300">
            Description
          </label>
          <textarea
            id="description"
            value={draft.description}
            onChange={(e) => onDraftChange('description', e.target.value)}
            placeholder="Detailed description of work to be performed..."
            rows={3}
            className="w-full rounded-md bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={disabled}
          />
        </div>

        {/* Scheduled Date */}
        <div>
          <label htmlFor="scheduledDate" className="mb-1 block text-sm font-medium text-gray-300">
            Scheduled Date <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="scheduledDate"
              type="date"
              value={draft.scheduledDate}
              onChange={(e) => onDraftChange('scheduledDate', e.target.value)}
              min={today}
              className="w-full rounded-md bg-gray-800 py-2 pl-10 pr-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={disabled}
              required
            />
          </div>
        </div>

        {/* Scheduled Time */}
        <div>
          <label htmlFor="scheduledTime" className="mb-1 block text-sm font-medium text-gray-300">
            Scheduled Time
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="scheduledTime"
              type="time"
              value={draft.scheduledTime}
              onChange={(e) => onDraftChange('scheduledTime', e.target.value)}
              className="w-full rounded-md bg-gray-800 py-2 pl-10 pr-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={disabled}
            />
          </div>
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="priority" className="mb-1 block text-sm font-medium text-gray-300">
            Priority
          </label>
          <div className="relative">
            <AlertCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              id="priority"
              value={draft.priority}
              onChange={(e) => onDraftChange('priority', e.target.value as 'low' | 'medium' | 'high')}
              className="w-full rounded-md bg-gray-800 py-2 pl-10 pr-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={disabled}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-300">
            Notes
          </label>
          <textarea
            id="notes"
            value={draft.notes}
            onChange={(e) => onDraftChange('notes', e.target.value)}
            placeholder="Additional notes or special instructions..."
            rows={2}
            className="w-full rounded-md bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={disabled || !draft.customerId || !draft.title || !draft.scheduledDate}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          Create Job
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="rounded-md bg-gray-700 px-4 py-2 font-medium text-gray-200 transition hover:bg-gray-600 disabled:opacity-60"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
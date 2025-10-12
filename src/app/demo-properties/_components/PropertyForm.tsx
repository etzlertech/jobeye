/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-properties/_components/PropertyForm.tsx
phase: dev-crud
domain: supervisor
purpose: Form for creating properties in the dev CRUD suite
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 160
dependencies:
  internal: []
  external:
    - 'lucide-react'
voice_considerations:
  - Field labels are concise for voice prompt parity
*/

import { Check, Loader2, X } from 'lucide-react';

export interface PropertyFormState {
  customerId: string;
  propertyName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
}

export interface CustomerOption {
  id: string;
  name: string;
}

interface PropertyFormProps {
  draft: PropertyFormState;
  customers: CustomerOption[];
  onDraftChange: <Key extends keyof PropertyFormState>(field: Key, value: PropertyFormState[Key]) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled: boolean;
}

export function PropertyForm({ draft, customers, onDraftChange, onSubmit, onClear, disabled }: PropertyFormProps) {
  return (
    <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-blue-300">Create Property</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-gray-300">
          Customer
          <select
            value={draft.customerId}
            onChange={(event) => onDraftChange('customerId', event.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
          >
            {customers.length === 0 ? <option value="">No customers available</option> : null}
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-gray-300">
          Property Name
          <input
            type="text"
            value={draft.propertyName}
            onChange={(event) => onDraftChange('propertyName', event.target.value)}
            placeholder="Optional friendly name"
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-2 text-sm text-gray-300">
          Address Line
          <input
            type="text"
            value={draft.addressLine1}
            onChange={(event) => onDraftChange('addressLine1', event.target.value)}
            placeholder="123 Main St"
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-gray-300">
          City
          <input
            type="text"
            value={draft.city}
            onChange={(event) => onDraftChange('city', event.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-gray-300">
          State
          <input
            type="text"
            value={draft.state}
            onChange={(event) => onDraftChange('state', event.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-gray-300">
          Postal Code
          <input
            type="text"
            value={draft.postalCode}
            onChange={(event) => onDraftChange('postalCode', event.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-2 text-sm text-gray-300">
          Access Notes
          <textarea
            value={draft.notes}
            onChange={(event) => onDraftChange('notes', event.target.value)}
            rows={2}
            placeholder="Gate code, parking instructions, etc."
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save Property
        </button>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-700"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>
    </section>
  );
}

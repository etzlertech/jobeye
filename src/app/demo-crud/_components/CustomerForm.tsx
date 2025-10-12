/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-crud/_components/CustomerForm.tsx
phase: dev-crud
domain: supervisor
purpose: Reusable form for creating demo customers
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 120
dependencies:
  internal: []
  external:
    - 'lucide-react'
voice_considerations:
  - Keeps labels concise for voice-guided QA during dev flows
*/

import { Check, Loader2, X } from 'lucide-react';

export interface CustomerDraft {
  name: string;
  email: string;
  phone: string;
}

interface CustomerFormProps {
  draft: CustomerDraft;
  onChange: (field: keyof CustomerDraft, value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled: boolean;
}

export function CustomerForm({ draft, onChange, onSubmit, onClear, disabled }: CustomerFormProps) {
  return (
    <section className="mb-10 rounded-2xl border-2 border-gray-700 bg-gray-900 p-8 shadow-xl">
      <h2 className="mb-6 text-2xl font-bold text-green-400">Create New Customer</h2>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Name</label>
          <input
            type="text"
            placeholder="Enter customer name"
            value={draft.name}
            onChange={(event) => onChange('name', event.target.value)}
            className="w-full rounded-xl border-2 border-gray-700 bg-gray-950 px-5 py-4 text-lg text-white placeholder-gray-500 focus:border-green-400 focus:outline-none focus:ring-4 focus:ring-green-400/20"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Email</label>
          <input
            type="email"
            placeholder="customer@example.com"
            value={draft.email}
            onChange={(event) => onChange('email', event.target.value)}
            className="w-full rounded-xl border-2 border-gray-700 bg-gray-950 px-5 py-4 text-lg text-white placeholder-gray-500 focus:border-green-400 focus:outline-none focus:ring-4 focus:ring-green-400/20"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Phone (optional)</label>
          <input
            type="tel"
            placeholder="(555) 123-4567"
            value={draft.phone}
            onChange={(event) => onChange('phone', event.target.value)}
            className="w-full rounded-xl border-2 border-gray-700 bg-gray-950 px-5 py-4 text-lg text-white placeholder-gray-500 focus:border-green-400 focus:outline-none focus:ring-4 focus:ring-green-400/20"
          />
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="flex items-center gap-3 rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-green-700 disabled:opacity-60 shadow-lg hover:shadow-xl"
        >
          {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          Save Customer
        </button>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-3 rounded-xl bg-gray-700 px-6 py-4 text-lg font-medium text-gray-200 transition hover:bg-gray-600"
        >
          <X className="h-5 w-5" />
          Clear
        </button>
      </div>
    </section>
  );
}

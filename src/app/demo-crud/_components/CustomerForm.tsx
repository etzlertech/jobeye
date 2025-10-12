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
    <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-green-400">Create New Customer</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <input
          type="text"
          placeholder="Customer Name"
          value={draft.name}
          onChange={(event) => onChange('name', event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:border-green-400 focus:outline-none"
        />
        <input
          type="email"
          placeholder="Email"
          value={draft.email}
          onChange={(event) => onChange('email', event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:border-green-400 focus:outline-none"
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={draft.phone}
          onChange={(event) => onChange('phone', event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:border-green-400 focus:outline-none"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save Customer
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

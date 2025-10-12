/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-crud/_components/CustomerList.tsx
phase: dev-crud
domain: supervisor
purpose: Render customer list with inline editing for demo CRUD
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 160
dependencies:
  internal: []
  external:
    - 'lucide-react'
voice_considerations:
  - Uses action labels that match intended voice prompts (Edit, Save, Delete)
*/

import { Check, Edit, Loader2, RefreshCcw, Trash2, Users, X } from 'lucide-react';

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

interface CustomerListProps {
  customers: CustomerRecord[];
  isLoading: boolean;
  tenantAvailable: boolean;
  editingId: string | null;
  editName: string;
  onEditChange: (value: string) => void;
  onStartEdit: (id: string, current: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onRefresh: () => void;
}

export function CustomerList({
  customers,
  isLoading,
  tenantAvailable,
  editingId,
  editName,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onRefresh
}: CustomerListProps) {
  return (
    <section className="rounded-2xl border-2 border-gray-700 bg-gray-900 shadow-xl">
      <header className="flex flex-col gap-4 border-b-2 border-gray-700 p-8 md:flex-row md:items-center md:justify-between">
        <h2 className="flex items-center gap-3 text-2xl font-bold text-blue-400">
          <Users className="h-6 w-6" />
          Customers
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || !tenantAvailable}
          className="flex items-center gap-3 rounded-xl bg-blue-600 px-5 py-3 text-base font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
          Reload List
        </button>
      </header>

      <div className="divide-y-2 divide-gray-800">
        {customers.length === 0 ? (
          <div className="p-8 text-lg text-gray-400 text-center">
            {isLoading ? 'Loading customers…' : 'No customers found. Create one above to get started.'}
          </div>
        ) : (
          customers.map((customer) => (
            <article
              key={customer.id}
              className="flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-3">
                {editingId === customer.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) => onEditChange(event.target.value)}
                    className="w-full rounded-xl border-2 border-gray-700 bg-gray-950 px-5 py-4 text-lg text-white focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/20"
                    autoFocus
                  />
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-white">{customer.name}</h3>
                    <p className="text-base text-gray-300">{customer.email}</p>
                    {customer.phone ? (
                      <p className="text-base text-gray-400">Phone: {customer.phone}</p>
                    ) : null}
                    <p className="text-sm text-gray-500">
                      Created {new Date(customer.created_at).toLocaleString()}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                {editingId === customer.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSaveEdit(customer.id)}
                      disabled={isLoading}
                      className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-base font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                    >
                      <Check className="h-5 w-5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="flex items-center gap-2 rounded-xl bg-gray-700 px-5 py-3 text-base font-medium text-gray-200 transition hover:bg-gray-600"
                    >
                      <X className="h-5 w-5" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onStartEdit(customer.id, customer.name)}
                      className="flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-3 text-base font-medium text-black transition hover:bg-yellow-400"
                    >
                      <Edit className="h-5 w-5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(customer.id, customer.name)}
                      className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-base font-medium text-white transition hover:bg-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

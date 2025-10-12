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
    <section className="rounded-xl border border-gray-800 bg-gray-900">
      <header className="flex flex-col gap-3 border-b border-gray-800 p-6 md:flex-row md:items-center md:justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-blue-400">
          <Users className="h-5 w-5" />
          Customers
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || !tenantAvailable}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Reload List
        </button>
      </header>

      <div className="divide-y divide-gray-800">
        {customers.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">
            {isLoading ? 'Loading customers…' : 'No customers found. Create one above to get started.'}
          </div>
        ) : (
          customers.map((customer) => (
            <article
              key={customer.id}
              className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                {editingId === customer.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) => onEditChange(event.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
                  />
                ) : (
                  <>
                    <h3 className="truncate text-lg font-semibold text-white">{customer.name}</h3>
                    <p className="text-sm text-gray-300">{customer.email}</p>
                    {customer.phone ? (
                      <p className="text-sm text-gray-400">Phone: {customer.phone}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-gray-500">
                      Created {new Date(customer.created_at).toLocaleString()}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {editingId === customer.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSaveEdit(customer.id)}
                      disabled={isLoading}
                      className="flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-700"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onStartEdit(customer.id, customer.name)}
                      className="flex items-center gap-2 rounded-md bg-yellow-500 px-3 py-2 text-sm font-medium text-black transition hover:bg-yellow-400"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(customer.id, customer.name)}
                      className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
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

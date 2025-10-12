/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-properties/_components/PropertyList.tsx
phase: dev-crud
domain: supervisor
purpose: Render property list with inline name editing for dev CRUD
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 160
dependencies:
  internal: []
  external:
    - 'lucide-react'
voice_considerations:
  - Maintains readable labels for voice QA when cycling through properties
*/

import { Check, Loader2, MapPin, RefreshCcw, Trash2, X } from 'lucide-react';

export interface PropertyRecord {
  id: string;
  name: string;
  addressLabel: string;
  customerName: string;
  createdAt: string;
}

interface PropertyListProps {
  properties: PropertyRecord[];
  isLoading: boolean;
  tenantAvailable: boolean;
  editingId: string | null;
  editingName: string;
  onEditChange: (value: string) => void;
  onStartEdit: (id: string, current: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string, label: string) => void;
  onRefresh: () => void;
}

export function PropertyList({
  properties,
  isLoading,
  tenantAvailable,
  editingId,
  editingName,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onRefresh
}: PropertyListProps) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900">
      <header className="flex flex-col gap-3 border-b border-gray-800 p-6 md:flex-row md:items-center md:justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-yellow-300">
          <MapPin className="h-5 w-5" />
          Properties
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || !tenantAvailable}
          className="flex items-center gap-2 rounded-md bg-yellow-500 px-3 py-2 text-sm font-medium text-black transition hover:bg-yellow-400 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Reload List
        </button>
      </header>

      <div className="divide-y divide-gray-800">
        {properties.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">
            {isLoading ? 'Loading properties…' : 'No properties found for this tenant yet.'}
          </div>
        ) : (
          properties.map((property) => (
            <article
              key={property.id}
              className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                {editingId === property.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(event) => onEditChange(event.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
                  />
                ) : (
                  <>
                    <h3 className="truncate text-lg font-semibold text-white">{property.name}</h3>
                    <p className="text-sm text-gray-300">{property.customerName}</p>
                    <p className="mt-1 text-sm text-gray-400">{property.addressLabel}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Created {new Date(property.createdAt).toLocaleString()}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {editingId === property.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSaveEdit(property.id)}
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
                      onClick={() => onStartEdit(property.id, property.name)}
                      className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(property.id, property.name)}
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

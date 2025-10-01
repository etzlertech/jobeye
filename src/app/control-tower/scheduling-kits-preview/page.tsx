'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { featureFlags } from '@/core/config/feature-flags';

type KitSummary = {
  id: string
  kitCode: string
  name: string
  isActive: boolean
  items?: KitItem[]
}

type KitItem = {
  id?: string
  itemType: 'equipment' | 'material' | 'tool'
  quantity: number
  unit: string
  isRequired: boolean
}

type CreateItemDraft = {
  itemType: 'equipment' | 'material' | 'tool'
  quantity: number
  unit: string
  isRequired: boolean
}

const defaultItemDraft: CreateItemDraft = {
  itemType: 'tool',
  quantity: 1,
  unit: 'pcs',
  isRequired: true,
}

export default function SchedulingKitsPreviewPage() {
  const [kits, setKits] = useState<KitSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null)

  const [kitCode, setKitCode] = useState('')
  const [kitName, setKitName] = useState('')
  const [itemDrafts, setItemDrafts] = useState<CreateItemDraft[]>([defaultItemDraft])
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedKit = useMemo(
    () => kits.find((kit) => kit.id === selectedKitId) ?? null,
    [kits, selectedKitId]
  )

  useEffect(() => {
    if (!featureFlags.schedulingKitsPreview) return

    const loadKits = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch('/api/scheduling-kits', {
          method: 'GET',
          headers: { accept: 'application/json' },
          cache: 'no-store',
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to load kits')
        }

        const body = await response.json()
        setKits(body.kits ?? [])
        if (body.kits?.length) {
          setSelectedKitId(body.kits[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load kits')
      } finally {
        setIsLoading(false)
      }
    }

    loadKits()
  }, [])

  const handleAddItemRow = () => {
    setItemDrafts((rows) => [...rows, { ...defaultItemDraft }])
  }

  const handleRemoveItemRow = (index: number) => {
    setItemDrafts((rows) => (rows.length === 1 ? rows : rows.filter((_, i) => i !== index)))
  }

  const handleItemDraftChange = (index: number, changes: Partial<CreateItemDraft>) => {
    setItemDrafts((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...changes } : row))
    )
  }

  const resetForm = () => {
    setKitCode('')
    setKitName('')
    setItemDrafts([defaultItemDraft])
  }

  const handleCreateKit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    if (!kitCode.trim() || !kitName.trim()) {
      setFormError('Kit code and name are required.')
      return
    }

    if (itemDrafts.length === 0) {
      setFormError('At least one item is required.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/scheduling-kits', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          kitCode: kitCode.trim(),
          name: kitName.trim(),
          items: itemDrafts.map((item) => ({
            itemType: item.itemType,
            quantity: Number(item.quantity) || 0,
            unit: item.unit.trim() || 'pcs',
            isRequired: item.isRequired,
          })),
          metadata: { source: 'scheduling-kits-preview-ui' },
        }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to create kit')
      }

      const kitCodeLabel = body.kit?.kitCode ?? kitCode.trim()
      setFormSuccess(`Created kit ${kitCodeLabel}`)
      resetForm()

      const refreshResponse = await fetch('/api/scheduling-kits', {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })

      if (refreshResponse.ok) {
        const refreshed = await refreshResponse.json()
        setKits(refreshed.kits ?? [])
        setSelectedKitId(refreshed.kits?.find((kit: KitSummary) => kit.id === body.kit?.id)?.id ?? null)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create kit')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!featureFlags.schedulingKitsPreview) {
    return (
      <div className="p-8 text-gray-300">
        Feature disabled.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 text-gray-200">
      <header>
        <h1 className="text-2xl font-semibold text-white">Scheduling Kits Preview</h1>
        <p className="text-sm text-gray-400 mt-1">
          Experimental admin view for MVF scheduling kits. Use in development environments only.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="bg-tower-gray border border-tower-border rounded-lg shadow-sm">
          <div className="border-b border-tower-border px-4 py-3 flex items-center justify-between">
            <h2 className="font-medium">Existing Kits</h2>
            <button
              onClick={() => setSelectedKitId(null)}
              className="text-xs text-tower-accent hover:underline"
            >
              Clear selection
            </button>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="text-gray-400 text-sm">Loading kits�</div>
            ) : error ? (
              <div className="text-red-400 text-sm">{error}</div>
            ) : kits.length === 0 ? (
              <div className="text-gray-400 text-sm">No kits found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400">
                  <tr>
                    <th className="py-2">Code</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {kits.map((kit) => {
                    const isSelected = kit.id === selectedKitId
                    return (
                      <tr
                        key={kit.id}
                        className={`${isSelected ? 'bg-tower-border/40' : 'hover:bg-tower-border/20'} cursor-pointer transition-colors`}
                        onClick={() => setSelectedKitId(kit.id)}
                      >
                        <td className="py-2 font-mono text-xs">{kit.kitCode}</td>
                        <td className="py-2">{kit.name}</td>
                        <td className="py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${kit.isActive ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-300'}`}
                          >
                            {kit.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selectedKit && (
            <div className="border-t border-tower-border px-4 py-4 bg-tower-gray/70">
              <h3 className="font-medium mb-2">Items in {selectedKit.kitCode}</h3>
              {selectedKit.items && selectedKit.items.length > 0 ? (
                <ul className="space-y-1 text-sm text-gray-300">
                  {selectedKit.items.map((item) => (
                    <li key={item.id ?? `${item.itemType}-${item.unit}`}>
                      <span className="font-mono text-xs mr-2 uppercase">{item.itemType}</span>
                      {item.quantity} {item.unit}
                      {item.isRequired ? ' � Required' : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-400">No items recorded for this kit.</div>
              )}
            </div>
          )}
        </div>

        <div className="bg-tower-gray border border-tower-border rounded-lg shadow-sm">
          <div className="border-b border-tower-border px-4 py-3">
            <h2 className="font-medium">Create Kit</h2>
            <p className="text-xs text-gray-400 mt-1">
              Minimal form for testing the MVF API. Metadata tagged as preview.
            </p>
          </div>

          <form className="p-4 space-y-4" onSubmit={handleCreateKit}>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Kit Code</label>
              <input
                value={kitCode}
                onChange={(event) => setKitCode(event.target.value)}
                className="w-full rounded bg-black/30 border border-tower-border px-3 py-2 text-sm"
                placeholder="WINTER-STARTER"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Kit Name</label>
              <input
                value={kitName}
                onChange={(event) => setKitName(event.target.value)}
                className="w-full rounded bg-black/30 border border-tower-border px-3 py-2 text-sm"
                placeholder="Winter Starter Kit"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Items</label>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="text-xs text-tower-accent hover:underline"
                >
                  Add item
                </button>
              </div>

              <div className="space-y-3">
                {itemDrafts.map((item, index) => (
                  <div
                    key={`item-${index}`}
                    className="grid grid-cols-5 gap-2 items-center bg-black/20 border border-tower-border rounded px-3 py-3"
                  >
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Type</label>
                      <select
                        value={item.itemType}
                        onChange={(event) =>
                          handleItemDraftChange(index, {
                            itemType: event.target.value as CreateItemDraft['itemType'],
                          })
                        }
                        className="w-full rounded bg-black/40 border border-tower-border px-2 py-1 text-sm"
                      >
                        <option value="tool">Tool</option>
                        <option value="material">Material</option>
                        <option value="equipment">Equipment</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Qty</label>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={item.quantity}
                        onChange={(event) =>
                          handleItemDraftChange(index, {
                            quantity: Number(event.target.value) || 0,
                          })
                        }
                        className="w-full rounded bg-black/40 border border-tower-border px-2 py-1 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Unit</label>
                      <input
                        value={item.unit}
                        onChange={(event) =>
                          handleItemDraftChange(index, { unit: event.target.value })
                        }
                        className="w-full rounded bg-black/40 border border-tower-border px-2 py-1 text-sm"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-400">Required</label>
                      <input
                        type="checkbox"
                        checked={item.isRequired}
                        onChange={(event) =>
                          handleItemDraftChange(index, { isRequired: event.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="ml-auto text-xs text-red-300 hover:text-red-200"
                        aria-label="Remove item"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {formError && <div className="text-xs text-red-400">{formError}</div>}
            {formSuccess && <div className="text-xs text-green-300">{formSuccess}</div>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded bg-tower-accent px-4 py-2 text-sm font-medium text-white hover:bg-tower-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating�' : 'Create Kit'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

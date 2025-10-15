'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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

// Authentication handled by middleware.ts (checks session, role, tenant)
function JobItemsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [assignedItems, setAssignedItems] = useState<AssignedItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loadError, setLoadError] = useState('');

  async function loadJobItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/supervisor/jobs/${jobId}/items`);
      const data = await res.json();
      if (res.ok) {
        setJob(data.job);
        setAssignedItems(data.assignedItems || []);
      } else {
        setMessage('Failed to load job items');
      }
    } catch (error) {
      setMessage('Error loading job items');
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableItems() {
    try {
      const res = await fetch('/api/supervisor/items');

      const data = await res.json();

      if (res.ok && data.items) {
        setAvailableItems(data.items);
        if (data.items.length === 0) {
          setLoadError('No items found. Please create some items first.');
        }
      } else {
        setLoadError(data.error || 'Failed to load items');
      }
    } catch (error) {
      setLoadError('Error loading items');
    }
  }

  async function addItemToJob() {
    if (!selectedItemId) return;

    const selectedItem = availableItems.find(i => i.id === selectedItemId);
    if (!selectedItem) return;

    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/supervisor/jobs/${jobId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          item_id: selectedItem.id,
          quantity: parseFloat(quantity)
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Added ${selectedItem.name} to job`);
        setSelectedItemId('');
        setQuantity('1');
        loadJobItems();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to add item');
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(itemId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/supervisor/jobs/${jobId}/items/${itemId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setMessage('Item returned successfully');
        loadJobItems();
      } else {
        setMessage('Failed to remove item');
      }
    } catch (error) {
      setMessage('Error removing item');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobItems();
    loadAvailableItems();
  }, [jobId]);

  if (!job) {
    return (
      <div className="min-h-screen bg-black p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <button
            onClick={() => router.push('/supervisor/jobs')}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            ← Back to Jobs
          </button>

          <h1 className="text-3xl font-bold text-white">Job Items Management</h1>
          <div className="mt-2 text-gray-400">
            <span className="font-semibold text-white">Job #{job.job_number}:</span> {job.title}
            <span className={`ml-4 rounded px-2 py-1 text-xs ${
              job.status === 'scheduled' ? 'bg-blue-900 text-blue-200' :
              job.status === 'in_progress' ? 'bg-yellow-900 text-yellow-200' :
              job.status === 'completed' ? 'bg-green-900 text-green-200' :
              'bg-gray-800 text-gray-200'
            }`}>
              {job.status}
            </span>
          </div>
        </div>

        {/* Add Item Form */}
        <div className="mb-6 rounded-lg bg-gray-900 p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-white">Add Item to Job</h2>

          {loadError && (
            <div className="mb-4 rounded border border-red-700 bg-red-900/50 p-4 text-red-200">
              {loadError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-300">Select Item</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Choose an item...</option>
                {availableItems.length === 0 && (
                  <option disabled>No items available</option>
                )}
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.item_type} ({item.current_quantity} {item.unit_of_measure} available)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-400"
                min="1"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={addItemToJob}
              disabled={loading || !selectedItemId}
              className="rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              {loading ? 'Adding...' : 'Add to Job'}
            </button>

            {message && (
              <span className={message.includes('Error') ? 'text-red-400' : 'text-green-400'}>
                {message}
              </span>
            )}
          </div>
        </div>

        {/* Assigned Items */}
        <div className="rounded-lg bg-gray-900 p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-white">
            Assigned Items ({assignedItems.length})
          </h2>

          {loading && <p className="text-gray-400">Loading...</p>}

          {assignedItems.length === 0 ? (
            <p className="text-gray-500">No items assigned to this job yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-2 text-gray-300">Item Name</th>
                    <th className="py-2 text-gray-300">Type</th>
                    <th className="py-2 text-gray-300">Category</th>
                    <th className="py-2 text-gray-300">Quantity</th>
                    <th className="py-2 text-gray-300">Unit</th>
                    <th className="py-2 text-gray-300">Assigned</th>
                    <th className="py-2 text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedItems.map((item) => (
                    <tr key={item.transaction_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 font-medium text-white">{item.item_name}</td>
                      <td className="py-2 text-gray-400">{item.item_type}</td>
                      <td className="py-2 text-gray-400">{item.category}</td>
                      <td className="py-2 text-gray-400">{item.quantity}</td>
                      <td className="py-2 text-gray-400">{item.unit_of_measure}</td>
                      <td className="py-2 text-sm text-gray-500">
                        {new Date(item.assigned_at).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => removeItem(item.item_id)}
                          disabled={loading}
                          className="text-sm text-red-400 hover:text-red-300"
                        >
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default JobItemsPage;

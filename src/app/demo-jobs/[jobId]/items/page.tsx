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

export default function JobItemsPage() {
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
      const res = await fetch('/api/supervisor/items', {
        headers: {
          'x-tenant-id': '00000000-0000-0000-0000-000000000000'  // Default tenant UUID
        }
      });
      const data = await res.json();
      if (res.ok && data.items) {
        setAvailableItems(data.items);
      }
    } catch (error) {
      console.error('Failed to load available items');
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
          'Content-Type': 'application/json',
          'x-tenant-id': '00000000-0000-0000-0000-000000000000'
        },
        body: JSON.stringify({
          item_id: selectedItem.id,
          item_name: selectedItem.name,
          item_type: selectedItem.item_type,
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
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <button
          onClick={() => router.push('/demo-jobs')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Jobs
        </button>
        
        <h1 className="text-3xl font-bold">Job Items Management</h1>
        <div className="text-gray-600 mt-2">
          <span className="font-semibold">Job #{job.job_number}:</span> {job.title}
          <span className={`ml-4 px-2 py-1 rounded text-xs ${
            job.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
            job.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
            job.status === 'completed' ? 'bg-green-100 text-green-800' :
            'bg-gray-100'
          }`}>
            {job.status}
          </span>
        </div>
      </div>

      {/* Add Item Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Add Item to Job</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-lg font-semibold mb-2">Select Item</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full rounded-md border border-gray-400 bg-white px-4 py-3 text-lg leading-7 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            >
              <option value="">Choose an item...</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.item_type} ({item.current_quantity} {item.unit_of_measure} available)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-lg font-semibold mb-2">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-gray-400 bg-white px-4 py-3 text-lg leading-7 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              min="1"
            />
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={addItemToJob}
            disabled={loading || !selectedItemId}
            className="px-6 py-3 bg-blue-600 text-white text-lg font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            {loading ? 'Adding...' : 'Add to Job'}
          </button>
          
          {message && (
            <span className={message.includes('Error') ? 'text-red-600' : 'text-green-600'}>
              {message}
            </span>
          )}
        </div>
      </div>

      {/* Assigned Items */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Assigned Items ({assignedItems.length})
        </h2>
        
        {loading && <p>Loading...</p>}
        
        {assignedItems.length === 0 ? (
          <p className="text-gray-500">No items assigned to this job yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Item Name</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Quantity</th>
                  <th className="py-2">Unit</th>
                  <th className="py-2">Assigned</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignedItems.map((item) => (
                  <tr key={item.transaction_id} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{item.item_name}</td>
                    <td className="py-2">{item.item_type}</td>
                    <td className="py-2">{item.category}</td>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2">{item.unit_of_measure}</td>
                    <td className="py-2 text-sm text-gray-600">
                      {new Date(item.assigned_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeItem(item.item_id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-800 text-sm"
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
  );
}
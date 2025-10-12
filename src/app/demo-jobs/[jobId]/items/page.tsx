'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Job {
  id: string;
  job_number: string;
  title: string;
  status: string;
}

interface ChecklistItem {
  id: string;
  sequence_number: number;
  item_type: string;
  item_id: string;
  item_name: string;
  quantity: number;
  status: string;
  container_id?: string;
  notes?: string;
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
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
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
        setChecklistItems(data.checklistItems || []);
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
      const res = await fetch('/api/debug/items');
      const data = await res.json();
      if (data.sampleData?.items) {
        setAvailableItems(data.sampleData.items);
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
        headers: { 'Content-Type': 'application/json' },
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

  async function removeItem(checklistItemId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/supervisor/jobs/${jobId}/items/${checklistItemId}`, {
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
            <label className="block text-sm font-medium mb-1">Select Item</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
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
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={addItemToJob}
            disabled={loading || !selectedItemId}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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

      {/* Checklist Items */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Job Checklist Items ({checklistItems.length})
        </h2>
        
        {loading && <p>Loading...</p>}
        
        {checklistItems.length === 0 ? (
          <p className="text-gray-500">No items assigned to this job yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2">#</th>
                  <th className="py-2">Item Name</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Quantity</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Container</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {checklistItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{item.sequence_number}</td>
                    <td className="py-2 font-medium">{item.item_name}</td>
                    <td className="py-2">{item.item_type}</td>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.status === 'loaded' ? 'bg-green-100 text-green-800' :
                        item.status === 'verified' ? 'bg-blue-100 text-blue-800' :
                        item.status === 'missing' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {item.container_id || '-'}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {checklistItems.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            <p>Status Legend:</p>
            <div className="flex gap-4 mt-1">
              <span><span className="px-2 py-1 rounded text-xs bg-gray-100">pending</span> = Not loaded</span>
              <span><span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">loaded</span> = On truck</span>
              <span><span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">verified</span> = Verified by vision</span>
              <span><span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">missing</span> = Not found</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
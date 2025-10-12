'use client';

import { useEffect, useState } from 'react';

interface Item {
  id: string;
  name: string;
  item_type: string;
  category: string;
  tracking_mode: string;
  current_quantity: number;
  unit_of_measure: string;
  status: string;
}

export default function DemoItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form state
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState('material');
  const [category, setCategory] = useState('general');
  const [trackingMode, setTrackingMode] = useState('quantity');
  const [quantity, setQuantity] = useState('10');
  const [unit, setUnit] = useState('each');

  async function loadItems() {
    setLoading(true);
    try {
      const res = await fetch('/api/supervisor/items', {
        headers: {
          'x-tenant-id': 'demo-company'
        }
      });
      const data = await res.json();
      if (res.ok && data.items) {
        setItems(data.items);
      } else {
        setMessage('Failed to load items');
      }
    } catch (error) {
      setMessage('Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  async function createItem() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/supervisor/items', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo-company'
        },
        body: JSON.stringify({
          name,
          item_type: itemType,
          category,
          tracking_mode: trackingMode,
          current_quantity: parseFloat(quantity),
          unit_of_measure: unit
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage('Item created successfully!');
        setName('');
        loadItems();
      } else {
        setMessage(`Error: ${data.error || 'Failed to create'}`);
      }
    } catch (error) {
      setMessage('Failed to create item');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Demo Items Management</h1>
      
      {/* Create Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Item</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-lg font-semibold mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-400 bg-white px-4 py-3 text-lg leading-7 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              placeholder="e.g. Fertilizer 20-10-10"
            />
          </div>
          
          <div>
            <label className="block text-lg font-semibold mb-2">Type</label>
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              className="w-full rounded-md border border-gray-400 bg-white px-4 py-3 text-lg leading-7 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            >
              <option value="equipment">Equipment</option>
              <option value="material">Material</option>
              <option value="tool">Tool</option>
              <option value="consumable">Consumable</option>
            </select>
          </div>
          
          <div>
            <label className="block text-lg font-semibold mb-2">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-400 bg-white px-4 py-3 text-lg leading-7 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              placeholder="e.g. lawn-care"
            />
          </div>
          
          <div>
            <label className="block text-lg font-semibold mb-2">Tracking Mode</label>
            <select
              value={trackingMode}
              onChange={(e) => setTrackingMode(e.target.value)}
              className="w-full rounded-md border border-gray-400 bg-white px-4 py-3 text-lg leading-7 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            >
              <option value="individual">Individual (Serial #)</option>
              <option value="quantity">Quantity</option>
              <option value="batch">Batch</option>
            </select>
          </div>
          
          <div>
            <label className="block text-lg font-semibold mb-2">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-gray-400 bg-white px-4 py-3 text-lg leading-7 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              disabled={trackingMode === 'individual'}
            />
          </div>
          
          <div>
            <label className="block text-lg font-semibold mb-2">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-md border border-gray-400 bg-white px-4 py-3 text-lg leading-7 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              placeholder="e.g. pound, gallon"
            />
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={createItem}
            disabled={loading || !name}
            className="px-6 py-3 bg-blue-600 text-white text-lg font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            {loading ? 'Creating...' : 'Create Item'}
          </button>
          
          {message && (
            <span className={message.includes('Error') ? 'text-red-600' : 'text-green-600'}>
              {message}
            </span>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Items ({items.length})</h2>
          <button
            onClick={loadItems}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Refresh
          </button>
        </div>
        
        {loading && <p>Loading...</p>}
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Category</th>
                <th className="py-2">Tracking</th>
                <th className="py-2">Quantity</th>
                <th className="py-2">Unit</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.item_type}</td>
                  <td className="py-2">{item.category}</td>
                  <td className="py-2">{item.tracking_mode}</td>
                  <td className="py-2">{item.current_quantity}</td>
                  <td className="py-2">{item.unit_of_measure}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
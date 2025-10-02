/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/supervisor/inventory/page.tsx
 * phase: 3
 * domain: supervisor
 * purpose: Inventory management page with camera-based item addition
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-ui.md
 * complexity_budget: 350
 * migrations_touched: []
 * state_machine: {
 *   states: ['viewing', 'adding_item', 'camera_active', 'processing'],
 *   transitions: [
 *     'viewing->adding_item: addItem()',
 *     'adding_item->camera_active: openCamera()',
 *     'camera_active->processing: captureImage()',
 *     'processing->viewing: itemAdded()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "intentRecognition": "$0.02-0.05 per image"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/components/camera/CameraCapture',
 *     '@/components/ui/ButtonLimiter',
 *     '@/components/voice/VoiceCommandButton'
 *   ],
 *   external: ['react', 'next/navigation'],
 *   supabase: ['inventory']
 * }
 * exports: ['default']
 * voice_considerations: Voice commands for adding/searching inventory
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/supervisor-inventory-flow.test.ts'
 * }
 * tasks: [
 *   'Create inventory list with search/filter',
 *   'Add camera-based item addition flow',
 *   'Implement voice commands for inventory management',
 *   'Show low stock alerts and statistics'
 * ]
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Camera,
  Package,
  AlertTriangle,
  Filter,
  RefreshCw,
  WifiOff,
  X,
  CheckCircle
} from 'lucide-react';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  thumbnailUrl?: string;
  container?: string;
  lastUpdated: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

interface IntentResult {
  intent: string;
  confidence: number;
  suggestedAction?: string;
}

export default function SupervisorInventoryPage() {
  const router = useRouter();
  const { actions, addAction, clearActions } = useButtonActions();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  
  // Camera/Intent states
  const [showCamera, setShowCamera] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<IntentResult | null>(null);
  const [isProcessingIntent, setIsProcessingIntent] = useState(false);
  
  // Add item form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'equipment',
    quantity: 1,
    minQuantity: 5,
    container: '',
    imageUrl: ''
  });

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'materials', label: 'Materials' },
    { value: 'tools', label: 'Tools' },
    { value: 'safety', label: 'Safety' },
    { value: 'other', label: 'Other' }
  ];

  // Setup button actions
  useEffect(() => {
    clearActions();

    if (showCamera || showAddForm) {
      addAction({
        id: 'cancel',
        label: 'Cancel',
        priority: 'high',
        icon: X,
        onClick: () => {
          setShowCamera(false);
          setShowAddForm(false);
          setCurrentIntent(null);
        },
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    } else {
      addAction({
        id: 'add-item',
        label: 'Add Item',
        priority: 'critical',
        icon: Plus,
        onClick: () => setShowCamera(true),
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });

      addAction({
        id: 'search',
        label: 'Search',
        priority: 'high',
        icon: Search,
        onClick: () => document.getElementById('search-input')?.focus(),
        className: 'bg-blue-600 text-white hover:bg-blue-700'
      });

      addAction({
        id: 'refresh',
        label: 'Refresh',
        priority: 'medium',
        icon: RefreshCw,
        onClick: fetchInventory,
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    }
  }, [showCamera, showAddForm, clearActions, addAction]);

  // Fetch inventory data
  const fetchInventory = useCallback(async () => {
    try {
      const response = await fetch('/api/supervisor/inventory');
      if (!response.ok) throw new Error('Failed to fetch inventory');
      
      const data = await response.json();
      setItems(data.items || []);
      setIsOffline(false);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      setIsOffline(true);
      
      // Load from cache
      const cached = localStorage.getItem('inventory_cache');
      if (cached) {
        setItems(JSON.parse(cached));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter items based on search and category
  useEffect(() => {
    let filtered = items;

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    setFilteredItems(filtered);
  }, [items, searchQuery, selectedCategory]);

  // Initial data fetch
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Handle camera capture for intent recognition
  const handleCameraCapture = async (imageBlob: Blob, imageUrl: string) => {
    setIsProcessingIntent(true);
    
    try {
      // Convert blob to base64
      const base64 = await blobToBase64(imageBlob);
      
      const response = await fetch('/api/intent/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          context: {
            currentPage: 'inventory',
            userRole: 'supervisor'
          }
        })
      });

      if (!response.ok) throw new Error('Intent classification failed');
      
      const result = await response.json();
      
      if (result.classification.intent === 'inventory_add') {
        setCurrentIntent({
          intent: result.classification.intent,
          confidence: result.classification.confidence,
          suggestedAction: result.classification.suggestedAction
        });
        
        // Pre-fill form with detected item
        setNewItem(prev => ({
          ...prev,
          imageUrl
        }));
      } else {
        // Intent not recognized for inventory
        setCurrentIntent({
          intent: 'unknown',
          confidence: 0,
          suggestedAction: 'This doesn\'t look like an inventory item'
        });
      }
    } catch (error) {
      console.error('Intent recognition failed:', error);
      setCurrentIntent({
        intent: 'error',
        confidence: 0,
        suggestedAction: 'Failed to analyze image'
      });
    } finally {
      setIsProcessingIntent(false);
    }
  };

  // Handle intent confirmation
  const handleIntentConfirmed = () => {
    setShowCamera(false);
    setShowAddForm(true);
  };

  // Handle voice commands
  const handleVoiceCommand = async (transcript: string) => {
    try {
      const response = await fetch('/api/supervisor/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          context: {
            currentPage: 'inventory',
            itemCount: items.length
          }
        })
      });

      const result = await response.json();
      
      // Handle voice actions
      if (result.response.actions) {
        for (const action of result.response.actions) {
          if (action.type === 'create' && action.target === 'inventory_item') {
            setShowCamera(true);
          }
        }
      }
    } catch (error) {
      console.error('Voice command error:', error);
    }
  };

  // Handle form submission
  const handleAddItem = async () => {
    try {
      const response = await fetch('/api/supervisor/inventory/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });

      if (!response.ok) throw new Error('Failed to add item');
      
      const result = await response.json();
      
      if (result.success) {
        setItems(prev => [...prev, result.item]);
        setShowAddForm(false);
        setNewItem({
          name: '',
          category: 'equipment',
          quantity: 1,
          minQuantity: 5,
          container: '',
          imageUrl: ''
        });
      }
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  // Camera view
  if (showCamera) {
    return (
      <div className="min-h-screen bg-black">
        <CameraCapture
          onCapture={handleCameraCapture}
          onIntentDetected={handleIntentConfirmed}
          maxFps={1}
          showIntentOverlay={true}
          currentIntent={currentIntent}
          isProcessing={isProcessingIntent}
          className="h-screen"
        />
        
        {/* Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
          <ButtonLimiter
            actions={actions}
            maxVisibleButtons={4}
            showVoiceButton={false}
            className="justify-center"
          />
        </div>
      </div>
    );
  }

  // Add item form
  if (showAddForm) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Add Inventory Item</h2>
          
          {newItem.imageUrl && (
            <div className="mb-4">
              <img 
                src={newItem.imageUrl} 
                alt="Captured item"
                className="w-full h-32 object-cover rounded-lg"
              />
            </div>
          )}
          
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name
              </label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter item name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={newItem.category}
                onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {categories.slice(1).map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Stock
                </label>
                <input
                  type="number"
                  value={newItem.minQuantity}
                  onChange={(e) => setNewItem(prev => ({ ...prev, minQuantity: parseInt(e.target.value) }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  min="0"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Container (Optional)
              </label>
              <input
                type="text"
                value={newItem.container}
                onChange={(e) => setNewItem(prev => ({ ...prev, container: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Truck 1 - Tool Box"
              />
            </div>
          </form>
          
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleAddItem}
              disabled={!newItem.name}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Item
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main inventory view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-800"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            </div>
            
            {isOffline && (
              <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 rounded-full">
                <WifiOff className="w-4 h-4 text-orange-600" />
                <span className="text-orange-800 text-sm">Offline</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inventory..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            
            <div className="sm:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{items.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {items.filter(item => item.status === 'low_stock').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <X className="w-8 h-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {items.filter(item => item.status === 'out_of_stock').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">In Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {items.filter(item => item.status === 'in_stock').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions and Voice */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Inventory List */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Inventory Items ({filteredItems.length})
                </h2>
              </div>
              <div className="p-6">
                {filteredItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                      <InventoryItemCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No items found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={false}
                layout="grid"
                className="w-full"
              />
            </div>

            {/* Voice Assistant */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Assistant</h3>
              <div className="text-center">
                <VoiceCommandButton
                  onTranscript={handleVoiceCommand}
                  size="lg"
                  className="mx-auto"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Try: "Add new item", "Show low stock"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inventory item card component
interface InventoryItemCardProps {
  item: InventoryItem;
}

function InventoryItemCard({ item }: InventoryItemCardProps) {
  const statusColor = {
    in_stock: 'bg-emerald-100 text-emerald-800',
    low_stock: 'bg-orange-100 text-orange-800',
    out_of_stock: 'bg-red-100 text-red-800'
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          {item.thumbnailUrl ? (
            <img 
              src={item.thumbnailUrl} 
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
          <p className="text-sm text-gray-600 capitalize">{item.category}</p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-lg font-semibold text-gray-900">
              {item.quantity}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[item.status]}`}>
              {item.status.replace('_', ' ')}
            </span>
          </div>
          
          {item.container && (
            <p className="text-xs text-gray-500 mt-1">{item.container}</p>
          )}
        </div>
      </div>
    </div>
  );
}
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
 *     '@/components/voice/VoiceCommandButton',
 *     '@/components/navigation/MobileNavigation'
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
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
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
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Save,
  Loader2,
  PackageOpen,
  PackageCheck,
  PackageX
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';
import { SimpleCameraCapture } from '@/components/camera/SimpleCameraCapture';

// Simple camera component for capturing photos
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


interface NewItemForm {
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  container: string;
  imageUrl?: string;
}

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'materials', label: 'Materials' },
  { value: 'tools', label: 'Tools' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' }
];

export default function SupervisorInventoryPage() {
  const router = useRouter();
  const { actions, addAction, clearActions } = useButtonActions();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // View states
  const [view, setView] = useState<'list' | 'add_form' | 'camera'>('list');
  
  
  // Add item form
  const [newItem, setNewItem] = useState<NewItemForm>({
    name: '',
    category: 'equipment',
    quantity: 1,
    minQuantity: 5,
    container: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Mock inventory data
  const mockItems: InventoryItem[] = [
    {
      id: '1',
      name: 'Lawn Mower - Commercial',
      category: 'equipment',
      quantity: 3,
      minQuantity: 2,
      status: 'in_stock',
      container: 'Truck 1 - Main Bay',
      lastUpdated: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Trimmer Line 0.095"',
      category: 'materials',
      quantity: 1,
      minQuantity: 5,
      status: 'low_stock',
      container: 'Storage - Shelf A',
      lastUpdated: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Safety Goggles',
      category: 'safety',
      quantity: 0,
      minQuantity: 10,
      status: 'out_of_stock',
      lastUpdated: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Hedge Trimmer',
      category: 'equipment',
      quantity: 2,
      minQuantity: 1,
      status: 'in_stock',
      container: 'Truck 2 - Tool Box',
      lastUpdated: new Date().toISOString()
    }
  ];

  // Load inventory items
  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      // Use default tenant for now - TODO: Get from user context
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await fetch(`/api/supervisor/inventory?${params}`, {
        headers: { 'x-tenant-id': tenantId },
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      console.log('[Inventory] API Response sample:', data.items?.[0]);

      // Transform API response to component format
      const transformedItems = (data.items || []).map((item: any) => {
        // Calculate status based on quantity and reorder level
        let status = 'in_stock';
        if (item.current_quantity !== null) {
          if (item.current_quantity === 0) {
            status = 'out_of_stock';
          } else if (item.reorder_level && item.current_quantity <= item.reorder_level) {
            status = 'low_stock';
          }
        }

        const transformed = {
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.current_quantity || 0,
          minQuantity: item.reorder_level || 5,
          thumbnailUrl: item.thumbnail_url,
          container: item.specifications?.container || 'Unknown',
          lastUpdated: item.updated_at || item.created_at,
          status: status
        };

        if (item.thumbnail_url) {
          console.log('[Inventory] Item with thumbnail:', item.name, item.thumbnail_url);
        }

        return transformed;
      });

      console.log('[Inventory] Transformed items with thumbnails:',
        transformedItems.filter((i: any) => i.thumbnailUrl).map((i: any) => ({ name: i.name, url: i.thumbnailUrl }))
      );
      
      setItems(transformedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
      // Fallback to mock data if API fails
      console.warn('API failed, using mock data:', err);
      setItems(mockItems);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  // Filter items
  useEffect(() => {
    let filtered = items;
    
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.container?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    setFilteredItems(filtered);
  }, [items, searchQuery, selectedCategory]);

  // Setup button actions
  useEffect(() => {
    clearActions();
    
    if (view === 'list') {
      addAction({
        id: 'add-item',
        label: 'Add Item',
        priority: 'high',
        icon: Plus,
        onClick: () => setView('add_form'),
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });

      addAction({
        id: 'search',
        label: 'Search',
        priority: 'medium',
        icon: Search,
        onClick: () => document.getElementById('search-input')?.focus(),
        className: 'bg-blue-600 text-white hover:bg-blue-700'
      });

      addAction({
        id: 'filter',
        label: 'Filter',
        priority: 'medium',
        icon: Filter,
        onClick: () => setSelectedCategory(selectedCategory === 'all' ? 'equipment' : 'all'),
        className: 'bg-purple-600 text-white hover:bg-purple-700'
      });

      addAction({
        id: 'refresh',
        label: 'Refresh',
        priority: 'low',
        icon: RefreshCw,
        onClick: loadInventory,
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    } else if (view === 'add_form') {
      addAction({
        id: 'save-item',
        label: 'Save',
        priority: 'high',
        icon: Save,
        disabled: !newItem.name || isSaving,
        onClick: handleSaveItem,
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });
    }
  }, [view, selectedCategory, newItem.name, isSaving, addAction, clearActions, loadInventory]);

  // Load data on mount
  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setIsOffline(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const analyzePhoto = async () => {
    if (!newItem.imageUrl) return;
    
    setIsAnalyzing(true);
    try {
      // Convert data URL to base64
      const base64Image = newItem.imageUrl.split(',')[1];
      
      const response = await fetch('/api/vision/analyze-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          prompt: 'Identify this item and suggest an appropriate name for inventory tracking. Focus on the main object in the image. Respond with just the item name, like "Lawn Mower" or "Safety Goggles".'
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.analysis) {
        // Extract the suggested name and try to determine category
        const suggestedName = data.analysis.trim();
        let suggestedCategory = 'equipment';
        
        // Simple category detection based on common keywords
        const lowerName = suggestedName.toLowerCase();
        if (lowerName.includes('fertilizer') || lowerName.includes('seed') || lowerName.includes('chemical') || lowerName.includes('fuel')) {
          suggestedCategory = 'materials';
        } else if (lowerName.includes('safety') || lowerName.includes('goggle') || lowerName.includes('helmet') || lowerName.includes('glove')) {
          suggestedCategory = 'safety';
        } else if (lowerName.includes('tool') || lowerName.includes('wrench') || lowerName.includes('screwdriver') || lowerName.includes('hammer')) {
          suggestedCategory = 'tools';
        }
        
        setNewItem(prev => ({
          ...prev,
          name: suggestedName,
          category: suggestedCategory
        }));
        
        setSuccess(`Item identified as: ${suggestedName}`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Could not analyze photo. Please enter item name manually.');
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      console.error('Photo analysis error:', error);
      setError('Photo analysis failed. Please enter item name manually.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveItem = async () => {
    if (!newItem.name) return;

    setIsSaving(true);
    try {
      // Use default tenant for now - TODO: Get from user context
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await fetch('/api/supervisor/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newItem.name,
          category: newItem.category,
          quantity: newItem.quantity,
          min_quantity: newItem.minQuantity,
          container: newItem.container
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      setSuccess(data.message || 'Item added successfully and saved to database');
      setTimeout(() => setSuccess(null), 5000);
      
      // Reset form and return to list
      setNewItem({
        name: '',
        category: 'equipment',
        quantity: 1,
        minQuantity: 5,
        container: ''
      });
      setView('list');
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVoiceCommand = useCallback((transcript: string) => {
    const command = transcript.toLowerCase();
    
    if (command.includes('add') || command.includes('new')) {
      setView('camera');
    } else if (command.includes('search')) {
      document.getElementById('search-input')?.focus();
    } else if (command.includes('low stock')) {
      setSelectedCategory('all');
      setSearchQuery('');
      // Filter will show all, but stats will highlight low stock
    } else if (command.includes('show inventory') || command.includes('list items')) {
      setView('list');
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center" style={{ padding: '0 0.5rem', boxSizing: 'border-box' }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-golden mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading inventory...</p>
        </div>
      </div>
    );
  }

  // Camera view
  if (view === 'camera') {
    return (
      <div className="mobile-container">
        {/* Mobile Navigation */}
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/')}
        />
        
        {/* Header */}
        <div className="header-bar">
          <div>
            <h1 className="text-xl font-semibold">Capture Photo</h1>
          </div>
        </div>

        {/* Camera Content */}
        <div className="flex-1 flex flex-col">
          <SimpleCameraCapture
            onCapture={({ imageUrl }) => {
              setNewItem(prev => ({ ...prev, imageUrl }));
              setView('add_form');
            }}
            onCancel={() => setView('add_form')}
          />
        </div>

        {/* Styled JSX for mobile styling */}
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 0 0.5rem;
            box-sizing: border-box;
          }
          .header-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem;
            border-bottom: 1px solid #333;
            background: rgba(0, 0, 0, 0.9);
          }
        `}</style>
      </div>
    );
  }

  // Add item form view
  if (view === 'add_form') {
    return (
      <div className="mobile-container">
        {/* Mobile Navigation */}
        <MobileNavigation
          currentRole="supervisor"
          onLogout={() => router.push('/')}
        />
        
        {/* Header */}
        <div className="header-bar">
          <div>
            <h1 className="text-xl font-semibold">Add New Item</h1>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="notification-bar error">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="notification-bar success">
            <CheckCircle className="w-5 h-5 text-golden flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Photo Capture Section */}
          <div className="mb-6">
            {newItem.imageUrl ? (
              <div className="space-y-3">
                <img 
                  src={newItem.imageUrl} 
                  alt="Captured item"
                  className="w-full h-32 object-cover rounded-lg border-2 border-golden"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItem(prev => ({ ...prev, imageUrl: '' }))}
                    className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                  >
                    Remove Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('camera')}
                    className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
                  >
                    Retake Photo
                  </button>
                </div>
                {!newItem.name && (
                  <button
                    type="button"
                    onClick={analyzePhoto}
                    disabled={isAnalyzing}
                    className="w-full py-2 px-4 bg-golden text-black rounded-lg text-sm font-medium hover:bg-yellow-500 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing Photo...
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        Auto-fill from Photo
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setView('camera')}
                className="w-full py-4 px-4 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-golden hover:text-golden transition-colors flex flex-col items-center gap-2"
              >
                <Camera className="w-8 h-8" />
                <span className="font-medium">Add Photo (Optional)</span>
                <span className="text-sm">Tap to capture item image</span>
              </button>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveItem(); }} className="space-y-4">
            {/* Item Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">
                Item Name *
              </label>
              <input
                id="name"
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                className="input-field"
                placeholder="Enter item name"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-400 mb-2">
                Category
              </label>
              <select
                id="category"
                value={newItem.category}
                onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                className="input-field"
              >
                {categories.slice(1).map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity and Min Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-400 mb-2">
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                  className="input-field"
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="minQuantity" className="block text-sm font-medium text-gray-400 mb-2">
                  Min Stock
                </label>
                <input
                  id="minQuantity"
                  type="number"
                  value={newItem.minQuantity}
                  onChange={(e) => setNewItem(prev => ({ ...prev, minQuantity: parseInt(e.target.value) || 0 }))}
                  className="input-field"
                  min="0"
                />
              </div>
            </div>

            {/* Container */}
            <div>
              <label htmlFor="container" className="block text-sm font-medium text-gray-400 mb-2">
                Container (Optional)
              </label>
              <input
                id="container"
                type="text"
                value={newItem.container}
                onChange={(e) => setNewItem(prev => ({ ...prev, container: e.target.value }))}
                className="input-field"
                placeholder="e.g., Truck 1 - Tool Box"
              />
            </div>
          </form>
        </div>

        {/* Bottom Actions */}
        <div className="bottom-actions">
          <button
            onClick={() => setView('list')}
            className="btn-secondary flex-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Cancel
          </button>
          <button
            onClick={handleSaveItem}
            disabled={!newItem.name || isSaving}
            className="btn-primary flex-1"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            Save Item
          </button>
        </div>

        {/* Styled JSX */}
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 0 0.5rem;
            box-sizing: border-box;
          }

          .header-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem;
            border-bottom: 1px solid #333;
            background: rgba(0, 0, 0, 0.9);
          }

          .notification-bar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            margin: 0.5rem 1rem;
            border-radius: 0.5rem;
          }
          .notification-bar.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
          }
          .notification-bar.success {
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.3);
          }

          .input-field {
            width: 100%;
            padding: 0.75rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.5rem;
            color: white;
            font-size: 1rem;
          }
          .input-field:focus {
            outline: none;
            border-color: #FFD700;
            box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
          }

          .bottom-actions {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            border-top: 1px solid #333;
            background: rgba(0, 0, 0, 0.9);
          }

          .btn-primary {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.875rem 1.5rem;
            background: #FFD700;
            color: #000;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .btn-primary:hover:not(:disabled) {
            background: #F5D914;
          }
          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.875rem 1.5rem;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        `}</style>
      </div>
    );
  }

  // Main list view
  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
      />
      
      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Inventory Management</h1>
          <p className="text-xs text-gray-500 mt-1">{filteredItems.length} items • {isOffline ? 'Offline' : 'Online'}</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="notification-bar success">
          <CheckCircle className="w-5 h-5 text-golden flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="search-bar">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search inventory..."
          className="search-input"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="stats-container">
        <div className="stat-card">
          <PackageCheck className="w-6 h-6 text-emerald-500" />
          <div className="stat-info">
            <p className="stat-label">In Stock</p>
            <p className="stat-value">{items.filter(item => item.status === 'in_stock').length}</p>
          </div>
        </div>
        <div className="stat-card">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <div className="stat-info">
            <p className="stat-label">Low Stock</p>
            <p className="stat-value">{items.filter(item => item.status === 'low_stock').length}</p>
          </div>
        </div>
        <div className="stat-card">
          <PackageX className="w-6 h-6 text-red-500" />
          <div className="stat-info">
            <p className="stat-label">Out of Stock</p>
            <p className="stat-value">{items.filter(item => item.status === 'out_of_stock').length}</p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="filter-container">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="filter-select"
        >
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Inventory List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {filteredItems.length > 0 ? (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <InventoryItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <PackageOpen className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-center text-lg">No items found</p>
            <p className="text-gray-600 text-center text-sm mt-2">
              {searchQuery ? 'Try adjusting your search' : 'Add items to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Voice Assistant */}
      <div className="voice-container">
        <VoiceCommandButton
          onTranscript={handleVoiceCommand}
          size="md"
        />
        <p className="voice-hint">Try: "Add new item", "Show low stock"</p>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          onClick={() => router.push('/supervisor')}
          className="btn-secondary"
          style={{flex: '0 0 auto'}}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setView('add_form')}
          className="btn-secondary flex-1"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Manually
        </button>
        <button
          onClick={() => setView('camera')}
          className="btn-primary flex-1"
        >
          <Camera className="w-5 h-5 mr-2" />
          With Photo
        </button>
      </div>

      {/* Styled JSX */}
      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 0.5rem;
          box-sizing: border-box;
        }

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .notification-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 1rem;
          border-radius: 0.5rem;
        }
        .notification-bar.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .notification-bar.success {
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 1rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
        }

        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 1rem;
          outline: none;
        }
        .search-input::placeholder {
          color: #9CA3AF;
        }

        .stats-container {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.75rem;
          margin: 0 1rem 1rem 1rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
        }

        .stat-info {
          min-width: 0;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #9CA3AF;
          margin: 0;
        }

        .stat-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: white;
          margin: 0;
        }

        .filter-container {
          margin: 0 1rem 1rem 1rem;
        }

        .filter-select {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 1rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
        }

        .voice-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          border-top: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .voice-hint {
          font-size: 0.75rem;
          color: #9CA3AF;
          text-align: center;
          margin: 0;
        }

        .bottom-actions {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-top: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.875rem 1.5rem;
          background: #FFD700;
          color: #000;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-primary:hover {
          background: #F5D914;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.875rem 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

// Inventory Item Card Component
function InventoryItemCard({ item }: { item: InventoryItem }) {
  const router = useRouter();

  const statusColors = {
    in_stock: 'bg-emerald-600 text-white',
    low_stock: 'bg-orange-600 text-white',
    out_of_stock: 'bg-red-600 text-white'
  };

  const statusLabels = {
    in_stock: 'In Stock',
    low_stock: 'Low Stock',
    out_of_stock: 'Out of Stock'
  };

  return (
    <div
      className="item-card"
      onClick={() => router.push(`/supervisor/inventory/${item.id}`)}
    >
      <div className="flex items-start gap-3">
        <div className="item-thumbnail">
          {item.thumbnailUrl ? (
            <img 
              src={item.thumbnailUrl} 
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-6 h-6 text-gray-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="item-name">{item.name}</h4>
          <p className="item-category">{item.category}</p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="item-quantity">
              {item.quantity} units
            </span>
            <span className={`item-status ${statusColors[item.status]}`}>
              {statusLabels[item.status]}
            </span>
          </div>
          
          {item.container && (
            <p className="item-container">{item.container}</p>
          )}
        </div>
      </div>

      <style jsx>{`
        .item-card {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          transition: all 0.2s;
          cursor: pointer;
        }
        .item-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
          transform: translateX(2px);
        }

        .item-thumbnail {
          width: 3rem;
          height: 3rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .item-name {
          font-weight: 600;
          color: white;
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
          line-height: 1.25;
        }

        .item-category {
          font-size: 0.875rem;
          color: #9CA3AF;
          margin: 0;
          text-transform: capitalize;
        }

        .item-quantity {
          font-size: 1rem;
          font-weight: 600;
          color: white;
        }

        .item-status {
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .item-container {
          font-size: 0.75rem;
          color: #6B7280;
          margin: 0.5rem 0 0 0;
        }
      `}</style>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { EntityTile } from '@/components/ui/EntityTile';
import { EntityTileGrid } from '@/components/ui/EntityTileGrid';
import {
  Plus,
  Search,
  Package,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  AlertTriangle,
  Filter
} from 'lucide-react';

interface Material {
  id: string;
  name: string;
  category?: string;
  item_type?: string;
  manufacturer?: string;
  model?: string;
  quantity_in_stock?: number;
  reorder_point?: number;
  storage_location?: string;
  unit_cost?: number;
  image_url?: string;
  created_at: string;
}

export default function SupervisorMaterialsPage() {
  const router = useRouter();

  // State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Load materials when category changes
  useEffect(() => {
    loadMaterials();
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/items/categories?item_type=material');
      const data = await response.json();
      if (response.ok) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        item_type: 'material',
        limit: '50'
      });

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/items?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to load materials');

      setMaterials(data.items || []);
      setPagination(data.pagination || { total: 0, hasMore: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const timer = setTimeout(() => {
      loadMaterials();
    }, 500);
    return () => clearTimeout(timer);
  };

  const filteredMaterials = materials;

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading materials...</p>
          </div>
        </div>
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
        `}</style>
      </div>
    );
  }

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
          <h1 className="text-xl font-semibold">Materials</h1>
          <p className="text-xs text-gray-500">
            {pagination.total} item{pagination.total !== 1 ? 's' : ''}
            {selectedCategory && ` • ${selectedCategory}`}
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="notification-bar success">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Search & Filters */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search materials by name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {categories.length > 0 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Materials Grid */}
        <div className="px-4 pb-4">
          <EntityTileGrid
            emptyState={{
              icon: <Package className="w-12 h-12" />,
              message: searchQuery ? 'No materials match your search' : 'No materials found'
            }}
          >
            {filteredMaterials.map((material) => {
              // Build subtitle
              const subtitle = material.storage_location || 'No location';

              // Build tags
              const tags = [];

              if (material.category) {
                tags.push({ label: material.category, color: 'gold' as const });
              }

              if (material.quantity_in_stock !== undefined) {
                const isLow = material.reorder_point && material.quantity_in_stock <= material.reorder_point;
                const stockColor = isLow ? 'orange' as const : material.quantity_in_stock > 0 ? 'green' as const : 'red' as const;
                const icon = isLow || material.quantity_in_stock === 0 ? <AlertTriangle className="w-3 h-3" /> : undefined;

                tags.push({
                  label: `${material.quantity_in_stock} in stock`,
                  color: stockColor,
                  icon
                });
              }

              return (
                <EntityTile
                  key={material.id}
                  image={material.image_url}
                  fallbackIcon={<Package />}
                  title={material.name}
                  subtitle={subtitle}
                  tags={tags}
                  onClick={() => router.push(`/supervisor/materials/${material.id}`)}
                />
              );
            })}
          </EntityTileGrid>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push('/supervisor')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <button
          type="button"
          onClick={() => router.push('/supervisor/materials/create')}
          className="btn-primary flex-1"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Material
        </button>
      </div>

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
          color: #fca5a5;
        }

        .notification-bar.success {
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          color: #FFD700;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .input-field::placeholder {
          color: #6b7280;
        }

        .bottom-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.9);
          border-top: 1px solid #333;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }
      `}</style>
    </div>
  );
}

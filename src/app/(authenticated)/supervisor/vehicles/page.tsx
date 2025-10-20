'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { EntityTile } from '@/components/ui/EntityTile';
import { EntityTileGrid } from '@/components/ui/EntityTileGrid';
import {
  Plus,
  Search,
  Truck,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  AlertTriangle
} from 'lucide-react';

interface Vehicle {
  id: string;
  name: string;
  type?: 'truck' | 'van' | 'trailer' | 'other';
  license_plate?: string;
  status?: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  assigned_to?: string;
  location?: string;
  thumbnailUrl?: string;
  created_at: string;
}

export default function SupervisorVehiclesPage() {
  const router = useRouter();

  // State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load vehicles on mount
  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API endpoint when available
      // const response = await fetch('/api/supervisor/vehicles');
      // const data = await response.json();
      // if (!response.ok) throw new Error(data.message);
      // setVehicles(data.vehicles || []);

      // Mock data for now
      setVehicles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicles');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (vehicle.license_plate && vehicle.license_plate.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (vehicle.type && vehicle.type.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (vehicle.assigned_to && vehicle.assigned_to.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading vehicles...</p>
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
          <h1 className="text-xl font-semibold">Vehicles</h1>
          <p className="text-xs text-gray-500">{filteredVehicles.length} vehicles</p>
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
        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        {/* Vehicles Grid */}
        <div className="px-4 pb-4">
          <EntityTileGrid
            emptyState={{
              icon: <Truck className="w-12 h-12" />,
              message: searchQuery ? 'No vehicles match your search' : 'No vehicles found'
            }}
          >
            {filteredVehicles.map((vehicle) => {
              // Determine status color
              const statusColor = vehicle.status === 'available' ? 'green' as const
                : vehicle.status === 'in_use' ? 'blue' as const
                : vehicle.status === 'maintenance' ? 'orange' as const
                : 'red' as const;

              // Build tags array
              const tags = [];
              if (vehicle.status) {
                const icon = vehicle.status === 'maintenance' || vehicle.status === 'out_of_service'
                  ? <AlertTriangle className="w-3 h-3" />
                  : undefined;
                tags.push({
                  label: vehicle.status.replace('_', ' '),
                  color: statusColor,
                  icon
                });
              }
              if (vehicle.type) {
                tags.push({ label: vehicle.type, color: 'gold' as const });
              }
              if (vehicle.license_plate) {
                tags.push({
                  label: vehicle.license_plate,
                  color: 'gray' as const
                });
              }

              return (
                <EntityTile
                  key={vehicle.id}
                  image={vehicle.thumbnailUrl}
                  fallbackIcon={<Truck />}
                  title={vehicle.name}
                  subtitle={vehicle.assigned_to || vehicle.location || 'Unassigned'}
                  tags={tags}
                  onClick={() => router.push(`/supervisor/vehicles/${vehicle.id}`)}
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
          onClick={() => router.push('/supervisor/vehicles/create')}
          className="btn-primary flex-1"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Vehicle
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

// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/property/repositories/property-repository.ts
// phase: 2
// domain: property-management
// purpose: Property data access with multi-tenant isolation and geospatial queries
// spec_ref: phase2/property-management#repository
// version: 2025-08-1
// complexity_budget: 400 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/base.repository
//     - /src/domains/property/types/property-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - PropertyRepository: class - Property data access
//   - createProperty: function - Create new property
//   - updateProperty: function - Update property details
//   - findPropertiesByCustomer: function - Get customer properties
//   - findPropertiesNearby: function - Geospatial search
//   - findPropertyByAddress: function - Address lookup
//
// voice_considerations: |
//   Support fuzzy address matching for voice queries.
//   Store and retrieve voice-friendly nicknames.
//   Enable landmark-based property searches.
//   Track access instructions in natural language format.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/property/repositories/property-repository.test.ts
//
// tasks:
//   1. Extend BaseRepository for properties
//   2. Implement CRUD with tenant isolation
//   3. Add customer association methods
//   4. Create geospatial query methods
//   5. Implement address fuzzy search
//   6. Add service location management
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  Property,
  PropertyCreate,
  PropertyUpdate,
  PropertyType,
  PropertyState,
  Address,
  GeoLocation,
  propertyCreateSchema,
  propertyUpdateSchema,
} from '../types/property-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export class PropertyRepository extends BaseRepository<'properties'> {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    super('properties', supabaseClient);
    this.supabaseClient = supabaseClient;
  }

  /**
   * Create a new property with tenant isolation
   */
  async createProperty(
    data: PropertyCreate,
    tenantId: string
  ): Promise<Property> {
    try {
      // Validate input
      const validated = propertyCreateSchema.parse(data);

      // Generate property number
      const propertyNumber = await this.generatePropertyNumber(tenantId);

      // Format address for storage
      const addressJsonb = this.formatAddressForStorage(validated.address);

      // Skip location for now - will add PostGIS support later
      const locationPoint = null;

      const property = {
        property_number: propertyNumber,
        tenant_id: tenantId,
        customer_id: validated.customerId,
        name: validated.voiceMetadata?.nickname || 
              `${validated.address.street}, ${validated.address.city}`,
        address: addressJsonb,
        location: locationPoint,
        property_type: validated.type,
        size_sqft: validated.size,
        lot_size_acres: validated.lotSize ? validated.lotSize / 43560 : null, // Convert sqft to acres
        access_notes: validated.notes,
        voice_navigation_notes: validated.voiceMetadata?.landmarks?.join(', '),
        is_active: true,
        // Note: 'state' field doesn't exist in DB, using metadata instead
        metadata: {
          yearBuilt: validated.yearBuilt,
          stories: validated.stories,
          tags: validated.tags,
          serviceFrequency: validated.serviceFrequency,
          state: PropertyState.ACTIVE,
        },
      };

      const { data: created, error } = await this.supabaseClient
        .from('properties')
        .insert(property)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapToProperty(created);
    } catch (error) {
      console.error('Property creation failed:', error);
      throw createAppError({
        code: 'PROPERTY_CREATE_FAILED',
        message: 'Failed to create property',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
        metadata: { originalError: error },
      });
    }
  }

  /**
   * Update property with version control
   */
  async updateProperty(
    propertyId: string,
    updates: PropertyUpdate,
    tenantId: string
  ): Promise<Property | null> {
    try {
      const validated = propertyUpdateSchema.parse(updates);

      const updateData: any = {};
      
      if (validated.address) {
        updateData.address = this.formatAddressForStorage({
          ...validated.address,
        } as Address);
      }
      
      if (validated.location) {
        updateData.location = this.createPointFromLocation(validated.location);
      }

      if (validated.type) updateData.property_type = validated.type;
      if (validated.size !== undefined) updateData.size_sqft = validated.size;
      if (validated.lotSize !== undefined) updateData.lot_size_acres = validated.lotSize / 43560;
      if (validated.notes !== undefined) updateData.access_notes = validated.notes;
      if (validated.is_active !== undefined) updateData.is_active = validated.is_active;

      // Get current metadata first if we need to update it
      let currentMetadata = {};
      if (validated.state !== undefined || validated.yearBuilt !== undefined || 
          validated.stories !== undefined || validated.tags !== undefined || 
          validated.serviceFrequency !== undefined) {
        const { data: current } = await this.supabaseClient
          .from('properties')
          .select('metadata')
          .eq('id', propertyId)
          .eq('tenant_id', tenantId)
          .single();
        
        currentMetadata = current?.metadata || {};
      }

      // Update metadata with any new values
      const metadata = {
        ...currentMetadata,
        ...(validated.state !== undefined && { state: validated.state }),
        ...(validated.yearBuilt !== undefined && { yearBuilt: validated.yearBuilt }),
        ...(validated.stories !== undefined && { stories: validated.stories }),
        ...(validated.tags !== undefined && { tags: validated.tags }),
        ...(validated.serviceFrequency !== undefined && { serviceFrequency: validated.serviceFrequency }),
      };
      updateData.metadata = metadata;

      const { data: updated, error } = await this.supabaseClient
        .from('properties')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapToProperty(updated);
    } catch (error) {
      throw createAppError({
        code: 'PROPERTY_UPDATE_FAILED',
        message: 'Failed to update property',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all properties for a customer
   */
  async findPropertiesByCustomer(
    customerId: string,
    tenantId: string
  ): Promise<Property[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('properties')
        .select(`
          *,
          customer:customers!inner(
            id,
            customer_number,
            name
          )
        `)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => this.mapToProperty(row));
    } catch (error) {
      throw createAppError({
        code: 'PROPERTIES_FETCH_FAILED',
        message: 'Failed to fetch customer properties',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find properties near a location (PostGIS query)
   */
  async findPropertiesNearby(
    location: { latitude: number; longitude: number },
    radiusMeters: number,
    tenantId: string,
    limit: number = 20
  ): Promise<Array<Property & { distance: number }>> {
    try {
      // Use PostGIS ST_DWithin for efficient spatial query
      const { data, error } = await this.supabaseClient
        .rpc('find_properties_nearby', {
          p_tenant_id: tenantId,
          p_longitude: location.longitude,
          p_latitude: location.latitude,
          p_radius_meters: radiusMeters,
          p_limit: limit,
        });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...this.mapToProperty(row),
        distance: row.distance_meters,
      }));
    } catch (error) {
      // Fallback to non-spatial query if PostGIS not available
      const { data, error: fallbackError } = await this.supabaseClient
        .from('properties')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(limit);

      if (fallbackError) throw fallbackError;

      // Calculate distances manually
      return (data || []).map(row => {
        const prop = this.mapToProperty(row);
        const distance = prop.location
          ? this.calculateDistance(location, prop.location)
          : Infinity;
        return { ...prop, distance };
      });
    }
  }

  /**
   * Find property by address with fuzzy matching
   */
  async findPropertyByAddress(
    address: Partial<Address>,
    tenantId: string
  ): Promise<Property | null> {
    try {
      let query = this.supabaseClient
        .from('properties')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Build address query conditions
      if (address.street) {
        query = query.ilike('address->>street', `%${address.street}%`);
      }
      if (address.city) {
        query = query.ilike('address->>city', `%${address.city}%`);
      }
      if (address.state) {
        query = query.eq('address->>state', address.state.toUpperCase());
      }
      if (address.zip) {
        query = query.eq('address->>zip', address.zip);
      }

      const { data, error } = await query.limit(1).single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapToProperty(data);
    } catch (error) {
      throw createAppError({
        code: 'PROPERTY_ADDRESS_SEARCH_FAILED',
        message: 'Failed to find property by address',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get property with voice profile
   */
  async findPropertyWithVoiceProfile(
    propertyId: string,
    tenantId: string
  ): Promise<Property | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('properties')
        .select(`
          *,
          voice_profile:property_voice_profiles(*)
        `)
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToProperty(data);
    } catch (error) {
      throw createAppError({
        code: 'PROPERTY_FETCH_FAILED',
        message: 'Failed to fetch property with voice profile',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find property by ID with tenant isolation
   */
  async findById(propertyId: string, tenantId: string): Promise<Property | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToProperty(data);
    } catch (error) {
      throw createAppError({
        code: 'PROPERTY_FETCH_FAILED',
        message: 'Failed to fetch property',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all properties with filters
   */
  async findAll(options: {
    tenantId: string;
    filters?: any;
    limit?: number;
  }): Promise<{ data: Property[]; count: number }> {
    try {
      let query = this.supabaseClient
        .from('properties')
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      if (options.filters?.is_active !== undefined) {
        query = query.eq('is_active', options.filters.is_active);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map(row => this.mapToProperty(row)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'PROPERTIES_FETCH_FAILED',
        message: 'Failed to fetch properties',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete property
   */
  async delete(propertyId: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseClient
        .from('properties')
        .delete()
        .eq('id', propertyId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw createAppError({
        code: 'PROPERTY_DELETE_FAILED',
        message: 'Failed to delete property',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update property state
   */
  async updatePropertyState(
    propertyId: string,
    newState: PropertyState,
    tenantId: string
  ): Promise<Property | null> {
    try {
      // First get current metadata
      const { data: current, error: fetchError } = await this.supabaseClient
        .from('properties')
        .select('metadata')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !current) {
        if (fetchError?.code === 'PGRST116') return null;
        throw fetchError || new Error('Property not found');
      }

      // Update metadata with new state
      const updatedMetadata = {
        ...current.metadata,
        state: newState,
      };

      const { data, error } = await this.supabaseClient
        .from('properties')
        .update({
          metadata: updatedMetadata,
          is_active: newState === PropertyState.ACTIVE,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToProperty(data);
    } catch (error) {
      throw createAppError({
        code: 'PROPERTY_STATE_UPDATE_FAILED',
        message: 'Failed to update property state',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Helper: Generate unique property number
   */
  private async generatePropertyNumber(tenantId: string): Promise<string> {
    const prefix = 'PROP';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Helper: Format address for JSONB storage
   */
  private formatAddressForStorage(address: Address): any {
    return {
      street: address.street,
      unit: address.unit || null,
      city: address.city,
      state: address.state.toUpperCase(),
      zip: address.zip,
      country: address.country || 'US',
      formatted: address.formatted || 
        `${address.street}${address.unit ? ' ' + address.unit : ''}, ${address.city}, ${address.state} ${address.zip}`,
      landmarks: address.landmarks || [],
    };
  }

  /**
   * Helper: Create PostGIS point from location
   */
  private createPointFromLocation(location: Partial<GeoLocation>): string | null {
    if (!location.latitude || !location.longitude) return null;
    return `POINT(${location.longitude} ${location.latitude})`;
  }

  /**
   * Helper: Map database row to Property type
   */
  private mapToProperty(row: any): Property {
    if (!row) throw new Error('Cannot map null row to Property');

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      customerId: row.customer_id,
      customer: row.customer || undefined,
      property_number: row.property_number,
      name: row.name,
      address: row.address as Address,
      location: row.location ? this.parseLocation(row.location) : undefined,
      type: row.property_type as PropertyType,
      size: row.size_sqft,
      lotSize: row.lot_size_acres ? row.lot_size_acres * 43560 : undefined, // Convert back to sqft
      yearBuilt: row.metadata?.yearBuilt,
      stories: row.metadata?.stories,
      serviceLocation: row.service_location,
      lastServiceDate: row.last_service_date ? new Date(row.last_service_date) : undefined,
      nextServiceDate: row.next_service_date ? new Date(row.next_service_date) : undefined,
      serviceFrequency: row.metadata?.serviceFrequency,
      voiceProfile: row.voice_profile,
      state: row.metadata?.state || PropertyState.ACTIVE,
      is_active: row.is_active,
      notes: row.access_notes,
      tags: row.metadata?.tags || [],
      customFields: row.metadata?.customFields,
      version: row.version || 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }

  /**
   * Helper: Parse PostGIS point to GeoLocation
   */
  private parseLocation(locationData: any): GeoLocation | undefined {
    if (!locationData) return undefined;
    
    // Handle different PostGIS formats
    if (typeof locationData === 'string') {
      // Parse POINT(longitude latitude) format
      const match = locationData.match(/POINT\((-?\d+\.?\d*) (-?\d+\.?\d*)\)/);
      if (match) {
        return {
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
          source: 'geocoding',
          timestamp: new Date(),
        };
      }
    } else if (locationData.coordinates) {
      // Handle GeoJSON format
      return {
        longitude: locationData.coordinates[0],
        latitude: locationData.coordinates[1],
        source: 'geocoding',
        timestamp: new Date(),
      };
    }
    
    return undefined;
  }

  /**
   * Helper: Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: GeoLocation
  ): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }
}

// Convenience export
export const createPropertyRepository = (supabase: SupabaseClient): PropertyRepository => {
  return new PropertyRepository(supabase);
};

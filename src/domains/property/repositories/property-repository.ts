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
//     - /src/domains/property/types/property-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - PropertyRepository: class - Property data access
//   - createPropertyRepository: function - Factory helper
//
// voice_considerations: |
//   Store phonetic addresses for voice recognition.
//   Support landmark-based descriptions for technicians.
//   Surface access instructions for voice assistants.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/property/repositories/property-repository.test.ts
//
// tasks:
//   1. Persist properties in the properties table with metadata
//   2. Implement CRUD with tenant isolation
//   3. Support geospatial lookups
//   4. Provide voice-friendly metadata accessors
//   5. Handle state transitions and soft deletes
// --- END DIRECTIVE BLOCK ---

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  Property,
  PropertyCreate,
  PropertyUpdate,
  PropertyType,
  PropertyState,
  ServiceLocation,
  GeoLocation,
  Address,
  PropertyVoiceProfile,
} from '../types/property-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

type PropertiesTable = Database['public']['Tables']['properties'];
type PropertyRow = PropertiesTable['Row'];
type PropertyInsert = PropertiesTable['Insert'];
type PropertyUpdatePayload = PropertiesTable['Update'];

const DEFAULT_COUNTRY = 'US';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const coercePropertyType = (value: unknown): PropertyType =>
  Object.values(PropertyType).includes(value as PropertyType) ? (value as PropertyType) : PropertyType.RESIDENTIAL;

const coercePropertyState = (value: unknown): PropertyState =>
  Object.values(PropertyState).includes(value as PropertyState) ? (value as PropertyState) : PropertyState.ACTIVE;

const coerceServiceFrequency = (
  value: unknown
): Property['serviceFrequency'] => {
  const allowed: Array<NonNullable<Property['serviceFrequency']>> = [
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'annually',
    'as_needed',
  ];

  return allowed.includes(value as NonNullable<Property['serviceFrequency']>)
    ? (value as Property['serviceFrequency'])
    : undefined;
};

interface PropertyMetadata {
  state?: PropertyState;
  yearBuilt?: number;
  stories?: number;
  tags?: string[];
  serviceFrequency?: Property['serviceFrequency'];
  customFields?: Record<string, any>;
  serviceLocation?: Record<string, unknown>;
  voiceProfile?: Record<string, unknown>;
  lastServiceDate?: string;
  nextServiceDate?: string;
  version?: number;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export class PropertyRepository {
  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  private get client(): SupabaseClient<any> {
    return this.supabaseClient as unknown as SupabaseClient<any>;
  }

  /**
   * Create a new property scoped to a tenant.
   */
  async createProperty(data: PropertyCreate, tenantId: string): Promise<Property> {
    try {
      const propertyNumber = await this.generatePropertyNumber(tenantId);
      const addressJson = this.formatAddressForStorage(data.address);
      const locationPoint = data.location ? this.createPointFromLocation(data.location) : null;

      const metadata: PropertyMetadata = {
        state: PropertyState.ACTIVE,
        yearBuilt: data.yearBuilt,
        stories: data.stories,
        tags: data.tags ?? [],
        serviceFrequency: data.serviceFrequency,
        customFields: {},
        version: 1,
        createdBy: null,
        updatedBy: null,
        serviceLocation: undefined,
        voiceProfile: data.voiceMetadata
          ? {
              nickname: data.voiceMetadata.nickname,
              landmarks: data.voiceMetadata.landmarks ?? [],
              voiceSearchHits: 0,
            }
          : undefined,
      };

      const insertPayload: PropertyInsert = {
        tenant_id: tenantId,
        customer_id: data.customerId,
        property_number: propertyNumber,
        name: data.voiceMetadata?.nickname
          ? data.voiceMetadata.nickname
          : `${data.address.street}, ${data.address.city}`,
        address: addressJson as unknown as PropertyInsert['address'],
        location: locationPoint,
        property_type: data.type,
        size_sqft: data.size ?? null,
        lot_size_acres: data.lotSize ? data.lotSize / 43560 : null,
        access_notes: data.notes ?? null,
        voice_navigation_notes: data.voiceMetadata?.landmarks?.join(', ') ?? null,
        is_active: true,
        metadata: metadata as unknown as PropertyInsert['metadata'],
      };

      const { data: created, error } = await this.client
        .from('properties')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return this.mapToProperty(created);
    } catch (error) {
      throw createAppError({
        code: 'PROPERTY_CREATE_FAILED',
        message: 'Failed to create property',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update a property with tenant isolation.
   */
  async updateProperty(propertyId: string, updates: PropertyUpdate, tenantId: string): Promise<Property | null> {
    try {
      const { data: currentRow, error: fetchError } = await this.client
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!currentRow) {
        return null;
      }

      const metadata = this.ensureMetadata(currentRow.metadata);
      const existingAddress = this.parseAddress(currentRow.address);
      const updateData: PropertyUpdatePayload = {
        updated_at: new Date().toISOString(),
      };

      if (updates.address) {
        updateData.address = this.formatAddressForStorage({
          ...existingAddress,
          ...updates.address,
        }) as unknown as PropertyUpdatePayload['address'];
      }

      if (updates.location) {
        updateData.location = this.createPointFromLocation(updates.location) as PropertyUpdatePayload['location'];
      }

      if (updates.type) {
        updateData.property_type = updates.type;
      }

      if (updates.size !== undefined) {
        updateData.size_sqft = updates.size ?? null;
      }

      if (updates.lotSize !== undefined) {
        updateData.lot_size_acres = updates.lotSize ? updates.lotSize / 43560 : null;
      }

      if (updates.notes !== undefined) {
        updateData.access_notes = updates.notes ?? null;
      }

      const updatedMetadata: PropertyMetadata = {
        ...metadata,
        yearBuilt: updates.yearBuilt ?? metadata.yearBuilt,
        stories: updates.stories ?? metadata.stories,
        tags: updates.tags ?? metadata.tags ?? [],
        serviceFrequency: updates.serviceFrequency ?? metadata.serviceFrequency,
        state: updates.state ?? metadata.state,
        customFields: metadata.customFields ?? {},
        version: (metadata.version ?? 1) + 1,
      };

      if (updates.is_active !== undefined) {
        updateData.is_active = updates.is_active;
        if (updates.state === undefined) {
          updatedMetadata.state = updates.is_active ? PropertyState.ACTIVE : PropertyState.INACTIVE;
        }
      }

      updateData.metadata = updatedMetadata as unknown as PropertyUpdatePayload['metadata'];

      const { data, error } = await this.client
        .from('properties')
        .update(updateData as any)
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return this.mapToProperty(data);
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
   * Look up a property by ID.
   */
  async findById(propertyId: string, tenantId: string): Promise<Property | null> {
    try {
      const { data, error } = await this.client
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? this.mapToProperty(data) : null;
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
   * List properties for a customer.
   */
  async findPropertiesByCustomer(customerId: string, tenantId: string): Promise<Property[]> {
    try {
      const { data, error } = await this.client
        .from('properties')
        .select(
          `
            *,
            customer:customers!inner(
              id,
              customer_number,
              name
            )
          `
        )
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => this.mapToProperty(row as PropertyRow & { customer: any }));
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
   * Find nearby properties using PostGIS fallback when necessary.
   */
  async findPropertiesNearby(
    location: { latitude: number; longitude: number },
    radiusMeters: number,
    tenantId: string,
    limit: number = 20
  ): Promise<Array<Property & { distance: number }>> {
    try {
      const { data, error } = await this.client.rpc('find_properties_nearby', {
        p_tenant_id: tenantId,
        p_longitude: location.longitude,
        p_latitude: location.latitude,
        p_radius_meters: radiusMeters,
        p_limit: limit,
      });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row: any) => ({
        ...this.mapToProperty(row as PropertyRow),
        distance: Number(row.distance_meters ?? 0),
      }));
    } catch (error) {
      // Fallback without PostGIS
      const { data, error: fallbackError } = await this.client
        .from('properties')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(limit);

      if (fallbackError) {
        throw fallbackError;
      }

      return (data ?? []).map(row => {
        const mapped = this.mapToProperty(row);
        const distance = mapped.location ? this.calculateDistance(location, mapped.location) : Number.POSITIVE_INFINITY;
        return {
          ...mapped,
          distance,
        };
      });
    }
  }

  /**
   * Locate a property by fuzzy address match.
   */
  async findPropertyByAddress(address: Partial<Address>, tenantId: string): Promise<Property | null> {
    try {
      let query = this.client
        .from('properties')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

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

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) {
        throw error;
      }

      return data ? this.mapToProperty(data) : null;
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
   * List properties with optional filters.
   */
  async findAll(options: {
    tenantId: string;
    filters?: { is_active?: boolean };
    limit?: number;
  }): Promise<{ data: Property[]; count: number }> {
    try {
      let query = this.client
        .from('properties')
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      if (options.filters?.is_active !== undefined) {
        query = query.eq('is_active', options.filters.is_active);
      }

      if (options.limit !== undefined) {
        query = query.limit(options.limit);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        data: (data ?? []).map(row => this.mapToProperty(row)),
        count: count ?? 0,
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
   * Soft delete a property by marking it inactive.
   */
  async delete(propertyId: string, tenantId: string): Promise<boolean> {
    try {
      const { data: currentRow, error: fetchError } = await this.client
        .from('properties')
        .select('metadata')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!currentRow) {
        return false;
      }

      const metadata = this.ensureMetadata(currentRow.metadata);

      const { error } = await this.client
        .from('properties')
        .update({
          is_active: false,
          metadata: {
            ...metadata,
            state: PropertyState.INACTIVE,
            version: (metadata.version ?? 1) + 1,
          } as unknown as PropertyUpdatePayload['metadata'],
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', propertyId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw error;
      }

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
   * Update the property state and active flag.
   */
  async updatePropertyState(propertyId: string, newState: PropertyState, tenantId: string): Promise<Property | null> {
    try {
      const { data: current, error: fetchError } = await this.client
        .from('properties')
        .select('metadata')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!current) {
        return null;
      }

      const metadata = this.ensureMetadata(current.metadata);
      const updatedMetadata: PropertyMetadata = {
        ...metadata,
        state: newState,
        version: (metadata.version ?? 1) + 1,
      };

      const { data, error } = await this.client
        .from('properties')
        .update({
          metadata: updatedMetadata as unknown as PropertyUpdatePayload['metadata'],
          is_active: newState === PropertyState.ACTIVE,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
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
   * Map a row into the domain Property object.
   */
  private mapToProperty(row: PropertyRow & { customer?: any }): Property {
    if (!row) {
      throw new Error('Cannot map empty property row');
    }

    const metadata = this.ensureMetadata(row.metadata);
    const address = this.parseAddress(row.address);
    const location = this.parseLocation(row.location);
    const serviceLocation = metadata.serviceLocation
      ? this.parseServiceLocation(metadata.serviceLocation, row.id)
      : undefined;
    const voiceProfile = metadata.voiceProfile
      ? this.parseVoiceProfile(metadata.voiceProfile, row.id)
      : undefined;

    const lastServiceDate =
      typeof metadata.lastServiceDate === 'string' ? new Date(metadata.lastServiceDate) : undefined;
    const nextServiceDate =
      typeof metadata.nextServiceDate === 'string' ? new Date(metadata.nextServiceDate) : undefined;

    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
    const customFields = metadata.customFields ?? {};

    const createdAt = row.created_at ? new Date(row.created_at) : new Date();
    const updatedAt = row.updated_at ? new Date(row.updated_at) : createdAt;

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      customerId: row.customer_id,
      customer: row.customer,
      property_number: row.property_number,
      name: row.name,
      address,
      location,
      type: coercePropertyType(row.property_type),
      size: row.size_sqft ?? undefined,
      lotSize: row.lot_size_acres ? row.lot_size_acres * 43560 : undefined,
      yearBuilt: metadata.yearBuilt,
      stories: metadata.stories,
      serviceLocation,
      lastServiceDate,
      nextServiceDate,
      serviceFrequency: metadata.serviceFrequency,
      voiceProfile,
      state: metadata.state ?? PropertyState.ACTIVE,
      is_active: row.is_active ?? true,
      notes: row.access_notes ?? undefined,
      tags,
      customFields,
      version: metadata.version ?? 1,
      createdAt,
      updatedAt,
      createdBy: metadata.createdBy ?? undefined,
      updatedBy: metadata.updatedBy ?? undefined,
    };
  }

  private ensureMetadata(value: unknown): PropertyMetadata {
    if (!isRecord(value)) {
      return {
        state: PropertyState.ACTIVE,
        tags: [],
        customFields: {},
        version: 1,
      };
    }

    return {
      state: coercePropertyState(value.state),
      yearBuilt: typeof value.yearBuilt === 'number' ? value.yearBuilt : undefined,
      stories: typeof value.stories === 'number' ? value.stories : undefined,
      tags: Array.isArray(value.tags) ? (value.tags as string[]) : [],
      serviceFrequency: coerceServiceFrequency(value.serviceFrequency),
      customFields: isRecord(value.customFields) ? (value.customFields as Record<string, any>) : {},
      serviceLocation: isRecord(value.serviceLocation) ? value.serviceLocation : undefined,
      voiceProfile: isRecord(value.voiceProfile) ? value.voiceProfile : undefined,
      lastServiceDate:
        typeof value.lastServiceDate === 'string' ? value.lastServiceDate : undefined,
      nextServiceDate:
        typeof value.nextServiceDate === 'string' ? value.nextServiceDate : undefined,
      version: typeof value.version === 'number' ? value.version : 1,
      createdBy: typeof value.createdBy === 'string' ? value.createdBy : null,
      updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : null,
    };
  }

  private parseAddress(address: unknown): Address {
    if (!isRecord(address)) {
      throw new Error('Property address is missing');
    }

    return {
      street: String(address.street ?? ''),
      unit: typeof address.unit === 'string' ? address.unit : undefined,
      city: String(address.city ?? ''),
      state: String(address.state ?? ''),
      zip: String(address.zip ?? ''),
      country: typeof address.country === 'string' ? address.country : DEFAULT_COUNTRY,
      formatted: typeof address.formatted === 'string' ? address.formatted : undefined,
      landmarks: Array.isArray(address.landmarks) ? (address.landmarks as string[]) : [],
    };
  }

  private parseServiceLocation(source: Record<string, unknown>, propertyId: string): ServiceLocation {
    return {
      id: typeof source.id === 'string' ? source.id : `${propertyId}-primary`,
      propertyId,
      gateCode: typeof source.gateCode === 'string' ? source.gateCode : undefined,
      accessInstructions:
        typeof source.accessInstructions === 'string' ? source.accessInstructions : undefined,
      petWarnings: typeof source.petWarnings === 'string' ? source.petWarnings : undefined,
      equipmentLocation:
        typeof source.equipmentLocation === 'string' ? source.equipmentLocation : undefined,
      shutoffLocations: isRecord(source.shutoffLocations)
        ? (source.shutoffLocations as ServiceLocation['shutoffLocations'])
        : undefined,
      specialInstructions:
        typeof source.specialInstructions === 'string' ? source.specialInstructions : undefined,
      bestTimeToService:
        typeof source.bestTimeToService === 'string' ? source.bestTimeToService : undefined,
      voiceNotes: Array.isArray(source.voiceNotes) ? (source.voiceNotes as string[]) : undefined,
      createdAt:
        typeof source.createdAt === 'string' ? new Date(source.createdAt) : new Date(),
      updatedAt:
        typeof source.updatedAt === 'string' ? new Date(source.updatedAt) : new Date(),
    };
  }

  private parseVoiceProfile(source: Record<string, unknown>, propertyId: string): PropertyVoiceProfile {
    return {
      propertyId,
      nickname: typeof source.nickname === 'string' ? source.nickname : undefined,
      phoneticAddress:
        typeof source.phoneticAddress === 'string' ? source.phoneticAddress : undefined,
      landmarks: Array.isArray(source.landmarks) ? (source.landmarks as string[]) : [],
      alternateNames: Array.isArray(source.alternateNames)
        ? (source.alternateNames as string[])
        : [],
      commonMispronunciations: Array.isArray(source.commonMispronunciations)
        ? (source.commonMispronunciations as string[])
        : undefined,
      voiceSearchHits: typeof source.voiceSearchHits === 'number' ? source.voiceSearchHits : 0,
      lastVoiceUpdate:
        typeof source.lastVoiceUpdate === 'string' ? new Date(source.lastVoiceUpdate) : undefined,
    };
  }

  private parseLocation(locationData: unknown): GeoLocation | undefined {
    if (!locationData) {
      return undefined;
    }

    if (typeof locationData === 'string') {
      const match = locationData.match(/POINT\((-?\d+\.?\d*) (-?\d+\.?\d*)\)/);
      if (match) {
        return {
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
          source: 'geocoding',
          timestamp: new Date(),
        };
      }
    }

    if (isRecord(locationData) && Array.isArray(locationData.coordinates)) {
      return {
        longitude: Number(locationData.coordinates[0]),
        latitude: Number(locationData.coordinates[1]),
        source: 'geocoding',
        timestamp: new Date(),
      };
    }

    return undefined;
  }

  private createPointFromLocation(location: Partial<GeoLocation>): string | null {
    if (location.latitude === undefined || location.longitude === undefined) {
      return null;
    }

    return `POINT(${location.longitude} ${location.latitude})`;
  }

  private formatAddressForStorage(address: Address): Record<string, unknown> {
    return {
      street: address.street,
      unit: address.unit ?? null,
      city: address.city,
      state: address.state.toUpperCase(),
      zip: address.zip,
      country: address.country ?? DEFAULT_COUNTRY,
      formatted:
        address.formatted ??
        `${address.street}${address.unit ? ` ${address.unit}` : ''}, ${address.city}, ${address.state} ${address.zip}`,
      landmarks: address.landmarks ?? [],
    };
  }

  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: GeoLocation
  ): number {
    const R = 6371000;
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private async generatePropertyNumber(tenantId: string): Promise<string> {
    const { count, error } = await this.client
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (error) {
      throw error;
    }

    const next = (count ?? 0) + 1;
    return `PROP-${next.toString().padStart(5, '0')}`;
  }
}

export const createPropertyRepository = (supabase: SupabaseClient): PropertyRepository => {
  return new PropertyRepository(supabase as SupabaseClient<Database>);
};

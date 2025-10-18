// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/property/services/property-search-service.ts
// phase: 2
// domain: property-management
// purpose: Voice-optimized property search with geocoding and fuzzy matching
// spec_ref: phase2/property-management#search
// version: 2025-08-1
// complexity_budget: 400 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/property/repositories/property-repository
//     - /src/domains/property/types/property-types
//     - /src/core/logger/voice-logger
//   external:
//     - @supabase/supabase-js: ^2.43.0
//     - fuse.js: ^7.0.0
//
// exports:
//   - PropertySearchService: class - Property search engine
//   - findByVoice: function - Natural language property search
//   - searchByAddress: function - Fuzzy address matching
//   - searchNearby: function - Proximity-based search
//   - searchByLandmark: function - Landmark reference search
//   - geocodeAddress: function - Address to coordinates
//   - reverseGeocode: function - Coordinates to address
//
// voice_considerations: |
//   Parse natural language addresses ("the Smith house on Oak Street").
//   Support landmark references ("near the water tower").
//   Handle partial addresses with fuzzy matching.
//   Provide voice-friendly search result summaries.
//   Enable phonetic address matching.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/property/services/property-search-service.test.ts
//
// tasks:
//   1. Implement fuzzy address search
//   2. Add geocoding integration
//   3. Create landmark reference parsing
//   4. Build proximity search
//   5. Add voice result ranking
//   6. Implement offline search cache
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import { PropertyRepository } from '../repositories/property-repository';
import {
  Property,
  Address,
  GeoLocation,
  PropertySearchResult,
  PropertyVoiceCommand,
  PropertyType,
} from '../types/property-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { VoiceLogger } from '@/core/logger/voice-logger';

/**
 * Geocoding result
 */
interface GeocodingResult {
  address: Address;
  location?: GeoLocation;
  confidence: number;
  source: 'google' | 'mapbox' | 'cache' | 'manual';
}

/**
 * Search configuration
 */
interface SearchConfig {
  fuzzyThreshold?: number;
  maxResults?: number;
  includeInactive?: boolean;
  voiceOptimized?: boolean;
}

/**
 * Offline search cache entry
 */
interface CachedSearch {
  query: string;
  results: PropertySearchResult[];
  timestamp: Date;
  ttl: number;
}

/**
 * Property search service
 */
export class PropertySearchService {
  private repository: PropertyRepository;
  private logger: VoiceLogger;
  private searchCache: Map<string, CachedSearch> = new Map();
  private geocodeCache: Map<string, GeocodingResult> = new Map();
  
  // Fuse.js configuration for fuzzy search
  private fuseOptions: IFuseOptions<Property> = {
    keys: [
      { name: 'address.street', weight: 0.4 },
      { name: 'address.city', weight: 0.3 },
      { name: 'name', weight: 0.2 },
      { name: 'voiceProfile.nickname', weight: 0.1 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 3,
  };

  constructor(
    supabaseClient: SupabaseClient,
    logger?: VoiceLogger
  ) {
    this.repository = new PropertyRepository(supabaseClient);
    this.logger = logger || new VoiceLogger();
  }

  /**
   * Search properties by voice command
   */
  async searchByVoiceCommand(
    command: PropertyVoiceCommand,
    tenantId: string
  ): Promise<PropertySearchResult[]> {
    try {
      // Log voice search attempt
      await this.logger.logVoiceInteraction({
        action: 'property-voice-search',
        command: command.type,
        query: command.query ?? '',
        customerId: command.customerId,
        tenantId,
      });

      // Parse voice command
      const searchStrategy = this.determineSearchStrategy(command);

      switch (searchStrategy) {
        case 'address':
          return await this.searchByAddress(
            command.address!,
            tenantId,
            { voiceOptimized: true }
          );

        case 'customer':
          return await this.searchByCustomer(
            command.customerId!,
            tenantId
          );

        case 'landmark':
          return await this.searchByLandmark(
            command.query!,
            tenantId
          );

        case 'fuzzy':
        default:
          return await this.searchByQuery(
            command.query!,
            tenantId,
            { voiceOptimized: true }
          );
      }
    } catch (error) {
      this.logger.error('Property voice search failed', {
        command: command.type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Search properties by address with fuzzy matching
   */
  async searchByAddress(
    address: Partial<Address>,
    tenantId: string,
    config?: SearchConfig
  ): Promise<PropertySearchResult[]> {
    try {
      // Check cache first
      const cacheKey = `addr:${JSON.stringify(address)}:${tenantId}`;
      const cached = this.getCachedResults(cacheKey);
      if (cached) return cached;

      // Try exact match first
      const exactMatch = await this.repository.findPropertyByAddress(
        address,
        tenantId
      );

      if (exactMatch) {
        const result: PropertySearchResult = {
          property: exactMatch,
          matchType: 'exact',
          confidence: 1.0,
          matchedField: 'address',
        };
        return this.cacheAndReturn(cacheKey, [result]);
      }

      // Fallback to fuzzy search
      const allProperties = await this.repository.findAll({
        tenantId,
        filters: { is_active: !config?.includeInactive },
      });

      const fuse = new Fuse(allProperties.data, {
        ...this.fuseOptions,
        threshold: config?.fuzzyThreshold || this.fuseOptions.threshold,
      });

      // Build search query
      const searchQuery = [
        address.street,
        address.city,
        address.state,
        address.zip,
      ]
        .filter(Boolean)
        .join(' ');

      const fuseResults = fuse.search(searchQuery);

      // Convert to search results
      const results: PropertySearchResult[] = fuseResults
        .slice(0, config?.maxResults || 10)
        .map((result) => ({
          property: result.item,
          matchType: 'fuzzy',
          confidence: 1 - (result.score || 0),
          matchedField: 'address',
          highlightedText: this.highlightMatch(
            result.item.address.formatted || '',
            searchQuery
          ),
        }));

      return this.cacheAndReturn(cacheKey, results);
    } catch (error) {
      throw createAppError({
        code: 'ADDRESS_SEARCH_FAILED',
        message: 'Failed to search by address',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Search properties near a location
   */
  async searchNearby(
    location: { latitude: number; longitude: number },
    radiusMeters: number,
    tenantId: string,
    config?: SearchConfig
  ): Promise<PropertySearchResult[]> {
    try {
      const nearbyProperties = await this.repository.findPropertiesNearby(
        location,
        radiusMeters,
        tenantId,
        config?.maxResults
      );

      return nearbyProperties.map((prop) => ({
        property: prop,
        matchType: 'nearby',
        confidence: Math.max(0, 1 - prop.distance / radiusMeters),
        matchedField: 'location',
        distance: prop.distance,
      }));
    } catch (error) {
      throw createAppError({
        code: 'NEARBY_SEARCH_FAILED',
        message: 'Failed to search nearby properties',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Search by landmark reference
   */
  async searchByLandmark(
    landmark: string,
    tenantId: string
  ): Promise<PropertySearchResult[]> {
    try {
      const allProperties = await this.repository.findAll({
        tenantId,
        filters: { is_active: true },
      });

      // Search in landmarks and voice navigation notes
      const results: PropertySearchResult[] = [];

      for (const property of allProperties.data) {
        let matched = false;
        let confidence = 0;

        // Check landmarks
        if (property.address.landmarks?.some(l => 
          l.toLowerCase().includes(landmark.toLowerCase())
        )) {
          matched = true;
          confidence = 0.9;
        }

        // Check voice navigation notes
        if (!matched && property.notes?.toLowerCase().includes(landmark.toLowerCase())) {
          matched = true;
          confidence = 0.7;
        }

        if (matched) {
          results.push({
            property,
            matchType: 'landmark',
            confidence,
            matchedField: 'landmarks',
            voiceContext: {
              spokenQuery: landmark,
              interpretedQuery: landmark,
              landmarks: property.address.landmarks,
            },
          });
        }
      }

      // Sort by confidence
      return results.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      throw createAppError({
        code: 'LANDMARK_SEARCH_FAILED',
        message: 'Failed to search by landmark',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * General fuzzy search
   */
  async searchByQuery(
    query: string,
    tenantId: string,
    config?: SearchConfig
  ): Promise<PropertySearchResult[]> {
    try {
      // Check cache
      const cacheKey = `query:${query}:${tenantId}`;
      const cached = this.getCachedResults(cacheKey);
      if (cached) return cached;

      const allProperties = await this.repository.findAll({
        tenantId,
        filters: { is_active: !config?.includeInactive },
      });

      const fuse = new Fuse(allProperties.data, this.fuseOptions);
      const fuseResults = fuse.search(query);

      const results: PropertySearchResult[] = fuseResults
        .slice(0, config?.maxResults || 10)
        .map((result) => {
          // Determine which field matched best
          const matchedField = this.determineMatchedField(result.item, query);
          
          return {
            property: result.item,
            matchType: 'fuzzy',
            confidence: 1 - (result.score || 0),
            matchedField,
            highlightedText: this.highlightMatch(
              this.getFieldValue(result.item, matchedField),
              query
            ),
          };
        });

      return this.cacheAndReturn(cacheKey, results);
    } catch (error) {
      throw createAppError({
        code: 'QUERY_SEARCH_FAILED',
        message: 'Failed to search properties',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: Address): Promise<GeocodingResult> {
    try {
      // Check cache
      const cacheKey = `geo:${address.formatted || JSON.stringify(address)}`;
      const cached = this.geocodeCache.get(cacheKey);
      if (cached) return cached;

      // For now, return a mock result
      // TODO: Integrate with Google Maps Geocoding API
      const result: GeocodingResult = {
        address,
        location: undefined, // Would be populated by geocoding API
        confidence: 0,
        source: 'cache',
      };

      // Cache result
      this.geocodeCache.set(cacheKey, result);
      return result;
    } catch (error) {
      throw createAppError({
        code: 'GEOCODING_FAILED',
        message: 'Failed to geocode address',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(location: GeoLocation): Promise<GeocodingResult> {
    try {
      // TODO: Integrate with Google Maps Reverse Geocoding API
      const result: GeocodingResult = {
        address: {
          street: 'Unknown',
          city: 'Unknown',
          state: 'UN',
          zip: '00000',
        },
        location,
        confidence: 0,
        source: 'cache',
      };

      return result;
    } catch (error) {
      throw createAppError({
        code: 'REVERSE_GEOCODING_FAILED',
        message: 'Failed to reverse geocode location',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Search by customer
   */
  private async searchByCustomer(
    customerId: string,
    tenantId: string
  ): Promise<PropertySearchResult[]> {
    const properties = await this.repository.findPropertiesByCustomer(
      customerId,
      tenantId
    );

    return properties.map((property) => ({
      property,
      matchType: 'exact',
      confidence: 1.0,
      matchedField: 'customerId',
    }));
  }

  /**
   * Determine search strategy from voice command
   */
  private determineSearchStrategy(command: PropertyVoiceCommand): string {
    if (command.address && Object.keys(command.address).length > 0) {
      return 'address';
    }
    if (command.customerId) {
      return 'customer';
    }
    if (command.query?.toLowerCase().includes('near') || 
        command.query?.toLowerCase().includes('by the')) {
      return 'landmark';
    }
    return 'fuzzy';
  }

  /**
   * Determine which field matched
   */
  private determineMatchedField(property: Property, query: string): string {
    const queryLower = query.toLowerCase();
    
    if (property.address.street.toLowerCase().includes(queryLower)) {
      return 'address.street';
    }
    if (property.name.toLowerCase().includes(queryLower)) {
      return 'name';
    }
    if (property.address.city.toLowerCase().includes(queryLower)) {
      return 'address.city';
    }
    
    return 'multiple';
  }

  /**
   * Get field value for highlighting
   */
  private getFieldValue(property: Property, field: string): string {
    switch (field) {
      case 'address.street':
        return property.address.street;
      case 'address.city':
        return property.address.city;
      case 'name':
        return property.name;
      default:
        return property.address.formatted || 
               `${property.address.street}, ${property.address.city}`;
    }
  }

  /**
   * Highlight matched text
   */
  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '**$1**');
  }

  /**
   * Get cached results if valid
   */
  private getCachedResults(key: string): PropertySearchResult[] | null {
    const cached = this.searchCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > cached.ttl) {
      this.searchCache.delete(key);
      return null;
    }

    return cached.results;
  }

  /**
   * Cache and return results
   */
  private cacheAndReturn(
    key: string,
    results: PropertySearchResult[]
  ): PropertySearchResult[] {
    this.searchCache.set(key, {
      query: key,
      results,
      timestamp: new Date(),
      ttl: 5 * 60 * 1000, // 5 minutes
    });
    return results;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.searchCache.clear();
    this.geocodeCache.clear();
  }
}

/**
 * Factory function
 */
export function createPropertySearchService(
  supabaseClient: SupabaseClient,
  logger?: VoiceLogger
): PropertySearchService {
  return new PropertySearchService(supabaseClient, logger);
}

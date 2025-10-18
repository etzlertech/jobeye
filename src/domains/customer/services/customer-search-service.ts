// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/customer/services/customer-search-service.ts
// phase: 2
// domain: customer-management
// purpose: Implement voice-friendly customer search with fuzzy matching and phonetic algorithms
// spec_ref: phase2/customer-management#search-service
// version: 2025-08-1
// complexity_budget: 400 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/customer.repository
//     - /src/domains/customer/types/customer-types
//     - /src/core/logger/voice-logger
//   external:
//     - @supabase/supabase-js: ^2.43.0
//     - fuse.js: ^7.0.0
//
// exports:
//   - CustomerSearchService: class - Voice-optimized customer search
//   - findByVoice: function - Primary voice search method
//   - searchByName: function - Fuzzy name search
//   - searchByPhone: function - Phone number search with formatting
//   - getSoundexCode: function - Phonetic encoding utility
//
// voice_considerations: |
//   Implement multiple search strategies for voice queries:
//   1. Exact match on customer number
//   2. Fuzzy match on name with typo tolerance
//   3. Phonetic match using Soundex/Metaphone
//   4. Partial match on phone numbers
//   Return confidence scores for voice UI disambiguation.
//
// test_requirements:
//   coverage: 95%
//   test_files:
//     - src/__tests__/domains/customer/services/customer-search-service.test.ts
//
// tasks:
//   1. Implement phonetic matching algorithms
//   2. Create fuzzy search with Fuse.js
//   3. Add phone number normalization
//   4. Build confidence scoring system
//   5. Add caching for frequent searches
//   6. Implement offline search capability
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import Fuse from 'fuse.js';
import { CustomerRepository } from '@/lib/repositories/customer.repository';
import {
  Customer,
  CustomerSearchResult,
  CustomerSummary,
} from '../types/customer-types';
import { voiceLogger } from '@/core/logger/voice-logger';
import { createLogger } from '@/core/logger/logger';

const logger = createLogger('customer-search');

export class CustomerSearchService {
  private repository: CustomerRepository;
  private searchCache: Map<string, CustomerSearchResult[]> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private offlineCache: Customer[] = [];

  constructor(private supabase: SupabaseClient) {
    this.repository = new CustomerRepository();
  }

  /**
   * Primary voice search method that tries multiple strategies
   */
  async findByVoice(
    query: string,
    tenantId: string
  ): Promise<CustomerSearchResult | null> {
    try {
      const normalizedQuery = this.normalizeQuery(query);
      logger.info('Voice search initiated', { query, normalizedQuery });

      // Check cache first
      const cacheKey = `${tenantId}:${normalizedQuery}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && cached.length > 0) {
        return cached[0];
      }

      const results: CustomerSearchResult[] = [];

      // Strategy 1: Exact customer number match
      if (this.looksLikeCustomerNumber(normalizedQuery)) {
        const exactMatch = await this.searchByCustomerNumber(normalizedQuery, tenantId);
        if (exactMatch) {
          results.push({
            customer: exactMatch,
            matchType: 'exact',
            confidence: 1.0,
            matchedField: 'customer_number',
          });
        }
      }

      // Strategy 2: Phone number search
      const phoneDigits = this.extractPhoneDigits(normalizedQuery);
      if (phoneDigits.length >= 10) {
        const phoneMatches = await this.searchByPhone(phoneDigits, tenantId);
        phoneMatches.forEach(customer => {
          results.push({
            customer,
            matchType: 'exact',
            confidence: 0.95,
            matchedField: 'phone',
          });
        });
      }

      // Strategy 3: Name search (fuzzy + phonetic)
      const nameResults = await this.searchByName(normalizedQuery, tenantId);
      results.push(...nameResults);

      // Sort by confidence and cache results
      results.sort((a, b) => b.confidence - a.confidence);
      this.cacheResults(cacheKey, results);

      // Log voice search outcome
      if (results.length > 0) {
        await voiceLogger.info(
          `Found ${results.length} matches for "${query}"`,
          { topMatch: results[0].customer.name }
        );
      }

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error('Voice search failed', { error, query });
      
      // Fallback to offline cache if available
      if (this.offlineCache.length > 0) {
        return this.searchOfflineCache(query, tenantId);
      }
      
      throw error;
    }
  }

  /**
   * Fuzzy and phonetic name search
   */
  async searchByName(
    query: string,
    tenantId: string
  ): Promise<CustomerSearchResult[]> {
    const customers = await this.repository.findAll(
      { is_active: true },
      { limit: 100 }
    );
    const customerRows = customers.data as Customer[];

    // Fuzzy search configuration
    const fuse = new Fuse(customerRows, {
      keys: ['name'],
      includeScore: true,
      threshold: 0.4, // Adjust for voice typo tolerance
      location: 0,
      distance: 100,
      minMatchCharLength: 3,
    });

    const fuzzyResults = fuse.search(query);
    const phoneticCode = this.getSoundexCode(query);
    const results: CustomerSearchResult[] = [];

    // Process fuzzy matches
    fuzzyResults.forEach(result => {
      const confidence = 1 - (result.score || 0);
      results.push({
        customer: result.item,
        matchType: 'fuzzy',
        confidence: confidence * 0.8, // Scale down fuzzy matches
        matchedField: 'name',
        highlightedText: this.highlightMatch(result.item.name, query),
      });
    });

    // Add phonetic matches
    customerRows.forEach(customer => {
      const customerPhonetic = this.getSoundexCode(customer.name);
      if (customerPhonetic === phoneticCode && 
          !results.find(r => r.customer.id === customer.id)) {
        results.push({
          customer,
          matchType: 'phonetic',
          confidence: 0.7,
          matchedField: 'name',
        });
      }
    });

    return results;
  }

  /**
   * Search by phone number with normalization
   */
  async searchByPhone(
    phoneDigits: string,
    tenantId: string
  ): Promise<Customer[]> {
    // Format variations to search
    const phoneVariations = [
      phoneDigits, // Raw digits
      `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`, // 555-555-5555
      `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`, // (555) 555-5555
    ];

    const results: Customer[] = [];
    
    for (const phone of phoneVariations) {
      const { data } = await this.supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`phone.eq.${phone},mobile_phone.eq.${phone}`)
        .eq('is_active', true)
        .limit(5);

      if (data) {
        results.push(...data);
      }
    }

    // Deduplicate
    return Array.from(new Map(results.map(c => [c.id, c])).values());
  }

  /**
   * Direct customer number search
   */
  private async searchByCustomerNumber(
    customerNumber: string,
    tenantId: string
  ): Promise<Customer | null> {
    const record = await this.repository.findByCustomerNumber(customerNumber);
    return record as Customer | null;
  }

  /**
   * Soundex phonetic encoding
   */
  getSoundexCode(str: string): string {
    if (!str) return '';
    
    const s = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length === 0) return '';

    const soundexMap: Record<string, string> = {
      B: '1', F: '1', P: '1', V: '1',
      C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
      D: '3', T: '3',
      L: '4',
      M: '5', N: '5',
      R: '6',
    };

    let soundex = s[0];
    let lastCode = soundexMap[s[0]] || '0';

    for (let i = 1; i < s.length && soundex.length < 4; i++) {
      const code = soundexMap[s[i]] || '0';
      if (code !== '0' && code !== lastCode) {
        soundex += code;
        lastCode = code;
      } else if (code === '0') {
        lastCode = '0';
      }
    }

    return soundex.padEnd(4, '0');
  }

  /**
   * Utility methods
   */
  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars except hyphen
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  private looksLikeCustomerNumber(query: string): boolean {
    return /^(cust-|customer-|c-)?\d+$/i.test(query.trim());
  }

  private extractPhoneDigits(query: string): string {
    return query.replace(/\D/g, '');
  }

  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '**$1**');
  }

  /**
   * Caching methods
   */
  private getFromCache(key: string): CustomerSearchResult[] | null {
    const cached = this.searchCache.get(key);
    if (cached) {
      return cached;
    }
    return null;
  }

  private cacheResults(key: string, results: CustomerSearchResult[]): void {
    this.searchCache.set(key, results);
    
    // Auto-cleanup old entries
    setTimeout(() => {
      this.searchCache.delete(key);
    }, this.cacheTimeout);
  }

  /**
   * Offline search fallback
   */
  private searchOfflineCache(
    query: string,
    tenantId: string
  ): CustomerSearchResult | null {
    const filteredCache = this.offlineCache.filter(c => c.tenant_id === tenantId);
    
    const fuse = new Fuse(filteredCache, {
      keys: ['name', 'customer_number', 'phone'],
      threshold: 0.5,
    });

    const results = fuse.search(query);
    if (results.length > 0) {
      return {
        customer: results[0].item,
        matchType: 'fuzzy',
        confidence: 0.6, // Lower confidence for offline results
        matchedField: 'name',
        voiceContext: {
          spokenQuery: query,
          interpretedQuery: query,
        },
      };
    }

    return null;
  }

  /**
   * Update offline cache for resilience
   */
  async updateOfflineCache(tenantId: string): Promise<void> {
    try {
      const { data } = await this.repository.findAll(
        {},
        { limit: 500 }
      );

      this.offlineCache = data as Customer[];
      logger.info('Offline cache updated', { 
        tenantId, 
        customerCount: data.length 
      });
    } catch (error) {
      logger.error('Failed to update offline cache', { error });
    }
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSearchSuggestions(
    query: string,
    tenantId: string,
    limit: number = 5
  ): Promise<CustomerSummary[]> {
    if (query.length < 2) return [];

    const results = await this.searchByName(query, tenantId);
    
    return results
      .slice(0, limit)
      .map(r => ({
        id: r.customer.id,
        customer_number: r.customer.customer_number,
        name: r.customer.name,
        email: r.customer.email,
        phone: r.customer.phone,
        is_active: r.customer.is_active,
      }));
  }
}

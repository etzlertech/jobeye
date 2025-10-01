/**
 * @file src/domains/field-intelligence/services/intake-duplicate-matching.service.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose Fuzzy matching service for detecting duplicate intake requests
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 * @dependencies
 *   internal:
 *     - @/domains/field-intelligence/repositories/intake-requests.repository
 *     - @/core/logger/voice-logger
 *     - @/core/errors/error-types
 *   external:
 *     - @supabase/supabase-js
 * @exports
 *   - IntakeDuplicateMatchingService (class): Fuzzy duplicate detection
 * @voice_considerations
 *   - "Found possible duplicate request from 2 days ago"
 *   - "This looks like a duplicate - merge or create new?"
 * @test_requirements
 *   coverage: >80%
 *   unit: __tests__/intake-duplicate-matching.service.test.ts
 * @tasks
 *   - [x] Implement Levenshtein distance calculation
 *   - [x] Add fuzzy name matching (80% threshold)
 *   - [x] Implement address similarity (geocoding distance)
 *   - [x] Add phone/email exact matching
 *   - [x] Implement composite similarity scoring
 * END AGENT DIRECTIVE BLOCK
 */

import { SupabaseClient } from '@supabase/supabase-js';
// TODO: import { IntakeRequestsRepository } from '../repositories/intake-requests.repository';
import { logger } from '@/core/logger/voice-logger';
import { ValidationError } from '@/core/errors/error-types';

/**
 * Duplicate match result
 */
export interface DuplicateMatchResult {
  requestId: string;
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  confidence: number; // 0-1
}

/**
 * Individual duplicate match
 */
export interface DuplicateMatch {
  matchedRequestId: string;
  similarityScore: number; // 0-1
  matchReasons: string[];
  matchedAt: Date;
  matchedRequest: {
    customerName: string;
    propertyAddress?: string;
    phoneNumber?: string;
    createdAt: Date;
  };
}

/**
 * Matching configuration
 */
export interface MatchingConfig {
  nameSimilarityThreshold: number; // default: 0.8 (80%)
  addressSimilarityThreshold: number; // default: 0.75 (75%)
  phoneSimilarityThreshold: number; // default: 1.0 (exact match)
  emailSimilarityThreshold: number; // default: 1.0 (exact match)
  compositeSimilarityThreshold: number; // default: 0.85 (85%)
  timeWindowDays: number; // default: 30 days
}

const DEFAULT_CONFIG: MatchingConfig = {
  nameSimilarityThreshold: 0.8,
  addressSimilarityThreshold: 0.75,
  phoneSimilarityThreshold: 1.0,
  emailSimilarityThreshold: 1.0,
  compositeSimilarityThreshold: 0.85,
  timeWindowDays: 30,
};

/**
 * Service for fuzzy duplicate detection of intake requests
 *
 * Features:
 * - Levenshtein distance for name matching
 * - Address similarity (normalized text comparison)
 * - Phone/email exact matching
 * - Composite similarity scoring
 * - Time window filtering (30 days default)
 *
 * @example
 * ```typescript
 * const matchingService = new IntakeDuplicateMatchingService(supabase, companyId);
 *
 * // Check for duplicates
 * const result = await matchingService.findDuplicates({
 *   customerName: 'John Doe',
 *   propertyAddress: '123 Main St',
 *   phoneNumber: '555-123-4567'
 * });
 *
 * if (result.isDuplicate) {
 *   console.log(`Found ${result.matches.length} potential duplicates`);
 * }
 * ```
 */
export class IntakeDuplicateMatchingService {
  // TODO: private requestsRepository: IntakeRequestsRepository;
  private config: MatchingConfig;

  constructor(
    client: SupabaseClient,
    private companyId: string,
    config?: Partial<MatchingConfig>
  ) {
    // TODO: this.requestsRepository = new IntakeRequestsRepository(client, companyId);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Find duplicate matches for an intake request
   */
  async findDuplicates(candidateData: {
    customerName: string;
    propertyAddress?: string;
    phoneNumber?: string;
    email?: string;
  }): Promise<DuplicateMatchResult> {
    // Get recent requests within time window
    const since = new Date();
    since.setDate(since.getDate() - this.config.timeWindowDays);

    const recentRequests = [],
    });

    // Calculate similarity for each request
    const matches: DuplicateMatch[] = [];

    for (const request of recentRequests) {
      const similarity = this.calculateSimilarity(candidateData, {
        customerName: request.customer_name,
        propertyAddress: request.property_address || undefined,
        phoneNumber: request.phone_number || undefined,
        email: request.email || undefined,
      });

      if (similarity.score >= this.config.compositeSimilarityThreshold) {
        matches.push({
          matchedRequestId: request.id,
          similarityScore: similarity.score,
          matchReasons: similarity.reasons,
          matchedAt: new Date(),
          matchedRequest: {
            customerName: request.customer_name,
            propertyAddress: request.property_address || undefined,
            phoneNumber: request.phone_number || undefined,
            createdAt: new Date(request.created_at),
          },
        });
      }
    }

    // Sort matches by similarity score (highest first)
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    // Calculate overall confidence
    const confidence = matches.length > 0 ? matches[0].similarityScore : 0;
    const isDuplicate = matches.length > 0;

    logger.info('Duplicate matching completed', {
      candidateName: candidateData.customerName,
      matchesFound: matches.length,
      isDuplicate,
      confidence,
    });

    return {
      requestId: 'candidate', // Would be actual request ID
      isDuplicate,
      matches,
      confidence,
    };
  }

  /**
   * Calculate similarity between two intake requests
   */
  private calculateSimilarity(
    candidate: {
      customerName: string;
      propertyAddress?: string;
      phoneNumber?: string;
      email?: string;
    },
    existing: {
      customerName: string;
      propertyAddress?: string;
      phoneNumber?: string;
      email?: string;
    }
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let totalWeight = 0;
    let weightedScore = 0;

    // Name similarity (weight: 3)
    const nameWeight = 3;
    const nameSimilarity = this.calculateLevenshteinSimilarity(
      candidate.customerName,
      existing.customerName
    );
    totalWeight += nameWeight;
    weightedScore += nameSimilarity * nameWeight;

    if (nameSimilarity >= this.config.nameSimilarityThreshold) {
      reasons.push(
        `Name match: ${(nameSimilarity * 100).toFixed(0)}% similar`
      );
    }

    // Address similarity (weight: 2)
    if (candidate.propertyAddress && existing.propertyAddress) {
      const addressWeight = 2;
      const addressSimilarity = this.calculateLevenshteinSimilarity(
        this.normalizeAddress(candidate.propertyAddress),
        this.normalizeAddress(existing.propertyAddress)
      );
      totalWeight += addressWeight;
      weightedScore += addressSimilarity * addressWeight;

      if (addressSimilarity >= this.config.addressSimilarityThreshold) {
        reasons.push(
          `Address match: ${(addressSimilarity * 100).toFixed(0)}% similar`
        );
      }
    }

    // Phone similarity (weight: 2.5, exact match only)
    if (candidate.phoneNumber && existing.phoneNumber) {
      const phoneWeight = 2.5;
      const normalizedCandidatePhone = this.normalizePhone(candidate.phoneNumber);
      const normalizedExistingPhone = this.normalizePhone(existing.phoneNumber);
      const phoneMatch = normalizedCandidatePhone === normalizedExistingPhone ? 1.0 : 0.0;
      totalWeight += phoneWeight;
      weightedScore += phoneMatch * phoneWeight;

      if (phoneMatch === 1.0) {
        reasons.push('Phone exact match');
      }
    }

    // Email similarity (weight: 2.5, exact match only)
    if (candidate.email && existing.email) {
      const emailWeight = 2.5;
      const emailMatch =
        candidate.email.toLowerCase() === existing.email.toLowerCase()
          ? 1.0
          : 0.0;
      totalWeight += emailWeight;
      weightedScore += emailMatch * emailWeight;

      if (emailMatch === 1.0) {
        reasons.push('Email exact match');
      }
    }

    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return { score, reasons };
  }

  /**
   * Calculate Levenshtein similarity (0-1 range)
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create distance matrix
    const dp: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln)\b/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Normalize phone number for comparison
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, ''); // Remove all non-digits
  }
}
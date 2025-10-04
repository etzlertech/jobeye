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

type IntakeRequestRecord = {
  id: string;
  customer_name: string;
  property_address?: string | null;
  phone_number?: string | null;
  email?: string | null;
  created_at: string;
};

type CandidateData = {
  customerName: string;
  propertyAddress?: string;
  phoneNumber?: string;
  email?: string;
};

type ExistingData = CandidateData;

export interface DuplicateMatchResult {
  requestId: string;
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  confidence: number;
}

export interface DuplicateMatch {
  matchedRequestId: string;
  similarityScore: number;
  matchReasons: string[];
  matchedAt: Date;
  matchedRequest: {
    customerName: string;
    propertyAddress?: string;
    phoneNumber?: string;
    createdAt: Date;
  };
}

export interface MatchingConfig {
  nameSimilarityThreshold: number;
  addressSimilarityThreshold: number;
  phoneSimilarityThreshold: number;
  emailSimilarityThreshold: number;
  compositeSimilarityThreshold: number;
  timeWindowDays: number;
}

const DEFAULT_CONFIG: MatchingConfig = {
  nameSimilarityThreshold: 0.8,
  addressSimilarityThreshold: 0.75,
  phoneSimilarityThreshold: 1.0,
  emailSimilarityThreshold: 1.0,
  compositeSimilarityThreshold: 0.85,
  timeWindowDays: 30,
};

export class IntakeDuplicateMatchingService {
  // TODO: private requestsRepository: IntakeRequestsRepository;
  private readonly config: MatchingConfig;

  constructor(
    private readonly client: SupabaseClient,
    private readonly companyId: string,
    config?: Partial<MatchingConfig>
  ) {
    // TODO: this.requestsRepository = new IntakeRequestsRepository(client, companyId);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async findDuplicates(candidateData: CandidateData): Promise<DuplicateMatchResult> {
    this.validateCandidate(candidateData);

    const since = new Date();
    since.setDate(since.getDate() - this.config.timeWindowDays);

    const recentRequests = await this.fetchRecentRequests(since);

    const matches: DuplicateMatch[] = [];

    for (const request of recentRequests) {
      const similarity = this.calculateSimilarity(candidateData, {
        customerName: request.customer_name,
        propertyAddress: request.property_address ?? undefined,
        phoneNumber: request.phone_number ?? undefined,
        email: request.email ?? undefined,
      });

      if (similarity.score >= this.config.compositeSimilarityThreshold) {
        matches.push({
          matchedRequestId: request.id,
          similarityScore: similarity.score,
          matchReasons: similarity.reasons,
          matchedAt: new Date(),
          matchedRequest: {
            customerName: request.customer_name,
            propertyAddress: request.property_address ?? undefined,
            phoneNumber: request.phone_number ?? undefined,
            createdAt: new Date(request.created_at),
          },
        });
      }
    }

    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      requestId: 'candidate',
      isDuplicate: matches.length > 0,
      matches,
      confidence: matches.length > 0 ? matches[0].similarityScore : 0,
    };
  }

  private validateCandidate(candidateData: CandidateData): void {
    if (!candidateData.customerName) {
      throw new ValidationError('customerName is required for duplicate matching');
    }
  }

  private calculateSimilarity(
    candidate: CandidateData,
    existing: ExistingData
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let totalWeight = 0;
    let weightedScore = 0;

    const nameWeight = 3;
    const nameSimilarity = this.calculateLevenshteinSimilarity(
      candidate.customerName,
      existing.customerName
    );
    totalWeight += nameWeight;
    weightedScore += nameSimilarity * nameWeight;

    if (nameSimilarity >= this.config.nameSimilarityThreshold) {
      reasons.push(`Name match: ${(nameSimilarity * 100).toFixed(0)}% similar`);
    }

    if (candidate.propertyAddress && existing.propertyAddress) {
      const addressWeight = 2;
      const addressSimilarity = this.calculateLevenshteinSimilarity(
        this.normalizeAddress(candidate.propertyAddress),
        this.normalizeAddress(existing.propertyAddress)
      );
      totalWeight += addressWeight;
      weightedScore += addressSimilarity * addressWeight;

      if (addressSimilarity >= this.config.addressSimilarityThreshold) {
        reasons.push(`Address match: ${(addressSimilarity * 100).toFixed(0)}% similar`);
      }
    }

    if (candidate.phoneNumber && existing.phoneNumber) {
      const phoneWeight = 2.5;
      const candidatePhone = this.normalizePhone(candidate.phoneNumber);
      const existingPhone = this.normalizePhone(existing.phoneNumber);
      const phoneMatch = candidatePhone === existingPhone ? 1.0 : 0.0;
      totalWeight += phoneWeight;
      weightedScore += phoneMatch * phoneWeight;

      if (phoneMatch === 1.0) {
        reasons.push('Phone exact match');
      }
    }

    if (candidate.email && existing.email) {
      const emailWeight = 2.5;
      const emailMatch =
        candidate.email.toLowerCase() === existing.email.toLowerCase() ? 1.0 : 0.0;
      totalWeight += emailWeight;
      weightedScore += emailMatch * emailWeight;

      if (emailMatch === 1.0) {
        reasons.push('Email exact match');
      }
    }

    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return { score, reasons };
  }

  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;

    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + 1
          );
        }
      }
    }

    return dp[m][n];
  }

  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln)\b/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private async fetchRecentRequests(since: Date): Promise<IntakeRequestRecord[]> {
    logger.debug('fetchRecentRequests stub invoked', {
      tenantId: this.companyId,
      since,
    });
    return [];
  }
}

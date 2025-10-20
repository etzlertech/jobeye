/**
 * VlmItemMatcher Service
 *
 * Performs fuzzy string matching to match VLM-detected items with database items.
 * Uses Levenshtein distance for similarity scoring.
 *
 * Match Confidence Thresholds:
 * - 0.9+ : High confidence (auto-match)
 * - 0.7-0.89 : Medium confidence (suggest to user)
 * - <0.7 : Low confidence (skip or flag for manual review)
 *
 * @see JOB_LOAD_REFACTOR_PLAN.md for architecture details
 */

import type { Database } from '@/types/database';

type ItemType = Database['public']['Enums']['item_type'];

export interface DatabaseItem {
  id: string;
  name: string;
  item_type: ItemType;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
}

export interface VlmDetectedItem {
  label: string;
  confidence: number;
  category?: string;
}

export interface MatchResult {
  detected_item: VlmDetectedItem;
  matched_item: DatabaseItem | null;
  similarity_score: number;
  match_confidence: 'high' | 'medium' | 'low';
  should_auto_match: boolean;
}

export class VlmItemMatcher {
  /**
   * Compute Levenshtein distance between two strings
   * (minimum number of single-character edits required to change one word into the other)
   */
  private static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    // Initialize matrix
    for (let i = 0; i <= bLower.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= aLower.length; j++) {
      matrix[0][j] = j;
    }

    // Compute distances
    for (let i = 1; i <= bLower.length; i++) {
      for (let j = 1; j <= aLower.length; j++) {
        if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[bLower.length][aLower.length];
  }

  /**
   * Calculate similarity score (0-1) between two strings
   */
  private static calculateSimilarity(a: string, b: string): number {
    const distance = this.levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);

    if (maxLength === 0) return 1.0;

    return 1 - distance / maxLength;
  }

  /**
   * Normalize item name for better matching
   * - Lowercase
   * - Remove common words ("the", "a", "an")
   * - Remove extra whitespace
   * - Remove special characters
   */
  private static normalizeItemName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(the|a|an)\b/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Match a single VLM-detected item against a list of database items
   */
  static matchItem(
    detectedItem: VlmDetectedItem,
    databaseItems: DatabaseItem[]
  ): MatchResult {
    const normalizedDetected = this.normalizeItemName(detectedItem.label);

    let bestMatch: DatabaseItem | null = null;
    let bestScore = 0;

    for (const dbItem of databaseItems) {
      // Calculate similarity against item name
      const nameScore = this.calculateSimilarity(
        normalizedDetected,
        this.normalizeItemName(dbItem.name)
      );

      // Boost score if manufacturer or model matches
      let totalScore = nameScore;

      if (dbItem.manufacturer) {
        const mfgScore = this.calculateSimilarity(
          normalizedDetected,
          this.normalizeItemName(dbItem.manufacturer)
        );
        totalScore = Math.max(totalScore, mfgScore * 0.9); // Manufacturer match worth 90%
      }

      if (dbItem.model) {
        const modelScore = this.calculateSimilarity(
          normalizedDetected,
          this.normalizeItemName(dbItem.model)
        );
        totalScore = Math.max(totalScore, modelScore * 0.85); // Model match worth 85%
      }

      // Boost score if category matches (if provided by VLM)
      if (detectedItem.category && dbItem.category) {
        const categoryMatch = this.calculateSimilarity(
          this.normalizeItemName(detectedItem.category),
          this.normalizeItemName(dbItem.category)
        );
        if (categoryMatch > 0.8) {
          totalScore += 0.1; // 10% bonus for category match
        }
      }

      // Cap score at 1.0
      totalScore = Math.min(totalScore, 1.0);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMatch = dbItem;
      }
    }

    // Determine confidence level
    let matchConfidence: 'high' | 'medium' | 'low';
    let shouldAutoMatch: boolean;

    if (bestScore >= 0.9) {
      matchConfidence = 'high';
      shouldAutoMatch = true;
    } else if (bestScore >= 0.7) {
      matchConfidence = 'medium';
      shouldAutoMatch = false; // Require user confirmation
    } else {
      matchConfidence = 'low';
      shouldAutoMatch = false;
    }

    return {
      detected_item: detectedItem,
      matched_item: bestMatch,
      similarity_score: bestScore,
      match_confidence: matchConfidence,
      should_auto_match: shouldAutoMatch,
    };
  }

  /**
   * Batch match multiple detected items against database items
   */
  static matchItems(
    detectedItems: VlmDetectedItem[],
    databaseItems: DatabaseItem[]
  ): MatchResult[] {
    return detectedItems.map((detected) =>
      this.matchItem(detected, databaseItems)
    );
  }

  /**
   * Filter database items by category for more targeted matching
   */
  static filterItemsByCategory(
    items: DatabaseItem[],
    category: string
  ): DatabaseItem[] {
    const normalizedCategory = this.normalizeItemName(category);

    return items.filter((item) => {
      if (!item.category) return false;

      const itemCategory = this.normalizeItemName(item.category);
      const similarity = this.calculateSimilarity(
        normalizedCategory,
        itemCategory
      );

      return similarity > 0.7; // 70% similarity threshold for category filtering
    });
  }

  /**
   * Get match statistics for a batch of matches
   */
  static getMatchStatistics(matches: MatchResult[]): {
    total: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    auto_matched: number;
    unmatched: number;
  } {
    return {
      total: matches.length,
      high_confidence: matches.filter((m) => m.match_confidence === 'high')
        .length,
      medium_confidence: matches.filter((m) => m.match_confidence === 'medium')
        .length,
      low_confidence: matches.filter((m) => m.match_confidence === 'low')
        .length,
      auto_matched: matches.filter((m) => m.should_auto_match).length,
      unmatched: matches.filter((m) => m.matched_item === null).length,
    };
  }
}

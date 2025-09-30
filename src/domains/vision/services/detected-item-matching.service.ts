/**
 * @file /src/domains/vision/services/detected-item-matching.service.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Item matching service for fuzzy matching detected items to kit inventory
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

export interface DetectedItem {
  itemType: string;
  confidence: number;
}

export interface KitItem {
  id: string;
  name: string;
  aliases?: string[];
  category?: string;
}

export interface MatchResult {
  detectedItem: DetectedItem;
  matchedKitItem: KitItem | null;
  matchScore: number;
  matchStatus: 'matched' | 'unmatched' | 'uncertain';
}

export interface BatchMatchResult {
  matches: MatchResult[];
  unmatchedDetections: DetectedItem[];
  missingKitItems: KitItem[];
  overallMatchRate: number;
}

/**
 * Service for matching detected items to expected kit items
 */
export class DetectedItemMatchingService {
  /**
   * Match a batch of detected items against kit items
   */
  matchItems(detectedItems: DetectedItem[], kitItems: KitItem[]): BatchMatchResult {
    const matches: MatchResult[] = [];
    const matchedKitItemIds = new Set<string>();

    // Match each detected item
    for (const detected of detectedItems) {
      const matchResult = this.matchSingleItem(detected, kitItems, matchedKitItemIds);
      matches.push(matchResult);

      if (matchResult.matchedKitItem) {
        matchedKitItemIds.add(matchResult.matchedKitItem.id);
      }
    }

    // Find unmatched detections and missing kit items
    const unmatchedDetections = matches
      .filter(m => m.matchStatus === 'unmatched')
      .map(m => m.detectedItem);

    const missingKitItems = kitItems.filter(item => !matchedKitItemIds.has(item.id));

    // Calculate overall match rate
    const matchedCount = matches.filter(m => m.matchStatus === 'matched').length;
    const overallMatchRate = kitItems.length > 0 ? matchedCount / kitItems.length : 0;

    return {
      matches,
      unmatchedDetections,
      missingKitItems,
      overallMatchRate
    };
  }

  /**
   * Match a single detected item against kit items
   */
  private matchSingleItem(
    detected: DetectedItem,
    kitItems: KitItem[],
    alreadyMatched: Set<string>
  ): MatchResult {
    let bestMatch: KitItem | null = null;
    let bestScore = 0;

    for (const kitItem of kitItems) {
      // Skip already matched items
      if (alreadyMatched.has(kitItem.id)) {
        continue;
      }

      const score = this.calculateMatchScore(detected.itemType, kitItem);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = kitItem;
      }
    }

    // Determine match status based on score and confidence
    const matchStatus = this.determineMatchStatus(bestScore, detected.confidence);

    return {
      detectedItem: detected,
      matchedKitItem: bestMatch,
      matchScore: bestScore,
      matchStatus
    };
  }

  /**
   * Calculate match score between detected type and kit item
   */
  private calculateMatchScore(detectedType: string, kitItem: KitItem): number {
    const normalizedDetected = this.normalize(detectedType);
    const normalizedName = this.normalize(kitItem.name);

    // Exact match
    if (normalizedDetected === normalizedName) {
      return 1.0;
    }

    // Check aliases
    if (kitItem.aliases) {
      for (const alias of kitItem.aliases) {
        if (normalizedDetected === this.normalize(alias)) {
          return 0.95;
        }
      }
    }

    // Partial match (contains)
    if (normalizedName.includes(normalizedDetected) || normalizedDetected.includes(normalizedName)) {
      return 0.7;
    }

    // Fuzzy similarity
    const similarity = this.calculateStringSimilarity(normalizedDetected, normalizedName);
    if (similarity > 0.8) {
      return similarity * 0.9; // Scale down fuzzy matches
    }

    return 0;
  }

  /**
   * Determine match status based on score and confidence
   */
  private determineMatchStatus(
    matchScore: number,
    confidence: number
  ): 'matched' | 'unmatched' | 'uncertain' {
    // High score + high confidence = matched
    if (matchScore >= 0.8 && confidence >= 0.7) {
      return 'matched';
    }

    // Medium score or medium confidence = uncertain
    if (matchScore >= 0.6 || confidence >= 0.5) {
      return 'uncertain';
    }

    // Low score = unmatched
    return 'unmatched';
  }

  /**
   * Normalize string for comparison
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, ''); // Remove special chars
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }
}

/**
 * Singleton instance
 */
let serviceInstance: DetectedItemMatchingService | null = null;

export function getDetectedItemMatchingService(): DetectedItemMatchingService {
  if (!serviceInstance) {
    serviceInstance = new DetectedItemMatchingService();
  }
  return serviceInstance;
}
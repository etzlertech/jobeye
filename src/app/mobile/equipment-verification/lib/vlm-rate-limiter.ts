/**
 * @file vlm-rate-limiter.ts
 * @purpose Cost protection for VLM API calls (Gemini 2.0 Flash)
 * @complexity_budget 150
 */

export interface RateLimiterStats {
  dailyCount: number;
  dailyLimit: number;
  remainingToday: number;
  estimatedDailyCost: number;
  lastRequestTime: number;
}

/**
 * Rate limiter for VLM requests to control costs
 *
 * Limits:
 * - Max 1 request/second (prevents API rate limits and ensures smooth UX)
 * - Max 5000 requests/day ($10 daily budget at $0.002/request with Gemini)
 */
export class VLMRateLimiter {
  private lastRequestTime = 0;
  private dailyCount = 0;
  private dailyResetTime = 0;

  private readonly minIntervalMs = 1000; // 1 second minimum between requests
  private readonly dailyLimit = 5000; // $10/day budget with Gemini pricing
  private readonly costPerRequest = 0.002; // $0.002 per Gemini VLM call

  constructor() {
    this.resetDailyIfNeeded();
  }

  /**
   * Execute function with rate limiting
   */
  async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    this.resetDailyIfNeeded();

    // Check daily limit
    if (this.dailyCount >= this.dailyLimit) {
      throw new Error(
        `Daily VLM budget exceeded (${this.dailyLimit} requests = $${this.dailyLimit * this.costPerRequest}). ` +
        'Resets at midnight UTC.'
      );
    }

    // Enforce minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - timeSinceLastRequest;
      console.log(`[VLMRateLimiter] Throttling: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Execute request
    this.lastRequestTime = Date.now();
    this.dailyCount++;

    console.log(`[VLMRateLimiter] Request ${this.dailyCount}/${this.dailyLimit} today ($${(this.dailyCount * this.costPerRequest).toFixed(2)})`);

    return await fn();
  }

  /**
   * Get current rate limiter statistics
   */
  getStats(): RateLimiterStats {
    this.resetDailyIfNeeded();

    return {
      dailyCount: this.dailyCount,
      dailyLimit: this.dailyLimit,
      remainingToday: this.dailyLimit - this.dailyCount,
      estimatedDailyCost: this.dailyCount * this.costPerRequest,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * Check if rate limit would be exceeded
   */
  wouldExceedLimit(): boolean {
    this.resetDailyIfNeeded();
    return this.dailyCount >= this.dailyLimit;
  }

  /**
   * Reset daily counter at midnight UTC
   */
  private resetDailyIfNeeded(): void {
    const now = Date.now();
    const midnightUTC = new Date().setUTCHours(0, 0, 0, 0);

    if (this.dailyResetTime === 0) {
      // First initialization
      this.dailyResetTime = midnightUTC;
    } else if (now >= this.dailyResetTime + 24 * 60 * 60 * 1000) {
      // New day - reset counter
      console.log('[VLMRateLimiter] Daily reset - previous count:', this.dailyCount);
      this.dailyCount = 0;
      this.dailyResetTime = midnightUTC;
    }
  }

  /**
   * Manual reset (for testing only)
   */
  resetForTesting(): void {
    this.dailyCount = 0;
    this.lastRequestTime = 0;
    this.dailyResetTime = Date.now();
  }
}

// Singleton instance
let rateLimiterInstance: VLMRateLimiter | null = null;

export function getVLMRateLimiter(): VLMRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new VLMRateLimiter();
  }
  return rateLimiterInstance;
}

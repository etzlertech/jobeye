/**
 * @file /src/domains/vision/lib/cost-estimator.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Cost estimation for VLM API calls ($0.10/request average)
 * @complexity_budget 200
 * @test_coverage ≥80%
 * @dependencies none
 */

// OpenAI GPT-4 Vision pricing (as of 2024)
// https://openai.com/pricing
const PRICING = {
  // Input pricing per 1000 tokens
  inputTokensPer1k: 0.01,

  // Image pricing based on detail level and size
  // High detail: charged per 512x512 tile
  image: {
    baseCost: 0.00765, // Base cost for any image
    perTile: 0.00255,   // Cost per 512x512 tile (high detail)
    lowDetailCost: 0.00765 // Fixed cost for low detail
  },

  // Output pricing per 1000 tokens
  outputTokensPer1k: 0.03
};

// Budget constraints from spec
export const DAILY_BUDGET_USD = 10.0; // $10/day per company
export const MAX_VLM_REQUESTS_PER_DAY = 100; // Hard limit
export const ESTIMATED_COST_PER_REQUEST = 0.10; // $0.10 average

/**
 * Calculate number of 512x512 tiles needed for high-detail image
 */
function calculateImageTiles(width: number, height: number): number {
  // OpenAI resizes to fit within 2048x2048, maintaining aspect ratio
  const maxDimension = 2048;
  let scaledWidth = width;
  let scaledHeight = height;

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    scaledWidth = Math.floor(width * scale);
    scaledHeight = Math.floor(height * scale);
  }

  // Calculate tiles (rounded up)
  const tilesWidth = Math.ceil(scaledWidth / 512);
  const tilesHeight = Math.ceil(scaledHeight / 512);

  return tilesWidth * tilesHeight;
}

/**
 * Estimate cost for a VLM API call (wrapper for service compatibility)
 */
export function estimateCost(provider: string, imageData: ImageData): number {
  return estimateVlmCost(imageData.width, imageData.height);
}

/**
 * Estimate cost for a VLM API call
 */
export function estimateVlmCost(
  imageWidth: number,
  imageHeight: number,
  outputTokens: number = 500, // Average tokens for our verification response
  detailLevel: 'low' | 'high' = 'high'
): number {
  let imageCost = 0;

  if (detailLevel === 'low') {
    // Low detail is fixed cost
    imageCost = PRICING.image.lowDetailCost;
  } else {
    // High detail: base + tiles
    const tiles = calculateImageTiles(imageWidth, imageHeight);
    imageCost = PRICING.image.baseCost + (tiles * PRICING.image.perTile);
  }

  // Output tokens cost
  const outputCost = (outputTokens / 1000) * PRICING.outputTokensPer1k;

  // Typical prompt for our use case is ~200-300 tokens
  const estimatedInputTokens = 250;
  const inputCost = (estimatedInputTokens / 1000) * PRICING.inputTokensPer1k;

  const totalCost = imageCost + inputCost + outputCost;

  return Math.round(totalCost * 10000) / 10000; // Round to 4 decimal places
}

/**
 * Check if company has budget remaining for VLM request
 */
export function checkBudgetAvailability(
  currentDailyCostUsd: number,
  currentRequestCount: number,
  estimatedCostUsd: number
): {
  allowed: boolean;
  reason?: string;
  remainingBudget: number;
  remainingRequests: number;
} {
  const remainingBudget = DAILY_BUDGET_USD - currentDailyCostUsd;
  const remainingRequests = MAX_VLM_REQUESTS_PER_DAY - currentRequestCount;

  // Check request count limit
  if (currentRequestCount >= MAX_VLM_REQUESTS_PER_DAY) {
    return {
      allowed: false,
      reason: `Daily request limit reached (${MAX_VLM_REQUESTS_PER_DAY} requests)`,
      remainingBudget,
      remainingRequests: 0
    };
  }

  // Check budget limit
  if (currentDailyCostUsd + estimatedCostUsd > DAILY_BUDGET_USD) {
    return {
      allowed: false,
      reason: `Would exceed daily budget: $${(currentDailyCostUsd + estimatedCostUsd).toFixed(2)} > $${DAILY_BUDGET_USD.toFixed(2)}`,
      remainingBudget,
      remainingRequests
    };
  }

  return {
    allowed: true,
    remainingBudget,
    remainingRequests
  };
}

/**
 * Calculate cost savings from using local YOLO vs VLM
 */
export function calculateCostSavings(
  yoloOnlyCount: number,
  vlmFallbackCount: number
): {
  yoloCost: number;
  vlmCost: number;
  totalSavings: number;
  savingsPercent: number;
} {
  // YOLO is essentially free (local compute)
  const yoloCost = 0;

  // VLM has per-request cost
  const vlmCost = vlmFallbackCount * ESTIMATED_COST_PER_REQUEST;

  // If all requests used VLM
  const wouldHaveCost = (yoloOnlyCount + vlmFallbackCount) * ESTIMATED_COST_PER_REQUEST;

  const totalSavings = wouldHaveCost - vlmCost;
  const savingsPercent = wouldHaveCost > 0
    ? (totalSavings / wouldHaveCost) * 100
    : 0;

  return {
    yoloCost,
    vlmCost,
    totalSavings,
    savingsPercent
  };
}

/**
 * Format cost for display
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return '<$0.01';
  }
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Get budget usage summary
 */
export function getBudgetSummary(
  currentDailyCostUsd: number,
  currentRequestCount: number
): {
  usedBudget: number;
  remainingBudget: number;
  budgetPercent: number;
  usedRequests: number;
  remainingRequests: number;
  requestPercent: number;
  status: 'ok' | 'warning' | 'critical';
} {
  const remainingBudget = Math.max(0, DAILY_BUDGET_USD - currentDailyCostUsd);
  const budgetPercent = (currentDailyCostUsd / DAILY_BUDGET_USD) * 100;

  const remainingRequests = Math.max(0, MAX_VLM_REQUESTS_PER_DAY - currentRequestCount);
  const requestPercent = (currentRequestCount / MAX_VLM_REQUESTS_PER_DAY) * 100;

  // Determine status
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (budgetPercent >= 90 || requestPercent >= 90) {
    status = 'critical';
  } else if (budgetPercent >= 75 || requestPercent >= 75) {
    status = 'warning';
  }

  return {
    usedBudget: currentDailyCostUsd,
    remainingBudget,
    budgetPercent,
    usedRequests: currentRequestCount,
    remainingRequests,
    requestPercent,
    status
  };
}

/**
 * Estimate monthly cost based on daily usage patterns
 */
export function estimateMonthlyCost(
  avgDailyVerifications: number,
  vlmFallbackRate: number // 0.0 - 1.0
): {
  monthlyVlmCalls: number;
  estimatedMonthlyCost: number;
  estimatedAnnualCost: number;
} {
  const workingDaysPerMonth = 22; // Typical
  const monthlyVerifications = avgDailyVerifications * workingDaysPerMonth;
  const monthlyVlmCalls = Math.round(monthlyVerifications * vlmFallbackRate);
  const estimatedMonthlyCost = monthlyVlmCalls * ESTIMATED_COST_PER_REQUEST;
  const estimatedAnnualCost = estimatedMonthlyCost * 12;

  return {
    monthlyVlmCalls,
    estimatedMonthlyCost,
    estimatedAnnualCost
  };
}
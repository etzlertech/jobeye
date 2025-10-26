/**
 * Feature flag utilities
 * Provides runtime checking of feature flags from tenant settings
 */

import { createClient } from '@/lib/supabase/server';
import type { RequestContext } from '@/lib/auth/context';

/**
 * Cache for feature flag values (in-memory, per request)
 * Key: `${tenantId}:${flagName}`
 */
const flagCache = new Map<string, boolean>();

/**
 * Get a feature flag value for the current tenant
 *
 * @param context - Request context with tenant ID
 * @param flagName - Name of the feature flag in settings.features
 * @param defaultValue - Default value if flag not found (default: false)
 * @returns The feature flag value
 */
export async function getFeatureFlag(
  context: RequestContext,
  flagName: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const cacheKey = `${context.tenantId}:${flagName}`;

  // Check cache first
  if (flagCache.has(cacheKey)) {
    return flagCache.get(cacheKey)!;
  }

  try {
    const supabase = await createClient();

    // Query tenant settings
    const { data, error } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', context.tenantId)
      .single();

    if (error) {
      console.warn(`[FeatureFlags] Error fetching tenant settings for ${context.tenantId}:`, error);
      return defaultValue;
    }

    if (!data?.settings) {
      console.warn(`[FeatureFlags] No settings found for tenant ${context.tenantId}`);
      return defaultValue;
    }

    // Extract flag from settings.features
    const settings = data.settings as any;
    const flagValue = settings?.features?.[flagName];

    // Use the flag value if it exists, otherwise use default
    const result = typeof flagValue === 'boolean' ? flagValue : defaultValue;

    // Cache the result
    flagCache.set(cacheKey, result);

    console.log(`[FeatureFlags] ${flagName} for tenant ${context.tenantId}:`, result);

    return result;
  } catch (error) {
    console.error(`[FeatureFlags] Error getting feature flag ${flagName}:`, error);
    return defaultValue;
  }
}

/**
 * Check if job load v2 system is enabled for the current tenant
 *
 * @param context - Request context with tenant ID
 * @returns true if job load v2 is enabled, false otherwise
 */
export async function isJobLoadV2Enabled(context: RequestContext): Promise<boolean> {
  return getFeatureFlag(context, 'jobLoadV2Enabled', false);
}

/**
 * Check if voice commands are enabled for the current tenant
 *
 * @param context - Request context with tenant ID
 * @returns true if voice commands are enabled, false otherwise
 */
export async function isVoiceCommandsEnabled(context: RequestContext): Promise<boolean> {
  return getFeatureFlag(context, 'voice_commands_enabled', false);
}

/**
 * Clear the feature flag cache
 * Useful for testing or when settings are updated
 */
export function clearFeatureFlagCache(): void {
  flagCache.clear();
}

/**
 * Clear cache for a specific tenant
 */
export function clearTenantFlagCache(tenantId: string): void {
  for (const key of flagCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      flagCache.delete(key);
    }
  }
}

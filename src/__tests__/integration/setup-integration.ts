/**
 * Setup for integration tests that require real Supabase connection
 */

// Check if we're in CI or if SKIP_INTEGRATION_TESTS is set
const skipIntegration = process.env.CI === 'true' || process.env.SKIP_INTEGRATION_TESTS === 'true';

if (skipIntegration) {
  console.log('⚠️  Skipping integration tests (CI environment or SKIP_INTEGRATION_TESTS=true)');
}

// Export flag for tests to check
export const shouldSkipIntegration = skipIntegration;

// Helper to skip integration tests
export const describeIntegration = skipIntegration ? describe.skip : describe;
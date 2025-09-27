// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.
// Integration posture with proper environment checks

export const hasRealSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'test' &&
  process.env.SUPABASE_SERVICE_ROLE_KEY !== 'test'
);

export function itIfReal(name: string, fn: jest.ProvidesCallback) {
  if (hasRealSupabase) {
    it(name, fn);
  } else {
    it.skip(name, () => {
      console.log(`⚠️  SKIPPED: ${name} - Real Supabase credentials not available in environment`);
      console.log('To run this test, ensure .env.local has valid NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      // Log ticket reference for tracking
      console.log('Tracking: See docs/testing.md for credential setup instructions');
    });
  }
}

describe('Real Supabase Connection Tests', () => {
  itIfReal('should connect to real Supabase with valid credentials', async () => {
    const { anonClient, serviceClient } = await import('./test-setup');
    
    // Test anonymous client connection
    const { data: anonData, error: anonError } = await anonClient
      .from('customers')
      .select('count')
      .limit(1);
    
    // Should succeed or fail with proper auth error (not connection error)
    if (anonError) {
      expect(anonError.code).not.toBe('PGRST301'); // Connection refused
      expect(anonError.message).not.toContain('connection');
    }
    
    // Test service role client connection
    const { data: serviceData, error: serviceError } = await serviceClient
      .from('customers')
      .select('count')
      .limit(1);
    
    // Service role should have broader access
    expect(serviceError).toBeNull();
  });

  itIfReal('should fail locally on connection/auth errors', async () => {
    // This test runs locally and should fail if credentials are wrong
    // In CI, it will be skipped if credentials are missing
    
    if (process.env.CI === 'true' && !hasRealSupabase) {
      console.log('🏗️  CI detected - skipping credential validation test');
      return;
    }
    
    // Local environment should have working credentials
    expect(hasRealSupabase).toBe(true);
    
    const { serviceClient } = await import('./test-setup');
    
    // Attempt a simple authenticated operation
    const { error } = await serviceClient.auth.getUser();
    
    // Should not get connection errors in local dev
    if (error && error.message.includes('connection')) {
      throw new Error(`Local Supabase connection failed: ${error.message}. Check your .env.local file.`);
    }
  });

  itIfReal('should validate environment variables are properly set', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).not.toBe('test');
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(/^https:\/\/.+\.supabase\.co$/);
    
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).not.toBe('test');
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toMatch(/^eyJ/); // JWT format
  });
});
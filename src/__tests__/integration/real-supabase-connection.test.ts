/**
 * Integration test with real Supabase connection
 * This test connects to the actual Supabase instance to verify functionality
 */

import { createClient } from '@supabase/supabase-js';
import { describeIntegration } from './setup-integration';

// Skip mocking for this test file - we want real connections
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

describeIntegration('Real Supabase Connection Tests', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    // Skip if no real credentials
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('⚠️  Skipping integration tests: Missing Supabase credentials');
      return;
    }
    
    // Create a real Supabase client with service role key
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  });

  test('should connect to Supabase and fetch tables', async () => {
    if (!supabase) return;
    
    // Test connection by querying system tables
    const { data, error } = await supabase
      .from('tenants')
      .select('count')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('should fetch customers table (with RLS using service role)', async () => {
    if (!supabase) return;
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .limit(5);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('should fetch role_permissions data', async () => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .limit(5);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.length).toBeGreaterThan(0); // We saw 25 rows in the check
  });

  test('should test database operations with transaction', async () => {
    // Start a transaction by creating a test tenant
    const testTenantName = `Test Tenant ${Date.now()}`;
    
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: testTenantName,
        slug: testTenantName.toLowerCase().replace(/\s+/g, '-'),
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Tenant creation error:', tenantError);
    }

    expect(tenantError).toBeNull();
    expect(tenant).toBeDefined();
    expect(tenant?.name).toBe(testTenantName);

    // Clean up - delete the test tenant
    if (tenant?.id) {
      const { error: deleteError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenant.id);

      expect(deleteError).toBeNull();
    }
  });

  test('should verify RLS policies are in place', async () => {
    // Create a regular anon client to test RLS
    const anonClient = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Try to read customers without authentication - should fail or return empty
    const { data, error } = await anonClient
      .from('customers')
      .select('*');

    // Either it should error due to RLS or return empty array
    expect(
      error?.message?.includes('Row Level Security') || 
      data?.length === 0 ||
      error?.code === 'PGRST301'
    ).toBe(true);
  });

  test('should test voice_transcripts table structure', async () => {
    const { data, error } = await supabase
      .from('voice_transcripts')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    // Even if empty, we can verify the query works
    if (data && data.length > 0) {
      // Verify expected columns exist
      const transcript = data[0];
      expect(transcript).toHaveProperty('id');
      expect(transcript).toHaveProperty('tenant_id');
      expect(transcript).toHaveProperty('transcript');
      expect(transcript).toHaveProperty('confidence_score');
    }
  });
});
/**
 * Test Database Setup Helper
 *
 * Provides utilities for seeding and cleaning up test data in Supabase
 * for integration and contract tests.
 *
 * Usage:
 *   import { setupTestDatabase, cleanupTestDatabase } from '@/__tests__/helpers/test-db-setup';
 *
 *   beforeAll(async () => {
 *     await setupTestDatabase();
 *   });
 *
 *   afterAll(async () => {
 *     await cleanupTestDatabase();
 *   });
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for testing');
}

// Use service role client to bypass RLS for test setup
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test data IDs - consistent across all tests
export const TEST_IDS = {
  company: '00000000-0000-0000-0000-000000000001',
  user1: '123e4567-e89b-12d3-a456-426614174000',
  user2: '223e4567-e89b-12d3-a456-426614174001',
  dayPlan1: '550e8400-e29b-41d4-a716-446655440000',
  dayPlan2: '660e8400-e29b-41d4-a716-446655440001',
  job1: 'job-123e4567-e89b-12d3-a456-426614174000',
  job2: 'job-223e4567-e89b-12d3-a456-426614174001',
};

/**
 * Sets up test database with required seed data
 */
export async function setupTestDatabase() {
  console.log('Setting up test database...');

  try {
    // 0. Ensure tenant exists (required for FK constraints)
    const tenantPayload: Database['public']['Tables']['tenants']['Insert'] = {
      id: TEST_IDS.company,
      name: 'Test Tenant',
      slug: 'test-tenant',
      plan: 'trial',
      status: 'active',
      settings: {},
    };

    const { error: tenantError } = await supabase
      .from('tenants')
      .upsert<Database['public']['Tables']['tenants']['Insert']>(tenantPayload, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

    if (tenantError && tenantError.code !== '23505') {
      console.error('Tenant creation error:', tenantError);
      throw tenantError;
    }

    // 1. Create test company
    const companyPayload: Database['public']['Tables']['companies']['Insert'] = {
      id: TEST_IDS.company,
      tenant_id: TEST_IDS.company,
      name: 'Test Company',
      domain: null,
      is_active: true,
    };

    const { error: companyError } = await supabase
      .from('companies')
      .upsert<Database['public']['Tables']['companies']['Insert']>(companyPayload, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

    if (companyError && companyError.code !== '23505') { // Ignore duplicate key errors
      console.error('Company creation error:', companyError);
      throw companyError;
    }

    // 2. Create test users (if users table exists and is needed)
    // Note: You may need to adjust this based on your auth setup
    // Supabase Auth users are in auth.users, not public.users

    console.log('✓ Test database setup complete');
    console.log(`  Company ID: ${TEST_IDS.company}`);
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Cleans up test data from database
 */
export async function cleanupTestDatabase() {
  console.log('Cleaning up test database...');

  try {
    // Delete in reverse dependency order

    // Delete day plans
    await supabase
      .from('day_plans')
      .delete()
      .eq('tenant_id', TEST_IDS.company);

    // 3. Delete jobs (if needed)
    // await supabase
    //   .from('jobs')
    //   .delete()
    //   .eq('tenant_id', TEST_IDS.company);

    // 4. Keep company for reuse (or delete if preferred)
    // await supabase
    //   .from('companies')
    //   .delete()
    //   .eq('id', TEST_IDS.company);

    console.log('✓ Test database cleanup complete');
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    // Don't throw - cleanup failures shouldn't fail tests
  }
}

/**
 * Creates a test day plan
 */
export async function createTestDayPlan(overrides: Partial<Database['public']['Tables']['day_plans']['Insert']> = {}) {
  const payload: Database['public']['Tables']['day_plans']['Insert'] = {
    tenant_id: TEST_IDS.company,
    user_id: TEST_IDS.user1,
    plan_date: '2024-01-15',
    status: 'draft',
    route_data: {} as Database['public']['Tables']['day_plans']['Insert']['route_data'],
    total_distance_miles: 0,
    estimated_duration_minutes: 0,
    metadata: {} as Database['public']['Tables']['day_plans']['Insert']['metadata'],
    ...overrides,
  };

  const { data, error } = await supabase
    .from('day_plans')
    .insert<Database['public']['Tables']['day_plans']['Insert']>(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Gets the test supabase client (with service role)
 */
export function getTestSupabaseClient() {
  return supabase;
}

/**
 * Convenience function to setup and cleanup for a test suite
 */
export function useTestDatabase() {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  return {
    testIds: TEST_IDS,
    supabase,
    createTestDayPlan,
  };
}

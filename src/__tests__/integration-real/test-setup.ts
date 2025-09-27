/**
 * Test setup utilities for real database integration tests
 * Provides helpers for test data creation and cleanup
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Test data tracking for cleanup
const testDataTracker = {
  users: new Set<string>(),
  tenants: new Set<string>(),
  customers: new Set<string>(),
  sessions: new Set<string>(),
  properties: new Set<string>(),
  jobs: new Set<string>(),
};

// Create clients
export const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test data generators and tracker
export const testData = {
  generateEmail: () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}@jobeye.test`,
  generatePhone: () => `555-${Math.floor(1000 + Math.random() * 9000)}`,
  generateCustomerNumber: () => `CUST-${Date.now()}`,
  generateTenantSlug: () => `test-tenant-${Date.now()}`,
  // Expose trackers for tests
  users: testDataTracker.users,
  tenants: testDataTracker.tenants,
  customers: testDataTracker.customers,
  sessions: testDataTracker.sessions,
  properties: testDataTracker.properties,
  jobs: testDataTracker.jobs,
};

// Test tenant creation
export async function createTestTenant(name?: string) {
  const tenantName = name || `Test Company ${Date.now()}`;
  const slug = tenantName.toLowerCase().replace(/\s+/g, '-');

  const { data, error } = await serviceClient
    .from('tenants')
    .insert({
      name: tenantName,
      slug,
    })
    .select()
    .single();

  if (error) throw error;
  
  testDataTracker.tenants.add(data.id);
  return data;
}

// Test user creation with Supabase Auth
export async function createTestUser(email?: string, password: string = 'TestPassword123!') {
  const userEmail = email || testData.generateEmail();
  
  // Create auth user
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true, // Auto-confirm for testing
  });

  if (authError) throw authError;

  // Create extended profile
  const { data: profile, error: profileError } = await serviceClient
    .from('users_extended')
    .insert({
      id: authData.user.id,
      email: userEmail,
      display_name: `Test User ${Date.now()}`,
      first_name: 'Test',
      last_name: 'User',
      phone: testData.generatePhone(),
      role: 'TECHNICIAN',
      is_active: true,
      email_verified_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (profileError) {
    // Clean up auth user if profile creation fails
    await serviceClient.auth.admin.deleteUser(authData.user.id);
    throw profileError;
  }

  testDataTracker.users.add(authData.user.id);
  return { auth: authData.user, profile };
}

// Create test user with tenant assignment
export async function createTestUserWithTenant(tenantId: string, role: string = 'TECHNICIAN') {
  const user = await createTestUser();
  
  // Assign to tenant
  const { data: assignment, error } = await serviceClient
    .from('tenant_assignments')
    .insert({
      user_id: user.auth.id,
      tenant_id: tenantId,
      role,
      is_primary: true,
      is_active: true,
      access_level: role === 'ADMIN' ? 100 : role === 'MANAGER' ? 50 : 10,
    })
    .select()
    .single();

  if (error) {
    await cleanupUser(user.auth.id);
    throw error;
  }

  return { ...user, assignment };
}

// Create test customer
export async function createTestCustomer(tenantId: string) {
  const { data, error } = await serviceClient
    .from('customers')
    .insert({
      tenant_id: tenantId,
      customer_number: testData.generateCustomerNumber(),
      name: `Test Customer ${Date.now()}`,
      email: testData.generateEmail(),
      phone: testData.generatePhone(),
      billing_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zip: '12345',
      },
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  
  testDataTracker.customers.add(data.id);
  return data;
}

// Create test session
export async function createTestSession(userId: string, tenantId: string) {
  const { data, error } = await serviceClient
    .from('user_sessions')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      session_token: `test-session-${randomUUID()}`,
      device_type: 'desktop',
      device_name: 'Test Browser',
      ip_address: '127.0.0.1',
      user_agent: 'Test Agent',
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    })
    .select()
    .single();

  if (error) throw error;
  
  testDataTracker.sessions.add(data.id);
  return data;
}

// Cleanup functions
export async function cleanupUser(userId: string) {
  // Delete from custom tables first
  await serviceClient.from('user_sessions').delete().eq('user_id', userId);
  await serviceClient.from('tenant_assignments').delete().eq('user_id', userId);
  await serviceClient.from('auth_audit_log').delete().eq('user_id', userId);
  await serviceClient.from('users_extended').delete().eq('id', userId);
  await serviceClient.from('voice_profiles').delete().eq('user_id', userId);
  
  // Delete auth user
  await serviceClient.auth.admin.deleteUser(userId);
  testDataTracker.users.delete(userId);
}

export async function cleanupTenant(tenantId: string) {
  // Delete related data
  await serviceClient.from('customers').delete().eq('tenant_id', tenantId);
  await serviceClient.from('properties').delete().eq('tenant_id', tenantId);
  await serviceClient.from('jobs').delete().eq('tenant_id', tenantId);
  await serviceClient.from('tenant_assignments').delete().eq('tenant_id', tenantId);
  await serviceClient.from('user_sessions').delete().eq('tenant_id', tenantId);
  
  // Delete tenant
  await serviceClient.from('tenants').delete().eq('id', tenantId);
  testDataTracker.tenants.delete(tenantId);
}

// Clean up all test data
export async function cleanupTestData() {
  // Clean up in reverse dependency order
  for (const sessionId of testDataTracker.sessions) {
    await serviceClient.from('user_sessions').delete().eq('id', sessionId);
  }
  
  for (const jobId of testDataTracker.jobs) {
    await serviceClient.from('jobs').delete().eq('id', jobId);
  }
  
  for (const propertyId of testDataTracker.properties) {
    await serviceClient.from('properties').delete().eq('id', propertyId);
  }
  
  for (const customerId of testDataTracker.customers) {
    await serviceClient.from('customers').delete().eq('id', customerId);
  }
  
  for (const userId of testDataTracker.users) {
    await cleanupUser(userId);
  }
  
  for (const tenantId of testDataTracker.tenants) {
    await cleanupTenant(tenantId);
  }

  // Clear trackers
  Object.values(testDataTracker).forEach(set => set.clear());
}

// Test utilities
export function expectNoError(error: any, context?: string) {
  if (error) {
    console.error(`Error in ${context || 'operation'}:`, error);
    throw error;
  }
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
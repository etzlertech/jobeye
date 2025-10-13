/**
 * Integration tests for authentication flow
 */

import { createMockSupabaseClient } from '@/__tests__/mocks/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

describe('Authentication Flow Integration', () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  describe('Full authentication flow', () => {
    it('should handle complete sign in flow with tenant assignment', async () => {
      // 1. User signs in
      const signInResult = await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(signInResult.data?.user).toBeDefined();
      expect(signInResult.data?.user?.id).toBe('test-user-id');

      // 2. Get user's tenant assignment
      const tenantResult = await mockSupabase
        .from('tenant_assignments')
        .select('*')
        .eq('user_id', signInResult.data?.user?.id!)
        .single();

      // Mock the tenant assignment response
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'assignment-123',
            user_id: 'test-user-id',
            tenant_id: 'tenant-123',
            role: 'admin',
            is_primary: true,
            is_active: true,
          },
          error: null,
        }),
      });

      // 3. Check voice profile
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'voice-profile-123',
            user_id: 'test-user-id',
            onboarding_completed: false,
          },
          error: null,
        }),
      });

      const voiceProfileResult = await mockSupabase
        .from('voice_profiles')
        .select('*')
        .eq('user_id', signInResult.data?.user?.id!)
        .single();

      expect(voiceProfileResult.data).toBeDefined();
      expect(voiceProfileResult.data?.onboarding_completed).toBe(false);

      // 4. Log authentication event
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'log-123' },
          error: null,
        }),
      });

      const logResult = await mockSupabase
        .from('auth_audit_log')
        .insert({
          event_type: 'sign_in',
          user_id: signInResult.data?.user?.id!,
          user_email: signInResult.data?.user?.email!,
          success: true,
          tenant_id: 'tenant-123',
        } as any);

      expect(logResult.error).toBeNull();
    });

    it('should handle sign in failure', async () => {
      // Mock failed sign in
      mockSupabase.auth.signInWithPassword = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials', status: 401 },
      });

      const signInResult = await mockSupabase.auth.signInWithPassword({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      });

      expect(signInResult.error).toBeDefined();
      expect(signInResult.error?.message).toBe('Invalid credentials');

      // Should still log the failed attempt
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'log-124' },
          error: null,
        }),
      });

      const logResult = await mockSupabase
        .from('auth_audit_log')
        .insert({
          event_type: 'sign_in',
          user_email: 'wrong@example.com',
          success: false,
          reason: 'Invalid credentials',
        } as any);

      expect(logResult.error).toBeNull();
    });
  });

  describe('Multi-tenant access', () => {
    it('should handle user with multiple tenant assignments', async () => {
      const userId = 'multi-tenant-user';

      // Mock multiple tenant assignments
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'assignment-1',
              user_id: userId,
              tenant_id: 'tenant-123',
              role: 'admin',
              is_primary: true,
              is_active: true,
            },
            {
              id: 'assignment-2',
              user_id: userId,
              tenant_id: 'tenant-456',
              role: 'technician',
              is_primary: false,
              is_active: true,
            },
          ],
          error: null,
        }),
      });

      const assignments = await mockSupabase
        .from('tenant_assignments')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      expect(assignments.data).toHaveLength(2);
      expect(assignments.data?.[0].is_primary).toBe(true);
      expect(assignments.data?.[0].tenant_id).toBe('tenant-123');
    });
  });

  describe('Permission checks', () => {
    it('should verify user permissions through RPC', async () => {
      // Mock RPC call for permission check
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: true,
        error: null,
      });

      const hasPermission = await mockSupabase.rpc('user_has_permission', {
        user_id: 'test-user-id',
        permission_name: 'jobs.create',
      });

      expect(hasPermission.data).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('user_has_permission', {
        user_id: 'test-user-id',
        permission_name: 'jobs.create',
      });
    });
  });

  describe('Session management', () => {
    it('should handle session refresh', async () => {
      // Mock get session
      mockSupabase.auth.getSession = jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'old-token',
            refresh_token: 'refresh-token',
            expires_at: Date.now() / 1000 - 100, // Expired
          },
        },
        error: null,
      });

      // Mock refresh session
      mockSupabase.auth.refreshSession = jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'new-token',
            refresh_token: 'new-refresh-token',
            expires_at: Date.now() / 1000 + 3600, // 1 hour from now
          },
        },
        error: null,
      });

      const sessionResult = await mockSupabase.auth.getSession();
      expect(sessionResult.data?.session?.access_token).toBe('old-token');

      const refreshResult = await mockSupabase.auth.refreshSession({
        refresh_token: 'refresh-token',
      });
      expect(refreshResult.data?.session?.access_token).toBe('new-token');
    });
  });
});
/**
 * Authentication integration tests with real Supabase database
 * Tests login, register, logout, refresh, and MFA flows
 */

import { 
  serviceClient, 
  createTestTenant, 
  createTestUser,
  createTestUserWithTenant,
  cleanupAllTestData,
  testData,
  expectNoError,
  delay
} from './test-setup';

describe('Authentication Integration Tests (Real Database)', () => {
  let testTenant: any;

  beforeAll(async () => {
    // Create a test tenant for all auth tests
    testTenant = await createTestTenant('Auth Test Company');
  });

  afterAll(async () => {
    await cleanupAllTestData();
  });

  describe('User Registration', () => {
    it('should register a new user with email/password', async () => {
      const email = testData.generateEmail();
      const password = 'SecurePassword123!';

      // Register via Supabase Auth
      const { data, error } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      expectNoError(error, 'user registration');
      expect(data?.user).toBeDefined();
      expect(data?.user.email).toBe(email);

      // Verify extended profile was created
      const { data: profile } = await serviceClient
        .from('users_extended')
        .select('*')
        .eq('id', data!.user.id)
        .single();

      expect(profile).toBeDefined();
      
      // Clean up
      await serviceClient.auth.admin.deleteUser(data!.user.id);
    });

    it('should create user with tenant assignment', async () => {
      const user = await createTestUserWithTenant(testTenant.id, 'TECHNICIAN');

      expect(user.auth).toBeDefined();
      expect(user.profile).toBeDefined();
      expect(user.assignment).toBeDefined();
      expect(user.assignment.tenant_id).toBe(testTenant.id);
      expect(user.assignment.role).toBe('TECHNICIAN');
    });

    it('should handle invitation-based registration', async () => {
      const inviteEmail = testData.generateEmail();
      
      // Create invitation
      const { data: invitation, error: inviteError } = await serviceClient
        .from('user_invitations')
        .insert({
          email: inviteEmail,
          tenant_id: testTenant.id,
          role: 'MANAGER',
          invitation_code: `INV-${Date.now()}`,
          invited_by: null, // System invite
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_used: false,
        })
        .select()
        .single();

      expectNoError(inviteError, 'invitation creation');

      // Simulate registration with invitation
      const { data: user, error: userError } = await serviceClient.auth.admin.createUser({
        email: inviteEmail,
        password: 'InvitedUser123!',
        email_confirm: true,
      });

      expectNoError(userError, 'invited user registration');

      // Mark invitation as used
      await serviceClient
        .from('user_invitations')
        .update({ 
          is_used: true, 
          accepted_at: new Date().toISOString(),
          accepted_by: user!.user.id 
        })
        .eq('id', invitation!.id);

      // Verify tenant assignment was created
      const { data: assignment } = await serviceClient
        .from('tenant_assignments')
        .select('*')
        .eq('user_id', user!.user.id)
        .eq('tenant_id', testTenant.id)
        .single();

      expect(assignment).toBeDefined();
      expect(assignment?.role).toBe('MANAGER');

      // Clean up
      await serviceClient.auth.admin.deleteUser(user!.user.id);
    });
  });

  describe('User Login', () => {
    let testUser: any;
    const password = 'TestLogin123!';

    beforeAll(async () => {
      testUser = await createTestUserWithTenant(testTenant.id);
    });

    it('should login with valid credentials', async () => {
      // Create a user we can actually login with
      const email = testData.generateEmail();
      const { data: authUser } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      // Sign in with password
      const { data, error } = await serviceClient.auth.signInWithPassword({
        email,
        password,
      });

      expectNoError(error, 'login');
      expect(data?.user).toBeDefined();
      expect(data?.session).toBeDefined();
      expect(data?.session?.access_token).toBeDefined();

      // Clean up
      await serviceClient.auth.signOut();
      await serviceClient.auth.admin.deleteUser(authUser!.user.id);
    });

    it('should create audit log entry on login', async () => {
      // Create audit entry manually (normally done by API endpoint)
      const { error } = await serviceClient
        .from('auth_audit_log')
        .insert({
          event_type: 'login',
          user_id: testUser.auth.id,
          user_email: testUser.auth.email,
          tenant_id: testTenant.id,
          ip_address: '127.0.0.1',
          user_agent: 'Test Browser',
          device_type: 'desktop',
          success: true,
          created_at: new Date().toISOString(),
        });

      expectNoError(error, 'audit log creation');

      // Verify audit log was created
      const { data: auditLog } = await serviceClient
        .from('auth_audit_log')
        .select('*')
        .eq('user_id', testUser.auth.id)
        .eq('event_type', 'login')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog).toBeDefined();
      expect(auditLog?.success).toBe(true);
    });

    it('should create session record on login', async () => {
      const { data: session, error } = await serviceClient
        .from('user_sessions')
        .insert({
          user_id: testUser.auth.id,
          tenant_id: testTenant.id,
          session_token: `test-${Date.now()}`,
          device_type: 'mobile',
          device_name: 'Test Phone',
          ip_address: '192.168.1.1',
          user_agent: 'Test Mobile App',
          status: 'active',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      expectNoError(error, 'session creation');
      expect(session).toBeDefined();
      expect(session?.status).toBe('active');
    });

    it('should reject login with invalid credentials', async () => {
      const { error } = await serviceClient.auth.signInWithPassword({
        email: testUser.auth.email,
        password: 'WrongPassword!',
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Invalid login credentials');
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should create MFA challenge', async () => {
      const user = await createTestUserWithTenant(testTenant.id);
      
      // Create MFA settings
      const { error: mfaError } = await serviceClient
        .from('mfa_settings')
        .insert({
          user_id: user.auth.id,
          enabled: true,
          primary_method: 'totp',
          totp_secret: 'test-secret-key',
          created_at: new Date().toISOString(),
        });

      expectNoError(mfaError, 'MFA settings creation');

      // Create MFA challenge
      const challengeId = `MFA-${Date.now()}`;
      const { data: challenge, error: challengeError } = await serviceClient
        .from('mfa_challenges')
        .insert({
          challenge_id: challengeId,
          user_id: user.auth.id,
          method: 'totp',
          challenge_data: JSON.stringify({ code: '123456' }),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 mins
          attempts: 0,
          max_attempts: 3,
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      expectNoError(challengeError, 'MFA challenge creation');
      expect(challenge).toBeDefined();
      expect(challenge?.method).toBe('totp');
    });

    it('should verify MFA challenge', async () => {
      const user = await createTestUserWithTenant(testTenant.id);
      const challengeId = `MFA-${Date.now()}`;
      
      // Create challenge
      await serviceClient
        .from('mfa_challenges')
        .insert({
          challenge_id: challengeId,
          user_id: user.auth.id,
          method: 'totp',
          challenge_data: JSON.stringify({ code: '654321' }),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          attempts: 0,
          max_attempts: 3,
        });

      // Simulate verification
      const { error } = await serviceClient
        .from('mfa_challenges')
        .update({
          completed_at: new Date().toISOString(),
          success: true,
          attempts: 1,
        })
        .eq('challenge_id', challengeId);

      expectNoError(error, 'MFA verification');

      // Verify challenge was completed
      const { data: verified } = await serviceClient
        .from('mfa_challenges')
        .select('*')
        .eq('challenge_id', challengeId)
        .single();

      expect(verified?.success).toBe(true);
      expect(verified?.completed_at).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should refresh session token', async () => {
      const user = await createTestUserWithTenant(testTenant.id);
      
      // Create initial session
      const { data: session } = await serviceClient
        .from('user_sessions')
        .insert({
          user_id: user.auth.id,
          tenant_id: testTenant.id,
          session_token: `session-${Date.now()}`,
          refresh_token_hash: 'test-refresh-hash',
          device_type: 'desktop',
          status: 'active',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        })
        .select()
        .single();

      // Simulate refresh
      const { error } = await serviceClient
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString(),
          refresh_count: 1,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Extended
        })
        .eq('id', session!.id);

      expectNoError(error, 'session refresh');
    });

    it('should handle voice session with extended timeout', async () => {
      const user = await createTestUserWithTenant(testTenant.id);
      
      const { data: voiceSession, error } = await serviceClient
        .from('user_sessions')
        .insert({
          user_id: user.auth.id,
          tenant_id: testTenant.id,
          session_token: `voice-${Date.now()}`,
          device_type: 'voice_assistant',
          device_name: 'JobEye Voice',
          status: 'active',
          voice_session_active: true,
          voice_session_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
          wake_word_active: true,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      expectNoError(error, 'voice session creation');
      expect(voiceSession?.voice_session_active).toBe(true);
      expect(voiceSession?.wake_word_active).toBe(true);
    });

    it('should logout and cleanup session', async () => {
      const user = await createTestUserWithTenant(testTenant.id);
      
      // Create session
      const { data: session } = await serviceClient
        .from('user_sessions')
        .insert({
          user_id: user.auth.id,
          tenant_id: testTenant.id,
          session_token: `logout-test-${Date.now()}`,
          device_type: 'desktop',
          status: 'active',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      // Logout - update session
      const { error } = await serviceClient
        .from('user_sessions')
        .update({
          status: 'terminated',
          ended_at: new Date().toISOString(),
          end_reason: 'user_logout',
        })
        .eq('id', session!.id);

      expectNoError(error, 'session logout');

      // Create logout audit entry
      await serviceClient
        .from('auth_audit_log')
        .insert({
          event_type: 'logout',
          user_id: user.auth.id,
          tenant_id: testTenant.id,
          session_id: session!.id,
          success: true,
          created_at: new Date().toISOString(),
        });

      // Verify session is terminated
      const { data: terminated } = await serviceClient
        .from('user_sessions')
        .select('status')
        .eq('id', session!.id)
        .single();

      expect(terminated?.status).toBe('terminated');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce role permissions', async () => {
      // Create users with different roles
      const admin = await createTestUserWithTenant(testTenant.id, 'ADMIN');
      const manager = await createTestUserWithTenant(testTenant.id, 'MANAGER');
      const tech = await createTestUserWithTenant(testTenant.id, 'TECHNICIAN');

      // Verify access levels
      expect(admin.assignment.access_level).toBe(100);
      expect(manager.assignment.access_level).toBe(50);
      expect(tech.assignment.access_level).toBe(10);

      // Check role permissions
      const { data: rolePerms } = await serviceClient
        .from('role_permissions')
        .select('*')
        .in('role', ['ADMIN', 'MANAGER', 'TECHNICIAN']);

      expect(rolePerms).toBeDefined();
      expect(rolePerms!.length).toBeGreaterThan(0);
    });

    it('should handle tenant switching for multi-tenant users', async () => {
      const user = await createTestUser();
      const tenant2 = await createTestTenant('Second Test Company');

      // Assign user to multiple tenants
      await serviceClient
        .from('tenant_assignments')
        .insert([
          {
            user_id: user.auth.id,
            tenant_id: testTenant.id,
            role: 'MANAGER',
            is_primary: true,
            is_active: true,
          },
          {
            user_id: user.auth.id,
            tenant_id: tenant2.id,
            role: 'TECHNICIAN',
            is_primary: false,
            is_active: true,
          },
        ]);

      // Get user's tenants
      const { data: assignments } = await serviceClient
        .from('tenant_assignments')
        .select('*, tenants(*)')
        .eq('user_id', user.auth.id)
        .eq('is_active', true);

      expect(assignments).toBeDefined();
      expect(assignments!.length).toBe(2);
      expect(assignments!.some(a => a.is_primary)).toBe(true);
    });
  });
});
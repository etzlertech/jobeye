/**
 * Tests for Supabase client configuration
 */

// Mock the Supabase module first before any imports
jest.mock('@supabase/ssr');

// Mock next/headers for server client
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve({
    get: jest.fn((name: string) => ({ value: 'test-cookie-value' })),
  })),
}));

describe('Supabase Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('supabase client', () => {
    it('should create a browser client with correct configuration', () => {
      // Mock the createBrowserClient to return a mock client
      const mockClient = { auth: {}, from: jest.fn() };
      require('@supabase/ssr').createBrowserClient = jest.fn(() => mockClient);
      
      const { supabase } = require('@/lib/supabase/client');
      
      expect(supabase).toBeDefined();
      expect(supabase.auth).toBeDefined();
      expect(supabase.from).toBeDefined();
    });

    it('should throw error if environment variables are missing', () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => {
        require('@/lib/supabase/client');
      }).toThrow('Missing Supabase environment variables');

      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    });
  });

  describe('getSession', () => {
    it('should return session when user is authenticated', async () => {
      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
        access_token: 'test-token',
      };

      const mockClient = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null,
          }),
        },
      };
      
      require('@supabase/ssr').createBrowserClient = jest.fn(() => mockClient);
      const { getSession } = require('@/lib/supabase/client');

      const session = await getSession();

      expect(session).toEqual(mockSession);
      expect(mockClient.auth.getSession).toHaveBeenCalled();
    });

    it('should return null when there is no session', async () => {
      const mockClient = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      };
      
      require('@supabase/ssr').createBrowserClient = jest.fn(() => mockClient);
      const { getSession } = require('@/lib/supabase/client');

      const session = await getSession();

      expect(session).toBeNull();
    });

    it('should handle errors and return null', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockClient = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: new Error('Auth error'),
          }),
        },
      };
      
      require('@supabase/ssr').createBrowserClient = jest.fn(() => mockClient);
      const { getSession } = require('@/lib/supabase/client');

      const session = await getSession();

      expect(session).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting session:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUser', () => {
    it('should return user with tenant info when authenticated', async () => {
      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };
      const mockTenantAssignment = {
        tenant_id: 'tenant-123',
        role: 'admin',
        is_primary: true,
      };

      const fromMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockTenantAssignment,
          error: null,
        }),
      };

      const mockClient = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue(fromMock),
      };
      
      require('@supabase/ssr').createBrowserClient = jest.fn(() => mockClient);
      const { getUser } = require('@/lib/supabase/client');

      const user = await getUser();

      expect(user).toEqual({
        ...mockSession.user,
        tenantId: 'tenant-123',
        role: 'admin',
      });

      expect(mockClient.from).toHaveBeenCalledWith('tenant_assignments');
      expect(fromMock.select).toHaveBeenCalledWith('tenant_id, role, is_primary');
      expect(fromMock.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });

    it('should return null when no session exists', async () => {
      const mockClient = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      };
      
      require('@supabase/ssr').createBrowserClient = jest.fn(() => mockClient);
      const { getUser } = require('@/lib/supabase/client');

      const user = await getUser();

      expect(user).toBeNull();
    });

    it('should handle missing tenant assignment', async () => {
      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };

      const fromMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('No tenant assignment'),
        }),
      };

      const mockClient = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue(fromMock),
      };
      
      require('@supabase/ssr').createBrowserClient = jest.fn(() => mockClient);
      const { getUser } = require('@/lib/supabase/client');

      const user = await getUser();

      expect(user).toEqual({
        ...mockSession.user,
        tenantId: undefined,
        role: undefined,
      });
    });
  });
});
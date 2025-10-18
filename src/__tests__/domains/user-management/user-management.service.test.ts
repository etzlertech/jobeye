/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/domains/user-management/user-management.service.test.ts
 * phase: 2
 * domain: user-management
 * purpose: Unit tests for UserManagementService business logic
 * spec_ref: docs/PLAN-USER-MANAGEMENT-WITH-IMAGES.md#phase-3-domain-layer-day-2-morning
 * coverage_target: 90
 */

import { AppError } from '@/core/errors/error-types';
import { UserManagementService } from '@/domains/user-management/services/user.service';
import type { RequestContext } from '@/lib/auth/context';

const listUsersMock = jest.fn();
const getUserByIdMock = jest.fn();
const updateUserMock = jest.fn();
const updateUserImagesMock = jest.fn();
const getUserByIdAdminMock = jest.fn();

jest.mock('@/domains/user-management/repositories/user.repository', () => ({
  UserRepository: jest.fn().mockImplementation(() => ({
    listUsers: listUsersMock,
    getUserById: getUserByIdMock,
    updateUser: updateUserMock,
    updateUserImages: updateUserImagesMock
  }))
}));

jest.mock('@/lib/supabase/server', () => {
  const original = jest.requireActual('@/lib/supabase/server');
  return {
    ...original,
    createServiceClient: jest.fn(() => ({
      auth: {
        admin: {
          getUserById: getUserByIdAdminMock
        }
      }
    }))
  };
});

const mockSupabaseClient = {} as any;

const supervisorContext: RequestContext = {
  tenantId: 'tenant-123',
  roles: ['supervisor'],
  source: 'session',
  userId: 'user-123',
  isSupervisor: true,
  isCrew: false
} as RequestContext;

const nonSupervisorContext: RequestContext = {
  tenantId: 'tenant-123',
  roles: ['technician'],
  source: 'session',
  userId: 'user-crew',
  isSupervisor: false,
  isCrew: true
} as RequestContext;

describe('UserManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('returns mapped user list with emails and image URLs', async () => {
      listUsersMock.mockResolvedValue({
        rows: [
          {
            id: 'user-1',
            display_name: 'Crew Alpha',
            first_name: 'Crew',
            last_name: 'Alpha',
            email_verified_at: null,
            phone_verified_at: null,
            phone: '555-1111',
            role: 'technician',
            is_active: true,
            primary_image_url: 'https://bucket/full.jpg',
            medium_url: 'https://bucket/medium.jpg',
            thumbnail_url: 'https://bucket/thumb.jpg',
            avatar_url: null,
            last_login_at: '2025-01-01T00:00:00Z',
            created_at: '2024-12-01T00:00:00Z',
            updated_at: '2024-12-20T00:00:00Z',
            tenant_id: 'tenant-123',
            timezone: 'UTC',
            preferred_language: 'en-US',
            metadata: null,
            failed_login_attempts: 0,
            marketing_consent: null,
            two_factor_enabled: null,
            locked_until: null,
            password_changed_at: null,
            terms_accepted_at: null,
            privacy_policy_accepted_at: null
          }
        ],
        total: 1
      });

      getUserByIdAdminMock.mockResolvedValue({
        data: { user: { email: 'crew.alpha@example.com' } }
      });

      const service = new UserManagementService(mockSupabaseClient);

      const result = await service.listUsers(supervisorContext, {
        role: 'technician',
        status: 'active',
        limit: 10,
        offset: 0
      });

      expect(listUsersMock).toHaveBeenCalledWith(supervisorContext, {
        role: 'technician',
        status: 'active',
        limit: 10,
        offset: 0
      });

      expect(result).toEqual({
        users: [
          {
            id: 'user-1',
            displayName: 'Crew Alpha',
            firstName: 'Crew',
            lastName: 'Alpha',
            email: 'crew.alpha@example.com',
            phone: '555-1111',
            role: 'technician',
            isActive: true,
            primaryImageUrl: 'https://bucket/full.jpg',
            mediumImageUrl: 'https://bucket/medium.jpg',
            thumbnailImageUrl: 'https://bucket/thumb.jpg',
            lastLoginAt: '2025-01-01T00:00:00Z',
            createdAt: '2024-12-01T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z'
          }
        ],
        total: 1,
        hasMore: false,
        limit: 10,
        offset: 0
      });
    });

    it('throws when context is not supervisor', async () => {
      const service = new UserManagementService(mockSupabaseClient);
      await expect(
        service.listUsers(nonSupervisorContext, {})
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('getUser', () => {
    it('returns null when repository returns nothing', async () => {
      getUserByIdMock.mockResolvedValue(null);
      const service = new UserManagementService(mockSupabaseClient);
      const user = await service.getUser(supervisorContext, 'user-missing');
      expect(user).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('returns updated user and fetches email', async () => {
      updateUserMock.mockResolvedValue({
        id: 'user-1',
        display_name: 'Crew Beta',
        first_name: 'Crew',
        last_name: 'Beta',
        phone: '555-2222',
        role: 'technician',
        is_active: true,
        primary_image_url: null,
        medium_url: null,
        thumbnail_url: null,
        avatar_url: null,
        last_login_at: null,
        created_at: '2025-01-05T00:00:00Z',
        updated_at: '2025-01-06T00:00:00Z',
        tenant_id: 'tenant-123',
        timezone: 'UTC',
        preferred_language: 'en-US',
        metadata: null,
        email_verified_at: null,
        phone_verified_at: null,
        password_changed_at: null,
        terms_accepted_at: null,
        privacy_policy_accepted_at: null,
        marketing_consent: null,
        two_factor_enabled: null,
        failed_login_attempts: 0,
        locked_until: null
      });
      getUserByIdAdminMock.mockResolvedValue({
        data: { user: { email: 'crew.beta@example.com' } }
      });

      const service = new UserManagementService(mockSupabaseClient);
      const updated = await service.updateUser(supervisorContext, 'user-1', {
        display_name: 'Crew Beta'
      });

      expect(updated?.email).toBe('crew.beta@example.com');
      expect(updateUserMock).toHaveBeenCalledWith(supervisorContext, 'user-1', {
        display_name: 'Crew Beta'
      });
    });
  });

  describe('updateUserImages', () => {
    it('maps response after repository update', async () => {
      updateUserImagesMock.mockResolvedValue({
        id: 'user-1',
        display_name: 'Crew Gamma',
        first_name: 'Crew',
        last_name: 'Gamma',
        phone: null,
        role: 'technician',
        is_active: true,
        primary_image_url: 'https://bucket/full-new.jpg',
        medium_url: 'https://bucket/medium-new.jpg',
        thumbnail_url: 'https://bucket/thumb-new.jpg',
        avatar_url: null,
        last_login_at: null,
        created_at: '2025-01-05T00:00:00Z',
        updated_at: '2025-01-07T00:00:00Z',
        tenant_id: 'tenant-123',
        timezone: null,
        preferred_language: null,
        metadata: null,
        email_verified_at: null,
        phone_verified_at: null,
        password_changed_at: null,
        terms_accepted_at: null,
        privacy_policy_accepted_at: null,
        marketing_consent: null,
        two_factor_enabled: null,
        failed_login_attempts: 0,
        locked_until: null
      });

      getUserByIdAdminMock.mockResolvedValue({
        data: { user: { email: 'crew.gamma@example.com' } }
      });

      const service = new UserManagementService(mockSupabaseClient);
      const updated = await service.updateUserImages(supervisorContext, 'user-1', {
        primaryImageUrl: 'https://bucket/full-new.jpg',
        mediumImageUrl: 'https://bucket/medium-new.jpg',
        thumbnailImageUrl: 'https://bucket/thumb-new.jpg'
      });

      expect(updateUserImagesMock).toHaveBeenCalledWith(
        supervisorContext,
        'user-1',
        {
          primaryImageUrl: 'https://bucket/full-new.jpg',
          mediumImageUrl: 'https://bucket/medium-new.jpg',
          thumbnailImageUrl: 'https://bucket/thumb-new.jpg'
        }
      );
      expect(updated?.primaryImageUrl).toBe('https://bucket/full-new.jpg');
    });
  });
});

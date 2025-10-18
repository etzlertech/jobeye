/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/api/supervisor-users.api.test.ts
 * phase: 2
 * domain: user-management
 * purpose: Contract tests for supervisor user management API routes
 * spec_ref: docs/PLAN-USER-MANAGEMENT-WITH-IMAGES.md#phase-2-backend-api-routes-day-1-afternoon
 * coverage_target: 0 (initial failing tests for TDD)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/lib/auth/context';

if (typeof Response !== 'undefined' && typeof (Response as any).json !== 'function') {
  (Response as any).json = (data: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {})
      },
      ...init
    });
}

const getRequestContextMock = jest.fn();

jest.mock('@/lib/auth/context', () => {
  const actual = jest.requireActual('@/lib/auth/context');
  return {
    ...actual,
    getRequestContext: getRequestContextMock
  };
});

const createClientMock = jest.fn();
const createServiceClientMock = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  createServiceClient: createServiceClientMock
}));

const dataUrlToBlobMock = jest.fn(() => new Blob());

jest.mock('@/utils/image-processor', () => ({
  ItemImageProcessor: {
    dataUrlToBlob: dataUrlToBlobMock
  }
}));

const listUsersMock = jest.fn();
const getUserMock = jest.fn();
const updateUserMock = jest.fn();
const updateUserImagesMock = jest.fn();

jest.mock('@/domains/user-management/services/user.service', () => ({
  UserManagementService: jest.fn().mockImplementation(() => ({
    listUsers: listUsersMock,
    getUser: getUserMock,
    updateUser: updateUserMock,
    updateUserImages: updateUserImagesMock
  }))
}));

const supervisorContext: RequestContext = {
  tenantId: 'tenant-123',
  roles: ['supervisor'],
  source: 'session',
  userId: 'user-super',
  isSupervisor: true,
  isCrew: false
} as RequestContext;

const buildRequest = (url: string, init?: RequestInit): NextRequest =>
  new Request(url, init) as unknown as NextRequest;

describe('Supervisor user APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  describe('GET /api/supervisor/users', () => {
    it('returns user list payload', async () => {
      getRequestContextMock.mockResolvedValue(supervisorContext);
      listUsersMock.mockResolvedValue({
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
            lastLoginAt: null,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-02T00:00:00Z'
          }
        ],
        total: 1,
        hasMore: false,
        limit: 20,
        offset: 0
      });

      const { GET } = await import('@/app/api/supervisor/users/route');
      const response = await GET(buildRequest('https://example.com/api/supervisor/users'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.users).toHaveLength(1);
      expect(listUsersMock).toHaveBeenCalled();
    });

    it('rejects non-supervisors', async () => {
      getRequestContextMock.mockResolvedValue({
        ...supervisorContext,
        isSupervisor: false,
        roles: ['technician']
      });

      const { GET } = await import('@/app/api/supervisor/users/route');
      const response = await GET(buildRequest('https://example.com/api/supervisor/users'));

      expect(response.status).toBe(403);
      expect(listUsersMock).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/supervisor/users/[userId]', () => {
    it('returns selected user', async () => {
      getRequestContextMock.mockResolvedValue(supervisorContext);
      getUserMock.mockResolvedValue({
        id: 'user-1',
        displayName: 'Crew Alpha',
        firstName: 'Crew',
        lastName: 'Alpha',
        email: 'crew.alpha@example.com',
        phone: '555-1111',
        role: 'technician',
        isActive: true,
        primaryImageUrl: null,
        mediumImageUrl: null,
        thumbnailImageUrl: null,
        lastLoginAt: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        timezone: 'UTC',
        preferredLanguage: 'en-US',
        metadata: null
      });

      const { GET } = await import('@/app/api/supervisor/users/[userId]/route');
      const response = await GET(
        buildRequest('https://example.com/api/supervisor/users/user-1'),
        { params: { userId: 'user-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user.id).toBe('user-1');
      expect(getUserMock).toHaveBeenCalledWith(supervisorContext, 'user-1');
    });

    it('returns 404 when user missing', async () => {
      getRequestContextMock.mockResolvedValue(supervisorContext);
      getUserMock.mockResolvedValue(null);

      const { GET } = await import('@/app/api/supervisor/users/[userId]/route');
      const response = await GET(
        buildRequest('https://example.com/api/supervisor/users/missing'),
        { params: { userId: 'missing' } }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/supervisor/users/[userId]', () => {
    it('updates user record', async () => {
      getRequestContextMock.mockResolvedValue(supervisorContext);
      updateUserMock.mockResolvedValue({
        id: 'user-1',
        displayName: 'Crew Alpha',
        firstName: 'Crew',
        lastName: 'Alpha',
        email: 'crew.alpha@example.com',
        phone: '555-1111',
        role: 'technician',
        isActive: true,
        primaryImageUrl: null,
        mediumImageUrl: null,
        thumbnailImageUrl: null,
        lastLoginAt: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        timezone: 'UTC',
        preferredLanguage: 'en-US',
        metadata: null
      });

      const { PATCH } = await import('@/app/api/supervisor/users/[userId]/route');
      const response = await PATCH(
        buildRequest('https://example.com/api/supervisor/users/user-1', {
          method: 'PATCH',
          body: JSON.stringify({ display_name: 'Crew Alpha' }),
          headers: { 'content-type': 'application/json' }
        }),
        { params: { userId: 'user-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user.displayName).toBe('Crew Alpha');
      expect(updateUserMock).toHaveBeenCalledWith(
        supervisorContext,
        'user-1',
        { display_name: 'Crew Alpha' }
      );
    });
  });

  describe('POST /api/supervisor/users/[userId]/image', () => {
    const storageUploadMock = jest.fn();
    const storageGetPublicUrlMock = jest.fn();

    it('uploads images and returns URLs', async () => {
      createClientMock.mockResolvedValue({});
      createServiceClientMock.mockReturnValue({
        auth: {
          admin: {
            getUserById: jest.fn().mockResolvedValue({ data: { user: { email: 'crew.alpha@example.com' } } })
          }
        },
        storage: {
          from: jest.fn().mockReturnValue({
            upload: storageUploadMock.mockResolvedValue({ error: null }),
            getPublicUrl: storageGetPublicUrlMock
          })
        }
      });

      storageUploadMock.mockResolvedValue({ data: {}, error: null });
      storageGetPublicUrlMock.mockReturnValue({
        data: { publicUrl: 'https://bucket/full.jpg' }
      });

      getRequestContextMock.mockResolvedValue(supervisorContext);
      updateUserImagesMock.mockResolvedValue({
        id: 'user-1',
        displayName: 'Crew Alpha',
        firstName: 'Crew',
        lastName: 'Alpha',
        email: 'crew.alpha@example.com',
        phone: null,
        role: 'technician',
        isActive: true,
        primaryImageUrl: 'https://bucket/full.jpg',
        mediumImageUrl: 'https://bucket/full.jpg',
        thumbnailImageUrl: 'https://bucket/full.jpg',
        lastLoginAt: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        timezone: 'UTC',
        preferredLanguage: 'en-US',
        metadata: null
      });

      const { POST } = await import('@/app/api/supervisor/users/[userId]/image/route');

      const response = await POST(
        buildRequest('https://example.com/api/supervisor/users/user-1/image', {
          method: 'POST',
          body: JSON.stringify({
            images: {
              thumbnail: 'data:image/jpeg;base64,AAA',
              medium: 'data:image/jpeg;base64,BBB',
              full: 'data:image/jpeg;base64,CCC'
            }
          }),
          headers: { 'content-type': 'application/json' }
        }),
        { params: { userId: 'user-1' } }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.imageUrls).toBeDefined();
      expect(updateUserImagesMock).toHaveBeenCalled();
      expect(dataUrlToBlobMock).toHaveBeenCalled();
    });
  });
});

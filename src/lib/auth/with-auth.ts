/**
 * @file with-auth.ts
 * @domain Authentication
 * @purpose Simple auth wrapper for API routes
 */

import { NextRequest, NextResponse } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    company_id: string;
  };
}

export interface User {
  id: string;
  email: string;
  app_metadata?: {
    role?: string;
    crew_id?: string;
    company_id?: string;
  };
}

export type AuthenticatedHandler = (
  user: User,
  tenantId: string
) => Promise<NextResponse>;

/**
 * Simple auth wrapper for API routes
 * For now, this is a stub that passes through all requests
 * In production, this would validate JWT tokens, check permissions, etc.
 */
export function withAuth(
  req: NextRequest,
  handler: AuthenticatedHandler
) {
  return async () => {
    try {
      // For now, create a mock user
      // In production, this would:
      // 1. Extract JWT from Authorization header
      // 2. Validate token with Supabase
      // 3. Get user info and permissions
      // 4. Extract tenant ID from user context
      
      const mockUser: User = {
        id: 'mock-user-id',
        email: 'demo@jobeye.com',
        app_metadata: {
          role: 'crew',
          crew_id: 'mock-crew-id',
          company_id: 'mock-company-id'
        }
      };

      const tenantId = mockUser.app_metadata?.company_id || 'mock-company-id';

      return await handler(mockUser, tenantId);
    } catch (error) {
      console.error('[Auth] Error in withAuth wrapper:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

/**
 * Role-based auth wrapper
 */
export function withRole(allowedRoles: string[]) {
  return function (handler: AuthenticatedHandler) {
    return withAuth(async (req: AuthenticatedRequest, context?: any) => {
      const userRole = req.user?.role;
      
      if (!userRole || !allowedRoles.includes(userRole)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      return await handler(req, context);
    });
  };
}
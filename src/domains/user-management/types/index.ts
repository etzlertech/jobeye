/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/domains/user-management/types/index.ts
 * phase: 2
 * domain: user-management
 * purpose: Shared TypeScript interfaces for user management workflows
 * spec_ref: docs/PLAN-USER-MANAGEMENT-WITH-IMAGES.md
 * complexity_budget: 120
 */

import type { Database } from '@/types/database';

type UsersExtendedRow = Database['public']['Tables']['users_extended']['Row'];

export type UserRole = UsersExtendedRow['role'];

export interface UserListFilters {
  role?: UserRole;
  status?: 'active' | 'inactive' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UserListItem {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  primaryImageUrl: string | null;
  mediumImageUrl: string | null;
  thumbnailImageUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface UserDetail extends UserListItem {
  timezone: string | null;
  preferredLanguage: string | null;
  metadata: UsersExtendedRow['metadata'];
}

export type UpdateUserPayload = Partial<Pick<
  UsersExtendedRow,
  | 'display_name'
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'role'
  | 'timezone'
  | 'preferred_language'
  | 'is_active'
>>;

export interface UpdateUserImagesPayload {
  primaryImageUrl: string | null;
  mediumImageUrl: string | null;
  thumbnailImageUrl: string | null;
}

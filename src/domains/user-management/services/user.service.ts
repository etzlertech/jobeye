/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/domains/user-management/services/user.service.ts
 * phase: 2
 * domain: user-management
 * purpose: Business logic for supervisor user management workflows
 * spec_ref: docs/PLAN-USER-MANAGEMENT-WITH-IMAGES.md#phase-3-domain-layer-day-2-morning
 * complexity_budget: 220
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { RequestContext } from '@/lib/auth/context';
import { AppError, ErrorCode, ErrorSeverity } from '@/core/errors/error-types';
import { UserRepository } from '../repositories/user.repository';
import type {
  UpdateUserImagesPayload,
  UpdateUserPayload,
  UserDetail,
  UserListFilters,
  UserListItem,
  UserListResponse
} from '../types';

export class UserManagementService {
  private readonly repository: UserRepository;
  private serviceClient = createServiceClient();

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.repository = new UserRepository(supabase);
  }

  async listUsers(
    context: RequestContext,
    filters: UserListFilters
  ): Promise<UserListResponse> {
    if (!context.isSupervisor) {
      throw new AppError(
        'Only supervisors can list users',
        ErrorCode.FORBIDDEN,
        ErrorSeverity.MEDIUM
      );
    }

    const result = await this.repository.listUsers(context, filters);
    const emailMap = await this.fetchEmails(result.rows.map((row) => row.id));

    const users: UserListItem[] = result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      firstName: row.first_name,
      lastName: row.last_name,
      email: emailMap[row.id] ?? null,
      phone: row.phone,
      role: row.role,
      isActive: row.is_active ?? true,
      primaryImageUrl: row.primary_image_url ?? row.avatar_url,
      mediumImageUrl: row.medium_url,
      thumbnailImageUrl: row.thumbnail_url,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    return {
      users,
      total: result.total,
      hasMore: offset + users.length < result.total,
      limit,
      offset
    };
  }

  async getUser(
    context: RequestContext,
    userId: string
  ): Promise<UserDetail | null> {
    if (!context.isSupervisor) {
      throw new AppError(
        'Only supervisors can view user details',
        ErrorCode.FORBIDDEN,
        ErrorSeverity.MEDIUM
      );
    }

    const row = await this.repository.getUserById(context, userId);

    if (!row) {
      return null;
    }

    const email = await this.fetchEmail(userId);

    return {
      id: row.id,
      displayName: row.display_name,
      firstName: row.first_name,
      lastName: row.last_name,
      email,
      phone: row.phone,
      role: row.role,
      isActive: row.is_active ?? true,
      primaryImageUrl: row.primary_image_url ?? row.avatar_url,
      mediumImageUrl: row.medium_url,
      thumbnailImageUrl: row.thumbnail_url,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      timezone: row.timezone,
      preferredLanguage: row.preferred_language,
      metadata: row.metadata
    };
  }

  async updateUser(
    context: RequestContext,
    userId: string,
    payload: UpdateUserPayload
  ): Promise<UserDetail | null> {
    if (!context.isSupervisor) {
      throw new AppError(
        'Only supervisors can update users',
        ErrorCode.FORBIDDEN,
        ErrorSeverity.MEDIUM
      );
    }

    const updated = await this.repository.updateUser(context, userId, payload);

    if (!updated) {
      return null;
    }

    const email = await this.fetchEmail(userId);

    return {
      id: updated.id,
      displayName: updated.display_name,
      firstName: updated.first_name,
      lastName: updated.last_name,
      email,
      phone: updated.phone,
      role: updated.role,
      isActive: updated.is_active ?? true,
      primaryImageUrl: updated.primary_image_url ?? updated.avatar_url,
      mediumImageUrl: updated.medium_url,
      thumbnailImageUrl: updated.thumbnail_url,
      lastLoginAt: updated.last_login_at,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      timezone: updated.timezone,
      preferredLanguage: updated.preferred_language,
      metadata: updated.metadata
    };
  }

  async updateUserImages(
    context: RequestContext,
    userId: string,
    payload: UpdateUserImagesPayload
  ): Promise<UserDetail | null> {
    if (!context.isSupervisor) {
      throw new AppError(
        'Only supervisors can update user images',
        ErrorCode.FORBIDDEN,
        ErrorSeverity.MEDIUM
      );
    }

    const updated = await this.repository.updateUserImages(context, userId, payload);

    if (!updated) {
      return null;
    }

    const email = await this.fetchEmail(userId);

    return {
      id: updated.id,
      displayName: updated.display_name,
      firstName: updated.first_name,
      lastName: updated.last_name,
      email,
      phone: updated.phone,
      role: updated.role,
      isActive: updated.is_active ?? true,
      primaryImageUrl: updated.primary_image_url ?? updated.avatar_url,
      mediumImageUrl: updated.medium_url,
      thumbnailImageUrl: updated.thumbnail_url,
      lastLoginAt: updated.last_login_at,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      timezone: updated.timezone,
      preferredLanguage: updated.preferred_language,
      metadata: updated.metadata
    };
  }

  private async fetchEmails(userIds: string[]): Promise<Record<string, string | null>> {
    const uniqueIds = Array.from(new Set(userIds));

    const entries = await Promise.all(
      uniqueIds.map(async (id) => {
        const email = await this.fetchEmail(id);
        return [id, email] as const;
      })
    );

    return Object.fromEntries(entries);
  }

  private async fetchEmail(userId: string): Promise<string | null> {
    try {
      const { data } = await this.serviceClient.auth.admin.getUserById(userId);
      return data?.user?.email ?? null;
    } catch (error) {
      console.error('[UserManagementService] Failed to fetch email from auth.users', {
        userId,
        error
      });
      return null;
    }
  }
}

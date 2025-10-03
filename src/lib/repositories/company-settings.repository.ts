/*
AGENT DIRECTIVE BLOCK
file: /src/lib/repositories/company-settings.repository.ts
purpose: Repository for managing company settings with default creation and scoped updates
spec_ref: data-001-company-settings-schema
exports:
  - CompanySettingsRepository
  - companySettingsRepository
voice_considerations:
  - Ensure voice preferences remain consistent during updates
*/

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { RepositoryError } from './base.repository';
import {
  CompanySettings,
  CompanySettingsRow,
  VisionThresholds,
  mapCompanySettingsRow,
} from '@/domains/company/types/company-settings';

const TABLE_NAME = 'company_settings';

export class CompanySettingsRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}

  async getForCompany(tenantId: string): Promise<CompanySettings | null> {
    try {
      const { data, error } = await this.client
        .from(TABLE_NAME)
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if ((error as any).code === 'PGRST116') {
          return null;
        }

        throw error;
      }

      if (!data) {
        return null;
      }

      return mapCompanySettingsRow(data as CompanySettingsRow);
    } catch (error) {
      throw new RepositoryError(
        'Failed to fetch company settings',
        'READ_ERROR',
        error
      );
    }
  }

  async ensureForCompany(tenantId: string): Promise<CompanySettings> {
    const existing = await this.getForCompany(tenantId);
    if (existing) {
      return existing;
    }

    try {
      const { data, error } = await this.client
        .from(TABLE_NAME)
        .insert({ tenant_id: tenantId })
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('Empty result when inserting company settings');
      }

      return mapCompanySettingsRow(data as CompanySettingsRow);
    } catch (error) {
      throw new RepositoryError(
        'Failed to ensure default company settings',
        'CREATE_ERROR',
        error
      );
    }
  }

  async getForCurrentCompany(): Promise<CompanySettings> {
    const tenantId = await this.getCurrentCompanyId();
    return this.ensureForCompany(tenantId);
  }

  async updateVisionThresholds(tenantId: string, thresholds: VisionThresholds): Promise<CompanySettings> {
    try {
      const { data, error } = await this.client
        .from(TABLE_NAME)
        .update({ vision_thresholds: thresholds })
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('Empty result when updating vision thresholds');
      }

      return mapCompanySettingsRow(data as CompanySettingsRow);
    } catch (error) {
      throw new RepositoryError(
        'Failed to update vision thresholds',
        'UPDATE_ERROR',
        error
      );
    }
  }

  private async getCurrentCompanyId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();

    if (error) {
      throw new RepositoryError('Unable to resolve current user', 'AUTH_ERROR', error);
    }

    const user = data?.user;
    if (!user) {
      throw new RepositoryError('User not authenticated', 'AUTH_ERROR');
    }

    const tenantId = this.extractCompanyIdFromUser(user);
    if (tenantId) {
      return tenantId;
    }

    try {
      const { data: rpcData, error: rpcError } = await this.client
        .rpc('get_user_tenant_id', { user_id: user.id });

      if (!rpcError && rpcData) {
        return rpcData as string;
      }
    } catch (rpcError) {
      // Swallow RPC errors and continue to throw a standardized exception below.
      console.warn('get_user_tenant_id RPC unavailable:', rpcError);
    }

    throw new RepositoryError(
      'Unable to determine company for current user',
      'TENANT_ERROR'
    );
  }

  private extractCompanyIdFromUser(user: User): string | null {
    const userMetadata = user.user_metadata ?? {};
    const appMetadata = user.app_metadata ?? {};

    const rawCompanyId =
      userMetadata.tenant_id ??
      userMetadata.tenant_id ??
      appMetadata.tenant_id ??
      appMetadata.tenant_id;

    return typeof rawCompanyId === 'string' && rawCompanyId.length > 0
      ? rawCompanyId
      : null;
  }
}

export const companySettingsRepository = new CompanySettingsRepository();

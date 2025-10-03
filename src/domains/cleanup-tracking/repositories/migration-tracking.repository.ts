/**
 * @file /src/domains/cleanup-tracking/repositories/migration-tracking.repository.ts
 * @phase 3
 * @domain cleanup-tracking
 * @purpose Repository for tracking table migration progress
 * @complexity_budget 300
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface MigrationTracking {
  id: string;
  table_name: string;
  has_tenant_id: boolean;
  has_tenant_id: boolean;
  row_count: number;
  migration_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  migrated_at?: Date;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMigrationTracking {
  table_name: string;
  has_tenant_id: boolean;
  has_tenant_id: boolean;
  row_count: number;
  migration_status: MigrationTracking['migration_status'];
  error_message?: string;
}

export interface UpdateMigrationTracking {
  has_tenant_id?: boolean;
  has_tenant_id?: boolean;
  row_count?: number;
  migration_status?: MigrationTracking['migration_status'];
  migrated_at?: Date;
  error_message?: string;
}

export class MigrationTrackingRepository {
  constructor(private client: SupabaseClient) {}

  async create(data: CreateMigrationTracking): Promise<MigrationTracking> {
    const { data: result, error } = await this.client
      .from('migration_tracking')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create migration tracking: ${error.message}`);
    }

    return result;
  }

  async findById(id: string): Promise<MigrationTracking | null> {
    const { data, error } = await this.client
      .from('migration_tracking')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find migration tracking: ${error.message}`);
    }

    return data;
  }

  async findByTableName(tableName: string): Promise<MigrationTracking | null> {
    const { data, error } = await this.client
      .from('migration_tracking')
      .select('*')
      .eq('table_name', tableName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find migration tracking: ${error.message}`);
    }

    return data;
  }

  async findAll(filters?: {
    status?: MigrationTracking['migration_status'];
    hasCompanyId?: boolean;
    hasTenantId?: boolean;
  }): Promise<MigrationTracking[]> {
    let query = this.client.from('migration_tracking').select('*');

    if (filters?.status) {
      query = query.eq('migration_status', filters.status);
    }

    if (filters?.hasCompanyId !== undefined) {
      query = query.eq('has_tenant_id', filters.hasCompanyId);
    }

    if (filters?.hasTenantId !== undefined) {
      query = query.eq('has_tenant_id', filters.hasTenantId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find migration trackings: ${error.message}`);
    }

    return data || [];
  }

  async update(id: string, data: UpdateMigrationTracking): Promise<MigrationTracking> {
    const { data: result, error } = await this.client
      .from('migration_tracking')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update migration tracking: ${error.message}`);
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('migration_tracking')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete migration tracking: ${error.message}`);
    }
  }

  async getSummary(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    skipped: number;
  }> {
    const { data, error } = await this.client
      .from('migration_tracking')
      .select('migration_status');

    if (error) {
      throw new Error(`Failed to get summary: ${error.message}`);
    }

    const summary = {
      total: data.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      skipped: 0
    };

    data.forEach(item => {
      switch (item.migration_status) {
        case 'pending': summary.pending++; break;
        case 'in_progress': summary.inProgress++; break;
        case 'completed': summary.completed++; break;
        case 'failed': summary.failed++; break;
        case 'skipped': summary.skipped++; break;
      }
    });

    return summary;
  }

  async findTablesNeedingMigration(): Promise<MigrationTracking[]> {
    return this.findAll({
      hasCompanyId: true,
      hasTenantId: false
    });
  }
}
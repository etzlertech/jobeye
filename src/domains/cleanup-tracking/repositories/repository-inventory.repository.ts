/**
 * @file /src/domains/cleanup-tracking/repositories/repository-inventory.repository.ts
 * @phase 3
 * @domain cleanup-tracking
 * @purpose Repository for tracking repository pattern migrations
 * @complexity_budget 300
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface RepositoryInventory {
  id: string;
  domain: string;
  repository_name: string;
  file_path: string;
  pattern_type: 'class_based' | 'functional' | 'singleton' | 'mixed';
  target_pattern: 'class_based' | 'functional' | 'singleton' | 'mixed';
  migration_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies_count: number;
  created_at: Date;
  migrated_at?: Date;
}

export interface CreateRepositoryInventory {
  domain: string;
  repository_name: string;
  file_path: string;
  pattern_type: RepositoryInventory['pattern_type'];
  target_pattern: RepositoryInventory['target_pattern'];
  migration_status: RepositoryInventory['migration_status'];
  dependencies_count: number;
}

export interface UpdateRepositoryInventory {
  pattern_type?: RepositoryInventory['pattern_type'];
  target_pattern?: RepositoryInventory['target_pattern'];
  migration_status?: RepositoryInventory['migration_status'];
  dependencies_count?: number;
  migrated_at?: Date;
}

export class RepositoryInventoryRepository {
  constructor(private client: SupabaseClient) {}

  async create(data: CreateRepositoryInventory): Promise<RepositoryInventory> {
    const { data: result, error } = await this.client
      .from('repository_inventory')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create repository inventory: ${error.message}`);
    }

    return result;
  }

  async upsert(data: CreateRepositoryInventory): Promise<RepositoryInventory> {
    // First try to find existing
    const existing = await this.findByFilePath(data.file_path);
    
    if (existing) {
      // Update existing
      return this.update(existing.id, data);
    } else {
      // Create new
      return this.create(data);
    }
  }

  async findById(id: string): Promise<RepositoryInventory | null> {
    const { data, error } = await this.client
      .from('repository_inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find repository inventory: ${error.message}`);
    }

    return data;
  }

  async findByFilePath(filePath: string): Promise<RepositoryInventory | null> {
    const { data, error } = await this.client
      .from('repository_inventory')
      .select('*')
      .eq('file_path', filePath)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find repository inventory: ${error.message}`);
    }

    return data;
  }

  async findAll(filters?: {
    domain?: string;
    patternType?: RepositoryInventory['pattern_type'];
    targetPattern?: RepositoryInventory['target_pattern'];
    migrationStatus?: RepositoryInventory['migration_status'];
  }): Promise<RepositoryInventory[]> {
    let query = this.client.from('repository_inventory').select('*');

    if (filters?.domain) {
      query = query.eq('domain', filters.domain);
    }

    if (filters?.patternType) {
      query = query.eq('pattern_type', filters.patternType);
    }

    if (filters?.targetPattern) {
      query = query.eq('target_pattern', filters.targetPattern);
    }

    if (filters?.migrationStatus) {
      query = query.eq('migration_status', filters.migrationStatus);
    }

    const { data, error } = await query.order('domain', { ascending: true });

    if (error) {
      throw new Error(`Failed to find repository inventories: ${error.message}`);
    }

    return data || [];
  }

  async update(id: string, data: UpdateRepositoryInventory): Promise<RepositoryInventory> {
    const { data: result, error } = await this.client
      .from('repository_inventory')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update repository inventory: ${error.message}`);
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('repository_inventory')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete repository inventory: ${error.message}`);
    }
  }

  async findFunctionalRepositories(): Promise<RepositoryInventory[]> {
    return this.findAll({
      patternType: 'functional'
    });
  }

  async findMixedPatternRepositories(): Promise<RepositoryInventory[]> {
    return this.findAll({
      patternType: 'mixed'
    });
  }

  async findRepositoriesNeedingMigration(): Promise<RepositoryInventory[]> {
    return this.findAll({
      migrationStatus: 'pending'
    });
  }

  async findByDomain(domain: string): Promise<RepositoryInventory[]> {
    return this.findAll({ domain });
  }

  async getSummary(): Promise<{
    total: number;
    byPattern: Record<RepositoryInventory['pattern_type'], number>;
    byStatus: Record<RepositoryInventory['migration_status'], number>;
    byDomain: Record<string, number>;
  }> {
    const { data, error } = await this.client
      .from('repository_inventory')
      .select('pattern_type, migration_status, domain');

    if (error) {
      throw new Error(`Failed to get summary: ${error.message}`);
    }

    const summary: {
      total: number;
      byPattern: Record<RepositoryInventory['pattern_type'], number>;
      byStatus: Record<RepositoryInventory['migration_status'], number>;
      byDomain: Record<string, number>;
    } = {
      total: data.length,
      byPattern: {
        class_based: 0,
        functional: 0,
        singleton: 0,
        mixed: 0
      },
      byStatus: {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0
      },
      byDomain: {}
    };

    (data ?? []).forEach((item) => {
      const record = item as Pick<RepositoryInventory, 'pattern_type' | 'migration_status' | 'domain'>;
      summary.byPattern[record.pattern_type] += 1;
      summary.byStatus[record.migration_status] += 1;
      summary.byDomain[record.domain] = (summary.byDomain[record.domain] || 0) + 1;
    });

    return summary;
  }

  async markAsCompleted(id: string): Promise<RepositoryInventory> {
    return this.update(id, {
      migration_status: 'completed',
      migrated_at: new Date()
    });
  }

  async updatePatternType(id: string, patternType: RepositoryInventory['pattern_type']): Promise<RepositoryInventory> {
    const updates: UpdateRepositoryInventory = {
      pattern_type: patternType
    };

    // If target is class_based and current pattern matches, mark as completed
    const current = await this.findById(id);
    if (current?.target_pattern === 'class_based' && patternType === 'class_based') {
      updates.migration_status = 'completed';
      updates.migrated_at = new Date();
    }

    return this.update(id, updates);
  }

  async getRepositoriesByComplexity(): Promise<RepositoryInventory[]> {
    const { data, error } = await this.client
      .from('repository_inventory')
      .select('*')
      .order('dependencies_count', { ascending: false });

    if (error) {
      throw new Error(`Failed to get repositories by complexity: ${error.message}`);
    }

    return data || [];
  }
}

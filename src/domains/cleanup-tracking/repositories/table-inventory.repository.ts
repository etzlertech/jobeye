/**
 * @file /src/domains/cleanup-tracking/repositories/table-inventory.repository.ts
 * @phase 3
 * @domain cleanup-tracking
 * @purpose Repository for table categorization and inventory
 * @complexity_budget 300
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface TableInventory {
  id: string;
  schema_name: string;
  table_name: string;
  category: 'active' | 'empty_with_code' | 'orphaned' | 'staging';
  row_count: number;
  has_code_references: boolean;
  has_relationships: boolean;
  last_modified?: Date;
  decision: 'keep' | 'seed' | 'remove' | 'document';
  decision_reason?: string;
  created_at: Date;
}

export interface CreateTableInventory {
  schema_name: string;
  table_name: string;
  category: TableInventory['category'];
  row_count: number;
  has_code_references: boolean;
  has_relationships: boolean;
  last_modified?: Date;
  decision: TableInventory['decision'];
  decision_reason?: string;
}

export interface UpdateTableInventory {
  category?: TableInventory['category'];
  row_count?: number;
  has_code_references?: boolean;
  has_relationships?: boolean;
  last_modified?: Date;
  decision?: TableInventory['decision'];
  decision_reason?: string;
}

export class TableInventoryRepository {
  constructor(private client: SupabaseClient) {}

  async create(data: CreateTableInventory): Promise<TableInventory> {
    const { data: result, error } = await this.client
      .from('table_inventory')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create table inventory: ${error.message}`);
    }

    return result;
  }

  async upsert(data: CreateTableInventory): Promise<TableInventory> {
    const { data: result, error } = await this.client
      .from('table_inventory')
      .upsert(data, {
        onConflict: 'schema_name,table_name'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert table inventory: ${error.message}`);
    }

    return result;
  }

  async findById(id: string): Promise<TableInventory | null> {
    const { data, error } = await this.client
      .from('table_inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find table inventory: ${error.message}`);
    }

    return data;
  }

  async findByTableName(schemaName: string, tableName: string): Promise<TableInventory | null> {
    const { data, error } = await this.client
      .from('table_inventory')
      .select('*')
      .eq('schema_name', schemaName)
      .eq('table_name', tableName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find table inventory: ${error.message}`);
    }

    return data;
  }

  async findAll(filters?: {
    category?: TableInventory['category'];
    decision?: TableInventory['decision'];
    hasCodeReferences?: boolean;
    hasRelationships?: boolean;
    schemaName?: string;
  }): Promise<TableInventory[]> {
    let query = this.client.from('table_inventory').select('*');

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.decision) {
      query = query.eq('decision', filters.decision);
    }

    if (filters?.hasCodeReferences !== undefined) {
      query = query.eq('has_code_references', filters.hasCodeReferences);
    }

    if (filters?.hasRelationships !== undefined) {
      query = query.eq('has_relationships', filters.hasRelationships);
    }

    if (filters?.schemaName) {
      query = query.eq('schema_name', filters.schemaName);
    }

    const { data, error } = await query.order('table_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to find table inventories: ${error.message}`);
    }

    return data || [];
  }

  async update(id: string, data: UpdateTableInventory): Promise<TableInventory> {
    const { data: result, error } = await this.client
      .from('table_inventory')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update table inventory: ${error.message}`);
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('table_inventory')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete table inventory: ${error.message}`);
    }
  }

  async findOrphanedTables(): Promise<TableInventory[]> {
    return this.findAll({
      category: 'orphaned',
      hasCodeReferences: false
    });
  }

  async findEmptyTablesWithCode(): Promise<TableInventory[]> {
    return this.findAll({
      category: 'empty_with_code'
    });
  }

  async findTablesForRemoval(): Promise<TableInventory[]> {
    return this.findAll({
      decision: 'remove'
    });
  }

  async findTablesForSeeding(): Promise<TableInventory[]> {
    return this.findAll({
      decision: 'seed'
    });
  }

  async getCategorySummary(): Promise<{
    total: number;
    active: number;
    emptyWithCode: number;
    orphaned: number;
    staging: number;
  }> {
    const { data, error } = await this.client
      .from('table_inventory')
      .select('category');

    if (error) {
      throw new Error(`Failed to get category summary: ${error.message}`);
    }

    const summary = {
      total: data.length,
      active: 0,
      emptyWithCode: 0,
      orphaned: 0,
      staging: 0
    };

    data.forEach(item => {
      switch (item.category) {
        case 'active': summary.active++; break;
        case 'empty_with_code': summary.emptyWithCode++; break;
        case 'orphaned': summary.orphaned++; break;
        case 'staging': summary.staging++; break;
      }
    });

    return summary;
  }

  async getDecisionSummary(): Promise<{
    total: number;
    keep: number;
    seed: number;
    remove: number;
    document: number;
  }> {
    const { data, error } = await this.client
      .from('table_inventory')
      .select('decision');

    if (error) {
      throw new Error(`Failed to get decision summary: ${error.message}`);
    }

    const summary = {
      total: data.length,
      keep: 0,
      seed: 0,
      remove: 0,
      document: 0
    };

    data.forEach(item => {
      switch (item.decision) {
        case 'keep': summary.keep++; break;
        case 'seed': summary.seed++; break;
        case 'remove': summary.remove++; break;
        case 'document': summary.document++; break;
      }
    });

    return summary;
  }
}
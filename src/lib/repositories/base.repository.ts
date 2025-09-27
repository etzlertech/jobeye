/*
AGENT DIRECTIVE BLOCK
file: /src/lib/repositories/base.repository.ts
phase: 1
domain: core-infrastructure
purpose: Base repository class for database operations with multi-tenant support
spec_ref: v4-blueprint
complexity_budget: 200
offline_capability: REQUIRED
dependencies:
  external:
    - @supabase/supabase-js
  internal:
    - /src/lib/supabase/client
    - /src/lib/supabase/types
exports:
  - BaseRepository (abstract class)
  - RepositoryError
  - PaginationOptions
  - FilterOptions
voice_considerations: N/A - Infrastructure component
test_requirements:
  coverage: 90%
  test_file: __tests__/lib/repositories/base.repository.test.ts
tasks:
  - Create abstract base repository
  - Implement CRUD operations
  - Add multi-tenant filtering
  - Handle offline queue
  - Add pagination support
*/

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/types';

export class RepositoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface FilterOptions {
  [key: string]: any;
}

export interface OfflineOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: string;
  synced: boolean;
}

export abstract class BaseRepository<T extends keyof Database['public']['Tables']> {
  protected tableName: T;
  protected supabase: SupabaseClient<Database>;
  private offlineQueue: OfflineOperation[] = [];

  constructor(
    tableName: T,
    supabase: SupabaseClient<Database>
  ) {
    this.tableName = tableName;
    this.supabase = supabase;
    this.loadOfflineQueue();
  }

  // Get current tenant ID from auth session
  protected async getTenantId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new RepositoryError('User not authenticated', 'AUTH_ERROR');
    }

    const { data, error } = await this.supabase
      .rpc('get_user_tenant_id', { user_id: user.id });

    if (error || !data) {
      throw new RepositoryError('Unable to get tenant ID', 'TENANT_ERROR', error);
    }

    return data;
  }

  // Find by ID
  async findById(id: string): Promise<Database['public']['Tables'][T]['Row'] | null> {
    try {
      const tenantId = await this.getTenantId();
      
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      return data;
    } catch (error) {
      throw new RepositoryError(
        `Failed to find ${this.tableName} by ID`,
        'FIND_ERROR',
        error
      );
    }
  }

  // Find all with filters and pagination
  async findAll(
    filters: FilterOptions = {},
    options: PaginationOptions = {}
  ): Promise<{
    data: Database['public']['Tables'][T]['Row'][];
    count: number;
  }> {
    try {
      const tenantId = await this.getTenantId();
      const {
        page = 1,
        limit = 50,
        orderBy = 'created_at',
        orderDirection = 'desc'
      } = options;

      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      // Apply pagination
      const start = (page - 1) * limit;
      query = query
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(start, start + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to find ${this.tableName} records`,
        'FIND_ALL_ERROR',
        error
      );
    }
  }

  // Create
  async create(
    data: Omit<Database['public']['Tables'][T]['Insert'], 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
  ): Promise<Database['public']['Tables'][T]['Row']> {
    try {
      const tenantId = await this.getTenantId();
      
      const payload = {
        ...data,
        tenant_id: tenantId,
      } as Database['public']['Tables'][T]['Insert'];

      const { data: created, error } = await this.supabase
        .from(this.tableName)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return created;
    } catch (error) {
      // If offline, queue the operation
      if (this.isOfflineError(error)) {
        return this.queueOfflineOperation('insert', data);
      }
      
      throw new RepositoryError(
        `Failed to create ${this.tableName} record`,
        'CREATE_ERROR',
        error
      );
    }
  }

  // Update
  async update(
    id: string,
    data: Partial<Database['public']['Tables'][T]['Update']>
  ): Promise<Database['public']['Tables'][T]['Row']> {
    try {
      const tenantId = await this.getTenantId();
      
      // Remove fields that shouldn't be updated
      const { id: _, tenant_id: __, created_at: ___, ...updateData } = data as any;

      const { data: updated, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return updated;
    } catch (error) {
      // If offline, queue the operation
      if (this.isOfflineError(error)) {
        return this.queueOfflineOperation('update', { id, ...data });
      }
      
      throw new RepositoryError(
        `Failed to update ${this.tableName} record`,
        'UPDATE_ERROR',
        error
      );
    }
  }

  // Delete
  async delete(id: string): Promise<void> {
    try {
      const tenantId = await this.getTenantId();
      
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    } catch (error) {
      // If offline, queue the operation
      if (this.isOfflineError(error)) {
        this.queueOfflineOperation('delete', { id });
        return;
      }
      
      throw new RepositoryError(
        `Failed to delete ${this.tableName} record`,
        'DELETE_ERROR',
        error
      );
    }
  }

  // Batch create
  async createMany(
    items: Array<Omit<Database['public']['Tables'][T]['Insert'], 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
  ): Promise<Database['public']['Tables'][T]['Row'][]> {
    try {
      const tenantId = await this.getTenantId();
      
      const payload = items.map(item => ({
        ...item,
        tenant_id: tenantId,
      })) as Database['public']['Tables'][T]['Insert'][];

      const { data: created, error } = await this.supabase
        .from(this.tableName)
        .insert(payload)
        .select();

      if (error) throw error;

      return created || [];
    } catch (error) {
      throw new RepositoryError(
        `Failed to create multiple ${this.tableName} records`,
        'CREATE_MANY_ERROR',
        error
      );
    }
  }

  // Check if error is due to offline status
  private isOfflineError(error: any): boolean {
    return error?.code === 'NETWORK_ERROR' || 
           error?.message?.includes('Failed to fetch') ||
           !navigator.onLine;
  }

  // Queue offline operation
  private queueOfflineOperation(
    operation: OfflineOperation['operation'],
    data: any
  ): any {
    const offlineOp: OfflineOperation = {
      id: crypto.randomUUID(),
      table: this.tableName,
      operation,
      data,
      timestamp: new Date().toISOString(),
      synced: false
    };

    this.offlineQueue.push(offlineOp);
    this.saveOfflineQueue();

    // Return fake data for optimistic UI
    if (operation === 'insert') {
      return {
        ...data,
        id: offlineOp.id,
        created_at: offlineOp.timestamp,
        updated_at: offlineOp.timestamp,
        _offline: true
      };
    }

    return { ...data, _offline: true };
  }

  // Load offline queue from localStorage
  private loadOfflineQueue() {
    if (typeof window === 'undefined') return;
    
    const stored = localStorage.getItem(`offline_queue_${this.tableName}`);
    if (stored) {
      try {
        this.offlineQueue = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to load offline queue:', e);
      }
    }
  }

  // Save offline queue to localStorage
  private saveOfflineQueue() {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(
      `offline_queue_${this.tableName}`,
      JSON.stringify(this.offlineQueue)
    );
  }

  // Sync offline operations
  async syncOfflineOperations(): Promise<number> {
    const pending = this.offlineQueue.filter(op => !op.synced);
    let syncedCount = 0;

    for (const op of pending) {
      try {
        switch (op.operation) {
          case 'insert':
            await this.create(op.data);
            break;
          case 'update':
            await this.update(op.data.id, op.data);
            break;
          case 'delete':
            await this.delete(op.data.id);
            break;
        }
        
        op.synced = true;
        syncedCount++;
      } catch (error) {
        console.error(`Failed to sync offline operation:`, error);
      }
    }

    // Remove synced operations
    this.offlineQueue = this.offlineQueue.filter(op => !op.synced);
    this.saveOfflineQueue();

    return syncedCount;
  }
}
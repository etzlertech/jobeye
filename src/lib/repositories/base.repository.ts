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
    - /src/types/database
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

import { randomUUID } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

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
  tenantId?: string;
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

type TableDefinition<TTable extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TTable];

type TableRow<TTable extends keyof Database['public']['Tables']> =
  TableDefinition<TTable>['Row'];

type TableInsert<TTable extends keyof Database['public']['Tables']> =
  TableDefinition<TTable>['Insert'];

type TableUpdate<TTable extends keyof Database['public']['Tables']> =
  TableDefinition<TTable>['Update'];

interface BaseRepositoryOptions {
  /**
   * Column name used as the primary identifier for the table. Defaults to `id`.
   */
  idColumn?: string;
  /**
   * Column used to scope queries by tenant. Set to `null` to disable tenant scoping.
   */
  tenantColumn?: string | null;
}

export abstract class BaseRepository<
  TTable extends keyof Database['public']['Tables'],
  TRow = TableRow<TTable>,
  TInsert = TableInsert<TTable>,
  TUpdate = TableUpdate<TTable>
> {
  protected readonly tableName: TTable;
  protected readonly supabase: SupabaseClient<Database>;
  private readonly idColumn: string;
  private readonly tenantColumn: string | null;
  private offlineQueue: OfflineOperation[] = [];

  constructor(
    tableName: TTable,
    supabase: SupabaseClient<Database>,
    options: BaseRepositoryOptions = {}
  ) {
    this.tableName = tableName;
    this.supabase = supabase;
    this.idColumn = options.idColumn ?? 'id';
    this.tenantColumn = options.tenantColumn ?? 'tenant_id';
    this.loadOfflineQueue();
  }

  // Get current tenant ID from auth session (returns null if tenant scoping disabled)
  protected async getTenantId(): Promise<string | null> {
    if (!this.tenantColumn) {
      return null;
    }

    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new RepositoryError('User not authenticated', 'AUTH_ERROR');
    }

    const { data, error } = await (this.supabase as any)
      .rpc('get_user_tenant_id', { user_id: user.id });

    if (error || !data) {
      throw new RepositoryError('Unable to get tenant ID', 'TENANT_ERROR', error);
    }

    return data;
  }

  protected async requireTenantId(): Promise<string> {
    const tenantId = await this.getTenantId();
    if (!tenantId) {
      throw new RepositoryError(
        `Tenant ID required for ${this.tableName} but tenant scoping is disabled`,
        'TENANT_DISABLED'
      );
    }
    return tenantId;
  }

  protected async resolveTenantId(explicitTenantId?: string | null): Promise<string> {
    if (explicitTenantId) {
      return explicitTenantId;
    }
    return this.requireTenantId();
  }

  // Find by ID
  async findById(id: string, options: { tenantId?: string } = {}): Promise<TRow | null> {
    try {
      const tenantId = this.tenantColumn
        ? await this.resolveTenantId(options.tenantId ?? null)
        : null;
      let query = (this.supabase as any)
        .from(this.tableName as string)
        .select('*')
        .eq(this.idColumn, id);

      if (tenantId) {
        query = query.eq(this.tenantColumn as string, tenantId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      return data as TRow;
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
    data: TRow[];
    count: number;
  }> {
    try {
      const tenantId = this.tenantColumn
        ? await this.resolveTenantId(options.tenantId ?? null)
        : null;
      const {
        page = 1,
        limit = 50,
        orderBy = 'created_at',
        orderDirection = 'desc'
      } = options;

      let query = (this.supabase as any)
        .from(this.tableName as string)
        .select('*', { count: 'exact' })
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range((page - 1) * limit, (page * limit) - 1);

      if (tenantId) {
        query = query.eq(this.tenantColumn as string, tenantId);
      }

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []) as TRow[],
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
    data: Omit<TInsert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>,
    options: { tenantId?: string } = {}
  ): Promise<TRow> {
    let payload: TInsert | null = null;
    try {
      const tenantId = this.tenantColumn
        ? await this.resolveTenantId(options.tenantId ?? null)
        : null;

      payload = {
        ...data,
        ...(tenantId ? { [this.tenantColumn as string]: tenantId } : {})
      } as TInsert;

      const { data: created, error } = await (this.supabase as any)
        .from(this.tableName as string)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return created as TRow;
    } catch (error) {
      // If offline, queue the operation
      if (this.isOfflineError(error) && payload) {
        return this.queueOfflineOperation('insert', payload) as TRow;
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
    updates: TUpdate,
    options: { tenantId?: string } = {}
  ): Promise<TRow> {
    try {
      const tenantId = this.tenantColumn
        ? await this.resolveTenantId(options.tenantId ?? null)
        : null;

      let query = (this.supabase as any)
        .from(this.tableName as string)
        .update(updates)
        .eq(this.idColumn, id);

      if (tenantId) {
        query = query.eq(this.tenantColumn as string, tenantId);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;

      return data as TRow;
    } catch (error) {
      if (this.isOfflineError(error)) {
        return this.queueOfflineOperation('update', { id, updates }) as TRow;
      }

      throw new RepositoryError(
        `Failed to update ${this.tableName} record`,
        'UPDATE_ERROR',
        error
      );
    }
  }

  // Delete
  async delete(id: string, options: { tenantId?: string } = {}): Promise<boolean> {
    try {
      const tenantId = this.tenantColumn
        ? await this.resolveTenantId(options.tenantId ?? null)
        : null;

      let query = (this.supabase as any)
        .from(this.tableName as string)
        .delete()
        .eq(this.idColumn, id);

      if (tenantId) {
        query = query.eq(this.tenantColumn as string, tenantId);
      }

      const { error } = await query;

      if (error) throw error;

      return true;
    } catch (error) {
      if (this.isOfflineError(error)) {
        await this.queueOfflineOperation('delete', { id });
        return false;
      }

      throw new RepositoryError(
        `Failed to delete ${this.tableName} record`,
        'DELETE_ERROR',
        error
      );
    }
  }

  protected isOfflineError(error: any): boolean {
    return (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.toLowerCase().includes('failed to fetch')
    );
  }

  protected queueOfflineOperation(
    operation: OfflineOperation['operation'],
    data: any
  ): any {
    const operationId = randomUUID();

    this.offlineQueue.push({
      id: operationId,
      table: this.tableName as string,
      operation,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
    });

    this.saveOfflineQueue();
    return data;
  }

  private loadOfflineQueue(): void {
    if (typeof window === 'undefined') {
      this.offlineQueue = [];
      return;
    }

    try {
      const stored = window.localStorage.getItem('supabase_offline_queue');
      this.offlineQueue = stored ? JSON.parse(stored) : [];
    } catch {
      this.offlineQueue = [];
    }
  }

  private saveOfflineQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        'supabase_offline_queue',
        JSON.stringify(this.offlineQueue)
      );
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * @file supabase-client.mock.ts
 * @purpose Mock Supabase client for testing with full query chaining support
 * @test_type mock
 */

/**
 * In-memory data store for mock Supabase
 */
class MockDataStore {
  private data = new Map<string, any[]>();

  set(table: string, records: any[]) {
    this.data.set(table, records);
  }

  get(table: string): any[] {
    return this.data.get(table) || [];
  }

  add(table: string, record: any) {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    this.data.get(table)!.push(record);
  }

  clear() {
    this.data.clear();
  }
}

const mockDataStore = new MockDataStore();

/**
 * Chainable query builder for Supabase mock
 */
class MockQueryBuilder {
  private table: string;
  private filters: Array<(record: any) => boolean> = [];
  private selectedColumns: string = '*';
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitValue: number | null = null;
  private offsetValue: number = 0;
  private returnSingle: boolean = false;
  private countEnabled: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }) {
    this.selectedColumns = columns;
    if (options?.count) {
      this.countEnabled = true;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push(record => record[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push(record => record[column] !== value);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push(record => record[column] > value);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push(record => record[column] >= value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push(record => record[column] < value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push(record => record[column] <= value);
    return this;
  }

  like(column: string, pattern: string) {
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    this.filters.push(record => regex.test(record[column]));
    return this;
  }

  ilike(column: string, pattern: string) {
    return this.like(column, pattern);
  }

  is(column: string, value: any) {
    this.filters.push(record => record[column] === value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push(record => values.includes(record[column]));
    return this;
  }

  contains(column: string, value: any) {
    this.filters.push(record => {
      const columnValue = record[column];
      if (Array.isArray(columnValue)) {
        return columnValue.includes(value);
      }
      return false;
    });
    return this;
  }

  range(from: number, to: number) {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = {
      column,
      ascending: options.ascending !== false
    };
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  single() {
    this.returnSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.returnSingle = true;
    return this.execute();
  }

  private applyFilters(records: any[]): any[] {
    return records.filter(record =>
      this.filters.every(filter => filter(record))
    );
  }

  private applyOrder(records: any[]): any[] {
    if (!this.orderBy) return records;

    return [...records].sort((a, b) => {
      const aVal = a[this.orderBy!.column];
      const bVal = b[this.orderBy!.column];

      if (aVal < bVal) return this.orderBy!.ascending ? -1 : 1;
      if (aVal > bVal) return this.orderBy!.ascending ? 1 : -1;
      return 0;
    });
  }

  private applyPagination(records: any[]): any[] {
    const start = this.offsetValue;
    const end = this.limitValue ? start + this.limitValue : undefined;
    return records.slice(start, end);
  }

  private execute() {
    let records = mockDataStore.get(this.table);
    records = this.applyFilters(records);
    records = this.applyOrder(records);

    const count = records.length;
    records = this.applyPagination(records);

    if (this.returnSingle) {
      return {
        data: records[0] || null,
        error: null
      };
    }

    const result: any = {
      data: records,
      error: null
    };

    if (this.countEnabled) {
      result.count = count;
    }

    return result;
  }

  // Getter for terminal operation
  then(resolve: any) {
    return Promise.resolve(this.execute()).then(resolve);
  }
}

/**
 * Mock insert builder
 */
class MockInsertBuilder {
  private table: string;
  private records: any[];

  constructor(table: string, data: any | any[]) {
    this.table = table;
    this.records = Array.isArray(data) ? data : [data];
  }

  select(columns: string = '*') {
    return this;
  }

  single() {
    return this.execute(true);
  }

  private execute(single: boolean = false) {
    const insertedRecords = this.records.map(record => {
      const id = record.id || `${this.table}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const insertedRecord = {
        id,
        ...record,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: record.updated_at || new Date().toISOString()
      };

      mockDataStore.add(this.table, insertedRecord);
      return insertedRecord;
    });

    if (single) {
      return {
        data: insertedRecords[0] || null,
        error: null
      };
    }

    return {
      data: insertedRecords,
      error: null
    };
  }

  then(resolve: any) {
    return Promise.resolve(this.execute()).then(resolve);
  }
}

/**
 * Mock update builder
 */
class MockUpdateBuilder {
  private table: string;
  private updates: any;
  private filters: Array<(record: any) => boolean> = [];

  constructor(table: string, updates: any) {
    this.table = table;
    this.updates = updates;
  }

  eq(column: string, value: any) {
    this.filters.push(record => record[column] === value);
    return this;
  }

  select(columns: string = '*') {
    return this;
  }

  single() {
    return this.execute(true);
  }

  private execute(single: boolean = false) {
    const records = mockDataStore.get(this.table);
    const matchingRecords = records.filter(record =>
      this.filters.every(filter => filter(record))
    );

    matchingRecords.forEach(record => {
      Object.assign(record, {
        ...this.updates,
        updated_at: new Date().toISOString()
      });
    });

    if (single) {
      return {
        data: matchingRecords[0] || null,
        error: null
      };
    }

    return {
      data: matchingRecords,
      error: null
    };
  }

  then(resolve: any) {
    return Promise.resolve(this.execute()).then(resolve);
  }
}

/**
 * Mock delete builder
 */
class MockDeleteBuilder {
  private table: string;
  private filters: Array<(record: any) => boolean> = [];

  constructor(table: string) {
    this.table = table;
  }

  eq(column: string, value: any) {
    this.filters.push(record => record[column] === value);
    return this;
  }

  private execute() {
    const records = mockDataStore.get(this.table);
    const remainingRecords = records.filter(record =>
      !this.filters.every(filter => filter(record))
    );

    mockDataStore.set(this.table, remainingRecords);

    return {
      data: null,
      error: null
    };
  }

  then(resolve: any) {
    return Promise.resolve(this.execute()).then(resolve);
  }
}

/**
 * Mock Supabase client
 */
export function createMockSupabaseClient() {
  return {
    from(table: string) {
      return {
        select: (columns?: string, options?: any) => new MockQueryBuilder(table).select(columns, options),
        insert: (data: any) => new MockInsertBuilder(table, data),
        update: (updates: any) => new MockUpdateBuilder(table, updates),
        delete: () => new MockDeleteBuilder(table),
        upsert: (data: any) => new MockInsertBuilder(table, data)
      };
    },

    rpc(fn: string, params: any) {
      return Promise.resolve({
        data: null,
        error: null
      });
    },

    auth: {
      getUser: jest.fn(() => Promise.resolve({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            app_metadata: {
              tenant_id: 'test-company-id'
            }
          }
        },
        error: null
      })),

      getSession: jest.fn(() => Promise.resolve({
        data: {
          session: {
            access_token: 'test-token',
            user: {
              id: 'test-user-id',
              email: 'test@example.com'
            }
          }
        },
        error: null
      })),

      signInWithPassword: jest.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' }, session: { access_token: 'test-token' } },
        error: null
      })),

      signOut: jest.fn(() => Promise.resolve({ error: null }))
    },

    storage: {
      from: jest.fn((bucket: string) => ({
        upload: jest.fn(() => Promise.resolve({
          data: { path: `${bucket}/test-file.jpg` },
          error: null
        })),
        download: jest.fn(() => Promise.resolve({
          data: new Blob(),
          error: null
        })),
        list: jest.fn(() => Promise.resolve({
          data: [],
          error: null
        })),
        remove: jest.fn(() => Promise.resolve({
          data: null,
          error: null
        }))
      }))
    },

    // Helper methods for tests
    _setMockData: (table: string, data: any[]) => {
      mockDataStore.set(table, data);
    },

    _getMockData: (table: string) => {
      return mockDataStore.get(table);
    },

    _clearMockData: () => {
      mockDataStore.clear();
    },

    _addMockData: (table: string, record: any) => {
      mockDataStore.add(table, record);
    }
  };
}

// Singleton instance for consistent mocking
let mockClientInstance: ReturnType<typeof createMockSupabaseClient> | null = null;

export function createClient() {
  if (!mockClientInstance) {
    mockClientInstance = createMockSupabaseClient();
  }
  return mockClientInstance;
}

export function resetMockClient() {
  mockClientInstance = null;
}

export default {
  createClient,
  createMockSupabaseClient,
  resetMockClient,
  __esModule: true
};
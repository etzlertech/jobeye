/**
 * @file IndexedDB Mock Helper
 * @purpose Comprehensive IndexedDB mock for testing offline functionality
 */

export interface MockIDBRequest {
  result: any;
  error: Error | null;
  onsuccess: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onupgradeneeded: ((event: any) => void) | null;
}

export interface MockIDBObjectStore {
  name: string;
  keyPath: string | string[];
  indexNames: string[];
  autoIncrement: boolean;
  _data: Map<any, any>;
  _indexes: Map<string, MockIDBIndex>;

  add(value: any, key?: any): MockIDBRequest;
  put(value: any, key?: any): MockIDBRequest;
  get(key: any): MockIDBRequest;
  getAll(query?: any): MockIDBRequest;
  delete(key: any): MockIDBRequest;
  clear(): MockIDBRequest;
  index(name: string): MockIDBIndex;
  createIndex(name: string, keyPath: string | string[], options?: any): MockIDBIndex;
}

export interface MockIDBIndex {
  name: string;
  keyPath: string | string[];
  objectStore: MockIDBObjectStore;
  _indexData: Map<any, any[]>;

  get(key: any): MockIDBRequest;
  getAll(query?: any): MockIDBRequest;
  getAllKeys(query?: any): MockIDBRequest;
}

export interface MockIDBTransaction {
  mode: 'readonly' | 'readwrite' | 'versionchange';
  objectStoreNames: string[];
  _objectStores: Map<string, MockIDBObjectStore>;

  objectStore(name: string): MockIDBObjectStore;
  abort(): void;
}

export interface MockIDBDatabase {
  name: string;
  version: number;
  objectStoreNames: string[];
  _stores: Map<string, MockIDBObjectStore>;

  transaction(storeNames: string | string[], mode?: 'readonly' | 'readwrite'): MockIDBTransaction;
  createObjectStore(name: string, options?: any): MockIDBObjectStore;
  deleteObjectStore(name: string): void;
  close(): void;
}

/**
 * Create a mock IDBRequest that can be triggered manually
 */
export function createMockRequest(initialResult?: any): MockIDBRequest {
  const request: MockIDBRequest = {
    result: initialResult,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };
  return request;
}

/**
 * Trigger a request's success callback
 */
export function triggerSuccess(request: MockIDBRequest, result?: any): void {
  if (result !== undefined) {
    request.result = result;
  }
  if (request.onsuccess) {
    request.onsuccess({ target: request });
  }
}

/**
 * Trigger a request's error callback
 */
export function triggerError(request: MockIDBRequest, error: Error): void {
  request.error = error;
  if (request.onerror) {
    request.onerror({ target: request });
  }
}

/**
 * Create a mock IDBIndex
 */
export function createMockIndex(
  name: string,
  keyPath: string | string[],
  objectStore: MockIDBObjectStore
): MockIDBIndex {
  const index: MockIDBIndex = {
    name,
    keyPath,
    objectStore,
    _indexData: new Map(),

    get(key: any): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        const items = index._indexData.get(key) || [];
        triggerSuccess(request, items[0] || undefined);
      }, 0);
      return request;
    },

    getAll(query?: any): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        if (query === undefined) {
          // Return all items
          const allItems: any[] = [];
          index._indexData.forEach(items => allItems.push(...items));
          triggerSuccess(request, allItems);
        } else {
          // Return items matching query
          const items = index._indexData.get(query) || [];
          triggerSuccess(request, items);
        }
      }, 0);
      return request;
    },

    getAllKeys(query?: any): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        const items = query !== undefined ? (index._indexData.get(query) || []) : [];
        const keys = items.map((item: any) => item.id);
        triggerSuccess(request, keys);
      }, 0);
      return request;
    }
  };

  return index;
}

/**
 * Create a mock IDBObjectStore
 */
export function createMockObjectStore(
  name: string,
  options: { keyPath?: string | string[]; autoIncrement?: boolean } = {}
): MockIDBObjectStore {
  const store: MockIDBObjectStore = {
    name,
    keyPath: options.keyPath || 'id',
    indexNames: [],
    autoIncrement: options.autoIncrement || false,
    _data: new Map(),
    _indexes: new Map(),

    add(value: any, key?: any): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        const itemKey = key || value[store.keyPath as string];
        if (store._data.has(itemKey)) {
          triggerError(request, new Error('Key already exists'));
        } else {
          store._data.set(itemKey, value);

          // Update indexes
          store._indexes.forEach((index, indexName) => {
            const indexKey = value[indexName];
            if (indexKey !== undefined) {
              const items = index._indexData.get(indexKey) || [];
              items.push(value);
              index._indexData.set(indexKey, items);
            }
          });

          triggerSuccess(request, itemKey);
        }
      }, 0);
      return request;
    },

    put(value: any, key?: any): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        const itemKey = key || value[store.keyPath as string];
        store._data.set(itemKey, value);

        // Update indexes
        store._indexes.forEach((index, indexName) => {
          const indexKey = value[indexName];
          if (indexKey !== undefined) {
            // Remove old entry if exists
            index._indexData.forEach((items, key) => {
              const filtered = items.filter((item: any) => item.id !== itemKey);
              if (filtered.length === 0) {
                index._indexData.delete(key);
              } else {
                index._indexData.set(key, filtered);
              }
            });

            // Add new entry
            const items = index._indexData.get(indexKey) || [];
            items.push(value);
            index._indexData.set(indexKey, items);
          }
        });

        triggerSuccess(request, itemKey);
      }, 0);
      return request;
    },

    get(key: any): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        const item = store._data.get(key);
        triggerSuccess(request, item);
      }, 0);
      return request;
    },

    getAll(query?: any): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        const items = Array.from(store._data.values());
        triggerSuccess(request, items);
      }, 0);
      return request;
    },

    delete(key: any): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        const deleted = store._data.delete(key);
        if (deleted) {
          triggerSuccess(request);
        } else {
          triggerError(request, new Error('Key not found'));
        }
      }, 0);
      return request;
    },

    clear(): MockIDBRequest {
      const request = createMockRequest();
      setTimeout(() => {
        store._data.clear();
        store._indexes.forEach(index => index._indexData.clear());
        triggerSuccess(request);
      }, 0);
      return request;
    },

    index(name: string): MockIDBIndex {
      if (!store._indexes.has(name)) {
        throw new Error(`Index '${name}' does not exist`);
      }
      return store._indexes.get(name)!;
    },

    createIndex(name: string, keyPath: string | string[], options?: any): MockIDBIndex {
      const index = createMockIndex(name, keyPath, store);
      store._indexes.set(name, index);
      store.indexNames.push(name);
      return index;
    }
  };

  return store;
}

/**
 * Create a mock IDBTransaction
 */
export function createMockTransaction(
  objectStoreNames: string[],
  mode: 'readonly' | 'readwrite',
  stores: Map<string, MockIDBObjectStore>
): MockIDBTransaction {
  const transaction: MockIDBTransaction = {
    mode,
    objectStoreNames,
    _objectStores: stores,

    objectStore(name: string): MockIDBObjectStore {
      if (!stores.has(name)) {
        throw new Error(`Object store '${name}' does not exist`);
      }
      return stores.get(name)!;
    },

    abort(): void {
      // No-op in mock
    }
  };

  return transaction;
}

/**
 * Create a mock IDBDatabase
 */
export function createMockDatabase(name: string, version: number = 1): MockIDBDatabase {
  const db: MockIDBDatabase = {
    name,
    version,
    objectStoreNames: [],
    _stores: new Map(),

    transaction(storeNames: string | string[], mode: 'readonly' | 'readwrite' = 'readonly'): MockIDBTransaction {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return createMockTransaction(names, mode, db._stores);
    },

    createObjectStore(name: string, options?: any): MockIDBObjectStore {
      const store = createMockObjectStore(name, options);
      db._stores.set(name, store);
      db.objectStoreNames.push(name);
      return store;
    },

    deleteObjectStore(name: string): void {
      db._stores.delete(name);
      db.objectStoreNames = db.objectStoreNames.filter(n => n !== name);
    },

    close(): void {
      // No-op in mock
    }
  };

  return db;
}

/**
 * Setup IndexedDB global mock
 */
export function setupIndexedDBMock(): MockIDBDatabase {
  const db = createMockDatabase('test-db');

  const mockIndexedDB = {
    open: jest.fn((name: string, version?: number) => {
      const request = createMockRequest();

      setTimeout(() => {
        if (request.onupgradeneeded) {
          request.onupgradeneeded({ target: { result: db } });
        }
        triggerSuccess(request, db);
      }, 0);

      return request;
    }),
    databases: jest.fn(() => Promise.resolve([{ name: db.name, version: db.version }])),
    deleteDatabase: jest.fn(() => {
      const request = createMockRequest();
      setTimeout(() => triggerSuccess(request), 0);
      return request;
    })
  };

  (global as any).indexedDB = mockIndexedDB;

  return db;
}

/**
 * Teardown IndexedDB mock
 */
export function teardownIndexedDBMock(): void {
  delete (global as any).indexedDB;
}
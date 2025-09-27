/**
 * Tests for BaseRepository
 */

import { BaseRepository, RepositoryError, PaginationOptions } from '@/lib/repositories/base.repository';
import { createMockSupabaseClient, mockCustomer } from '@/__tests__/mocks/supabase';
import type { Database } from '@/lib/supabase/types';

// Mock localStorage and window
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

// Define window with localStorage if not already defined
if (typeof window === 'undefined') {
  (global as any).window = {
    localStorage: localStorageMock,
  };
}

// Make sure localStorage is accessible both ways
(global as any).localStorage = localStorageMock;
(global as any).window = { ...(global as any).window, localStorage: localStorageMock };

// Mock the actual localStorage calls
const originalLocalStorage = global.localStorage;
beforeAll(() => {
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
});

afterAll(() => {
  Object.defineProperty(global, 'localStorage', {
    value: originalLocalStorage,
    writable: true,
  });
});

// Create a concrete implementation for testing
class TestRepository extends BaseRepository<'customers'> {
  constructor(supabase: any) {
    super('customers', supabase);
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.getItem.mockReturnValue(null); // Default no stored data
    
    mockSupabase = createMockSupabaseClient();
    repository = new TestRepository(mockSupabase);

    // Mock auth.getUser
    mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    // Mock RPC for tenant ID
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: 'tenant-123',
      error: null,
    });
  });

  describe('getTenantId', () => {
    it('should get tenant ID for authenticated user', async () => {
      const tenantId = await (repository as any).getTenantId();

      expect(tenantId).toBe('tenant-123');
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_tenant_id', {
        user_id: 'test-user-id',
      });
    });

    it('should throw error if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      await expect((repository as any).getTenantId()).rejects.toThrow(
        new RepositoryError('User not authenticated', 'AUTH_ERROR')
      );
    });

    it('should throw error if tenant ID cannot be retrieved', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('RPC error'),
      });

      await expect((repository as any).getTenantId()).rejects.toThrow(
        new RepositoryError('Unable to get tenant ID', 'TENANT_ERROR')
      );
    });
  });

  describe('findById', () => {
    it('should find record by ID', async () => {
      const mockRecord = mockCustomer();
      
      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockRecord,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const result = await repository.findById('customer-123');

      expect(result).toEqual(mockRecord);
      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(selectMock.eq).toHaveBeenCalledWith('id', 'customer-123');
      expect(selectMock.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    });

    it('should return null if record not found', async () => {
      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should throw error for other database errors', async () => {
      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error'),
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      await expect(repository.findById('customer-123')).rejects.toThrow(
        new RepositoryError('Failed to find customers by ID', 'FIND_ERROR')
      );
    });
  });

  describe('findAll', () => {
    it('should find all records with default pagination', async () => {
      const mockRecords = [mockCustomer(), mockCustomer({ id: 'customer-124' })];

      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockRecords,
          count: 2,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const result = await repository.findAll();

      expect(result).toEqual({
        data: mockRecords,
        count: 2,
      });
      expect(queryMock.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(queryMock.range).toHaveBeenCalledWith(0, 49);
    });

    it('should apply filters', async () => {
      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          count: 0,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      await repository.findAll({ is_active: true, tags: ['vip'] });

      expect(queryMock.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      expect(queryMock.eq).toHaveBeenCalledWith('is_active', true);
      expect(queryMock.eq).toHaveBeenCalledWith('tags', ['vip']);
    });

    it('should apply custom pagination options', async () => {
      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          count: 0,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const options: PaginationOptions = {
        page: 3,
        limit: 20,
        orderBy: 'name',
        orderDirection: 'asc',
      };

      await repository.findAll({}, options);

      expect(queryMock.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(queryMock.range).toHaveBeenCalledWith(40, 59); // Page 3, limit 20
    });
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const newData = {
        customer_number: 'C0002',
        name: 'New Customer',
        email: 'new@example.com',
      };
      const createdRecord = mockCustomer(newData);

      const insertMock = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createdRecord,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue(insertMock),
      });

      const result = await repository.create(newData as any);

      expect(result).toEqual(createdRecord);
      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...newData,
          tenant_id: 'tenant-123',
        })
      );
    });

    it('should queue operation when offline', async () => {
      const newData = {
        customer_number: 'C0002',
        name: 'New Customer',
      };

      // Simulate offline
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const insertMock = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue(insertMock),
      });

      const result = await repository.create(newData as any);

      expect(result).toMatchObject({
        ...newData,
        _offline: true,
      });

      // Check localStorage for queued operation
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_queue_customers',
        expect.stringContaining('insert')
      );

      // Reset navigator.onLine
      Object.defineProperty(window.navigator, 'onLine', { value: true });
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      const updateData = { name: 'Updated Customer' };
      const updatedRecord = mockCustomer(updateData);

      const updateMock = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: updatedRecord,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue(updateMock),
      });

      const result = await repository.update('customer-123', updateData);

      expect(result).toEqual(updatedRecord);
      expect(updateMock.eq).toHaveBeenCalledWith('id', 'customer-123');
      expect(updateMock.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    });

    it('should not update protected fields', async () => {
      const updateData = {
        id: 'should-be-ignored',
        tenant_id: 'should-be-ignored',
        created_at: 'should-be-ignored',
        name: 'Updated Customer',
      };

      const updateMock = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCustomer({ name: 'Updated Customer' }),
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue(updateMock),
      });

      await repository.update('customer-123', updateData);

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        name: 'Updated Customer',
      });
    });
  });

  describe('delete', () => {
    it('should delete a record', async () => {
      const deleteMock = {
        eq: jest.fn().mockReturnThis(),
      };

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue(deleteMock),
      });

      await repository.delete('customer-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(deleteMock.eq).toHaveBeenCalledWith('id', 'customer-123');
      expect(deleteMock.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    });
  });

  describe('createMany', () => {
    it('should create multiple records', async () => {
      const items = [
        { customer_number: 'C0002', name: 'Customer 2' },
        { customer_number: 'C0003', name: 'Customer 3' },
      ];
      const createdRecords = items.map((item, i) => mockCustomer({ ...item, id: `customer-${124 + i}` }));

      const insertMock = {
        select: jest.fn().mockResolvedValue({
          data: createdRecords,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue(insertMock),
      });

      const result = await repository.createMany(items as any);

      expect(result).toEqual(createdRecords);
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        items.map(item => ({
          ...item,
          tenant_id: 'tenant-123',
        }))
      );
    });
  });

  describe('offline operations', () => {
    it('should sync offline operations when online', async () => {
      // Add some offline operations to localStorage
      const offlineOps = [
        {
          id: 'op-1',
          table: 'customers',
          operation: 'insert',
          data: { name: 'Offline Customer' },
          timestamp: new Date().toISOString(),
          synced: false,
        },
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(offlineOps));

      // Create new repository to load offline queue
      const newRepo = new TestRepository(mockSupabase);

      // Mock successful create
      const insertMock = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCustomer({ name: 'Offline Customer' }),
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue(insertMock),
      });

      const syncedCount = await newRepo.syncOfflineOperations();

      expect(syncedCount).toBe(1);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_queue_customers',
        '[]'
      );
    });
  });
});
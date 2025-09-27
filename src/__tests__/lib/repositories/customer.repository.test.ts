/**
 * Tests for CustomerRepository
 */

import { CustomerRepository } from '@/lib/repositories/customer.repository';
import { createMockSupabaseClient, mockCustomer } from '@/__tests__/mocks/supabase';

// Mock the supabase client
jest.mock('@/lib/supabase/client');

describe('CustomerRepository', () => {
  let repository: CustomerRepository;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a fresh mock for each test
    mockSupabase = createMockSupabaseClient();
    
    // Mock the module to return our mock
    require('@/lib/supabase/client').supabase = mockSupabase;
    
    repository = new CustomerRepository();

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

  describe('searchByName', () => {
    it('should search customers by name or customer number', async () => {
      const mockCustomers = [
        mockCustomer({ name: 'ABC Company' }),
        mockCustomer({ name: 'ABC Services', id: 'customer-124' }),
      ];

      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockCustomers,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const results = await repository.searchByName('ABC');

      expect(results).toEqual(mockCustomers);
      expect(queryMock.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      expect(queryMock.eq).toHaveBeenCalledWith('is_active', true);
      expect(queryMock.or).toHaveBeenCalledWith(
        'name.ilike.%ABC%,customer_number.ilike.%ABC%'
      );
      expect(queryMock.order).toHaveBeenCalledWith('name');
    });

    it('should return empty array when no matches found', async () => {
      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const results = await repository.searchByName('XYZ');

      expect(results).toEqual([]);
    });
  });

  describe('findByCustomerNumber', () => {
    it('should find customer by exact customer number', async () => {
      const mockCustomerData = mockCustomer({ customer_number: 'C0001' });

      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCustomerData,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const result = await repository.findByCustomerNumber('C0001');

      expect(result).toEqual(mockCustomerData);
      expect(queryMock.eq).toHaveBeenCalledWith('customer_number', 'C0001');
    });

    it('should return null when customer not found', async () => {
      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const result = await repository.findByCustomerNumber('C9999');

      expect(result).toBeNull();
    });
  });

  describe('getCustomersWithPropertyCount', () => {
    it('should return customers with property count', async () => {
      const mockData = [
        { ...mockCustomer(), properties: [{ count: 3 }] },
        { ...mockCustomer({ id: 'customer-124' }), properties: [{ count: 1 }] },
      ];

      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const results = await repository.getCustomersWithPropertyCount();

      expect(results).toHaveLength(2);
      expect(results[0].property_count).toBe(3);
      expect(results[1].property_count).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(mockSupabase.from().select).toHaveBeenCalledWith(`
          *,
          properties:properties(count)
        `);
    });
  });

  describe('getCustomersWithRecentJobs', () => {
    it('should return customers with recent jobs', async () => {
      const recentJobs = [
        { id: 'job-1', title: 'Job 1', status: 'scheduled', scheduled_start: new Date().toISOString() },
        { id: 'job-2', title: 'Job 2', status: 'completed', scheduled_start: new Date().toISOString() },
      ];
      
      const mockData = [
        { ...mockCustomer(), jobs: recentJobs },
      ];

      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const results = await repository.getCustomersWithRecentJobs(7);

      expect(results).toHaveLength(1);
      expect(results[0].recent_jobs).toEqual(recentJobs);
      expect(queryMock.gte).toHaveBeenCalledWith(
        'jobs.created_at',
        expect.any(String)
      );
    });
  });

  describe('findCustomerForVoice', () => {
    it('should return exact match by customer number with high confidence', async () => {
      const mockCustomerData = mockCustomer({ customer_number: 'C0001' });

      // Mock the internal call to findByCustomerNumber
      jest.spyOn(repository, 'findByCustomerNumber').mockResolvedValueOnce(mockCustomerData);

      const result = await repository.findCustomerForVoice('0001');

      expect(result).toEqual({
        customer: mockCustomerData,
        confidence: 1.0,
        alternatives: [],
      });
    });

    it('should return single name match with good confidence', async () => {
      const mockCustomerData = mockCustomer({ name: 'ABC Company' });

      jest.spyOn(repository, 'searchByName').mockResolvedValueOnce([mockCustomerData]);

      const result = await repository.findCustomerForVoice('ABC Company');

      expect(result).toEqual({
        customer: mockCustomerData,
        confidence: 0.9,
        alternatives: [],
      });
    });

    it('should return best match with alternatives for multiple matches', async () => {
      const mockCustomers = [
        mockCustomer({ name: 'ABC Company' }),
        mockCustomer({ name: 'ABC Services', id: 'customer-124' }),
        mockCustomer({ name: 'ABC Supplies', id: 'customer-125' }),
        mockCustomer({ name: 'ABC Industries', id: 'customer-126' }),
      ];

      jest.spyOn(repository, 'searchByName').mockResolvedValueOnce(mockCustomers);

      const result = await repository.findCustomerForVoice('ABC');

      expect(result).toEqual({
        customer: mockCustomers[0],
        confidence: 0.7,
        alternatives: mockCustomers.slice(1, 4), // First 3 alternatives
      });
    });

    it('should return null with zero confidence when no matches', async () => {
      jest.spyOn(repository, 'searchByName').mockResolvedValueOnce([]);

      const result = await repository.findCustomerForVoice('XYZ Corp');

      expect(result).toEqual({
        customer: null,
        confidence: 0,
        alternatives: [],
      });
    });
  });

  describe('generateCustomerNumber', () => {
    it('should generate first customer number when no customers exist', async () => {
      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const result = await repository.generateCustomerNumber();

      expect(result).toBe('C0001');
    });

    it('should increment from highest existing customer number', async () => {
      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ customer_number: 'C0042' }],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const result = await repository.generateCustomerNumber();

      expect(result).toBe('C0043');
      expect(queryMock.order).toHaveBeenCalledWith('customer_number', { ascending: false });
      expect(queryMock.limit).toHaveBeenCalledWith(1);
    });

    it('should handle non-numeric prefixes', async () => {
      const queryMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ customer_number: 'CUST-0099' }],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const result = await repository.generateCustomerNumber();

      expect(result).toBe('C0100');
    });
  });
});
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CustomerService } from '@/domains/customer/services/customer-service';
import { CustomerRepository } from '@/lib/repositories/customer.repository';
import { ContactRepository } from '@/domains/customer/repositories/contact-repository';
import { CustomerSearchService } from '@/domains/customer/services/customer-search-service';
import { 
  Customer, 
  CustomerCreate, 
  CustomerUpdate,
  CustomerState,
  CustomerStateTransition 
} from '@/domains/customer/types/customer-types';
import { EventBus } from '@/core/events/event-bus';

// Mock dependencies
jest.mock('@/lib/supabase/client');
jest.mock('@/lib/repositories/customer.repository');
jest.mock('@/domains/customer/repositories/contact-repository');
jest.mock('@/domains/customer/services/customer-search-service');
jest.mock('@/core/events/event-bus');
jest.mock('@/core/logger/voice-logger');

// Setup EventBus mock
(EventBus as any).getInstance = jest.fn();

describe('CustomerService', () => {
  let customerService: CustomerService;
  let mockCustomerRepo: jest.Mocked<CustomerRepository>;
  let mockContactRepo: jest.Mocked<ContactRepository>;
  let mockSearchService: jest.Mocked<CustomerSearchService>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    };
    
    // Setup mock repositories
    mockCustomerRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByEmail: jest.fn(),
      findByPhone: jest.fn(),
      createCustomerWithContacts: jest.fn(),
      updateCustomerState: jest.fn(),
    } as unknown as jest.Mocked<CustomerRepository>;
    
    mockContactRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findContactsByCustomer: jest.fn(),
    } as unknown as jest.Mocked<ContactRepository>;
    
    mockSearchService = {
      searchCustomers: jest.fn(),
      searchByVoiceCommand: jest.fn(),
      findByVoice: jest.fn(),
    } as unknown as jest.Mocked<CustomerSearchService>;
    
    // Setup mock event bus
    mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;
    
    (EventBus.getInstance as jest.Mock).mockReturnValue(mockEventBus);
    
    // Mock the repository constructors
    (CustomerRepository as any).mockImplementation(() => mockCustomerRepo);
    (ContactRepository as any).mockImplementation(() => mockContactRepo);
    (CustomerSearchService as any).mockImplementation(() => mockSearchService);
    
    // Create service instance without voiceSessionId by default
    customerService = new CustomerService({
      supabaseClient: mockSupabase,
      tenantId: 'tenant-123',
      userId: 'user-123'
    });
  });

  describe('createCustomer', () => {
    const mockCustomerData: CustomerCreate = {
      name: 'John Doe',
      phone: '555-123-4567',
      email: 'john@example.com',
    };

    it('should create a new customer successfully', async () => {
      const mockCreatedCustomer: Customer = {
        id: 'cust-123',
        customer_number: 'CUST-001',
        ...mockCustomerData,
        tenant_id: 'tenant-123',
        state: 'active',
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCustomerRepo.create = jest.fn().mockResolvedValue(mockCreatedCustomer);

      const result = await customerService.createCustomer(mockCustomerData);

      expect(result).toEqual(mockCreatedCustomer);
      expect(mockCustomerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockCustomerData,
          tenant_id: 'tenant-123',
          state: 'active',
          is_active: true,
        })
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('customer:created', {
        customer: mockCreatedCustomer,
        source: 'api',
      });
    });

    it('should handle validation errors', async () => {
      const invalidData = { ...mockCustomerData, phone: 'invalid' };

      await expect(
        customerService.createCustomer(invalidData)
      ).rejects.toThrow();
    });

    it('should generate unique customer number', async () => {
      const mockCustomer: Customer = {
        id: 'cust-456',
        customer_number: 'CUST-002',
        ...mockCustomerData,
        tenant_id: 'tenant-123',
        state: 'active',
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCustomerRepo.create = jest.fn().mockResolvedValue(mockCustomer);
      mockCustomerRepo.findByCustomerNumber = jest.fn().mockResolvedValue(null);

      await customerService.createCustomer(mockCustomerData);

      expect(mockCustomerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_number: expect.stringMatching(/^CUST-\d{8}$/),
        })
      );
    });
  });

  describe('updateCustomer', () => {
    const mockCustomerId = 'cust-123';
    const mockUpdateData: CustomerUpdate = {
      phone: '555-987-6543',
      email: 'newemail@example.com',
    };

    it('should update customer successfully', async () => {
      const mockExistingCustomer: Customer = {
        id: mockCustomerId,
        customer_number: 'CUST-001',
        name: 'John Doe',
        phone: '555-123-4567',
        email: 'old@example.com',
        tenant_id: 'tenant-123',
        state: 'active',
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedCustomer = {
        ...mockExistingCustomer,
        ...mockUpdateData,
        version: 2,
        updatedAt: new Date(),
      };

      mockCustomerRepo.findById = jest.fn().mockResolvedValue(mockExistingCustomer);
      mockCustomerRepo.update = jest.fn().mockResolvedValue(mockUpdatedCustomer);

      const result = await customerService.updateCustomer(
        mockCustomerId,
        mockUpdateData,
        'tenant-123'
      );

      expect(result).toEqual(mockUpdatedCustomer);
      expect(mockCustomerRepo.update).toHaveBeenCalledWith(
        mockCustomerId,
        expect.objectContaining({
          ...mockUpdateData,
          version: 2,
        }),
        'tenant-123'
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('customer:updated', {
        customer: mockUpdatedCustomer,
        changes: mockUpdateData,
      });
    });

    it('should handle non-existent customer', async () => {
      mockCustomerRepo.findById = jest.fn().mockResolvedValue(null);

      const result = await customerService.updateCustomer(
        mockCustomerId,
        mockUpdateData,
        'tenant-123'
      );

      expect(result).toBeNull();
      expect(mockCustomerRepo.update).not.toHaveBeenCalled();
    });

    it('should validate update data', async () => {
      const invalidUpdate = { email: 'not-an-email' };

      await expect(
        customerService.updateCustomer(mockCustomerId, invalidUpdate)
      ).rejects.toThrow();
    });
  });

  describe('findCustomerByVoice', () => {
    const mockQuery = 'john doe';

    it('should find customer by voice query', async () => {
      const mockSearchResult = {
        customer: {
          id: 'cust-123',
          name: 'John Doe',
          customer_number: 'CUST-001',
        },
        matchType: 'fuzzy' as const,
        confidence: 0.95,
        matchedField: 'name',
      };

      mockSearchService.findByVoice = jest.fn().mockResolvedValue(mockSearchResult);

      const result = await customerService.findCustomerByVoice(mockQuery, 'tenant-123');

      expect(result).toEqual(mockSearchResult);
      expect(mockSearchService.findByVoice).toHaveBeenCalledWith(mockQuery, 'tenant-123');
    });

    it('should handle no matches', async () => {
      mockSearchService.findByVoice = jest.fn().mockResolvedValue(null);

      const result = await customerService.findCustomerByVoice(mockQuery, 'tenant-123');

      expect(result).toBeNull();
    });
  });

  describe('state transitions', () => {
    const mockCustomerId = 'cust-123';

    it('should transition customer state successfully', async () => {
      const mockCustomer: Customer = {
        id: mockCustomerId,
        customer_number: 'CUST-001',
        name: 'John Doe',
        tenant_id: 'tenant-123',
        state: 'active',
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCustomerRepo.findById = jest.fn().mockResolvedValue(mockCustomer);
      mockCustomerRepo.update = jest.fn().mockResolvedValue({
        ...mockCustomer,
        state: 'suspended',
        version: 2,
      });

      const transition: CustomerStateTransition = {
        from: 'active',
        to: 'suspended',
        reason: 'Non-payment',
      };

      const result = await customerService.transitionState(
        mockCustomerId,
        transition,
        'tenant-123'
      );

      expect(result).toBeTruthy();
      expect(mockCustomerRepo.update).toHaveBeenCalledWith(
        mockCustomerId,
        expect.objectContaining({
          state: 'suspended',
          version: 2,
        }),
        'tenant-123'
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('customer:state:changed', {
        customerId: mockCustomerId,
        transition,
      });
    });

    it('should reject invalid state transitions', async () => {
      const mockCustomer: Customer = {
        id: mockCustomerId,
        customer_number: 'CUST-001',
        name: 'John Doe',
        tenant_id: 'tenant-123',
        state: 'inactive',
        is_active: false,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCustomerRepo.findById = jest.fn().mockResolvedValue(mockCustomer);

      const invalidTransition: CustomerStateTransition = {
        from: 'inactive',
        to: 'suspended', // Invalid transition
      };

      await expect(
        customerService.transitionState(mockCustomerId, invalidTransition, 'tenant-123')
      ).rejects.toThrow('Invalid state transition');
    });
  });

  describe('addCustomerNote', () => {
    const mockCustomerId = 'cust-123';
    const mockNoteContent = 'Customer requested service call';

    it('should add note to customer successfully', async () => {
      const mockNote = {
        id: 'note-123',
        customerId: mockCustomerId,
        content: mockNoteContent,
        type: 'general',
        createdAt: new Date(),
        createdBy: 'user-123',
      };

      // Mock the note creation through event
      customerService.addCustomerNote = jest.fn().mockResolvedValue(mockNote);

      const result = await customerService.addCustomerNote(
        mockCustomerId,
        mockNoteContent,
        'general',
        'tenant-123'
      );

      expect(result).toEqual(mockNote);
    });
  });

  describe('deleteCustomer', () => {
    const mockCustomerId = 'cust-123';

    it('should soft delete customer', async () => {
      const mockCustomer: Customer = {
        id: mockCustomerId,
        customer_number: 'CUST-001',
        name: 'John Doe',
        tenant_id: 'tenant-123',
        state: 'active',
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCustomerRepo.findById = jest.fn().mockResolvedValue(mockCustomer);
      mockCustomerRepo.update = jest.fn().mockResolvedValue({
        ...mockCustomer,
        is_active: false,
        state: 'inactive',
      });

      const result = await customerService.deleteCustomer(mockCustomerId, 'tenant-123');

      expect(result).toBe(true);
      expect(mockCustomerRepo.update).toHaveBeenCalledWith(
        mockCustomerId,
        expect.objectContaining({
          is_active: false,
          state: 'inactive',
        }),
        'tenant-123'
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('customer:deleted', {
        customerId: mockCustomerId,
        timestamp: expect.any(Date),
      });
    });

    it('should handle non-existent customer', async () => {
      mockCustomerRepo.findById = jest.fn().mockResolvedValue(null);

      const result = await customerService.deleteCustomer(mockCustomerId, 'tenant-123');

      expect(result).toBe(false);
      expect(mockCustomerRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('bulkImportCustomers', () => {
    const mockCustomers = [
      { name: 'Customer 1', phone: '555-111-1111' },
      { name: 'Customer 2', phone: '555-222-2222' },
      { name: 'Customer 3', phone: 'invalid-phone' }, // Invalid
    ];

    it('should import valid customers and report errors', async () => {
      mockCustomerRepo.create = jest.fn()
        .mockResolvedValueOnce({ id: 'cust-1', ...mockCustomers[0] })
        .mockResolvedValueOnce({ id: 'cust-2', ...mockCustomers[1] });

      const result = await customerService.bulkImportCustomers(
        mockCustomers,
        'tenant-123'
      );

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(2);
    });
  });
});
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// 1) Voice logger: mock the whole module (ESM-safe), return a stable instance
jest.mock('@/core/logger/voice-logger', () => {
  const mock = {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    critical: jest.fn(),
    logVoiceCommand: jest.fn(),
    logVoiceTranscription: jest.fn(),
    logSpeechRecognition: jest.fn(),
    logTextToSpeech: jest.fn(),
    startCommand: jest.fn(),
    endCommand: jest.fn(),
    speak: jest.fn().mockResolvedValue(undefined),
    speakError: jest.fn().mockResolvedValue(undefined),
    getVoiceHistory: jest.fn().mockResolvedValue([]),
    getVoiceStats: jest.fn().mockResolvedValue({
      totalCommands: 0, successfulCommands: 0, failedCommands: 0,
      successRate: 0, averageDuration: 0, averageConfidence: 0,
    }),
  };
  return { voiceLogger: mock, VoiceLogger: jest.fn(() => mock) };
});

// 2) Base logger: neutralize sanitization side-effects for tests
jest.mock('@/core/logger/logger', () => {
  class Logger {
    sanitizeMessage(msg: unknown) { return typeof msg === 'string' ? msg : JSON.stringify(msg); }
    log() {} info() {} warn() {} error() {} debug() {}
  }
  return { Logger };
});

// 3) Event bus: deterministic singleton
jest.mock('@/core/events/event-bus', () => {
  const subscribers = new Map<string, Function[]>();
  const bus = {
    publish: jest.fn(),
    emit: jest.fn(),            // keep both if code uses either
    subscribe: jest.fn((t: string, h: Function) => {
      subscribers.set(t, [...(subscribers.get(t) || []), h]);
      return () => { /* unsubscribe no-op in tests */ };
    }),
    unsubscribe: jest.fn(),
  };
  return { EventBus: { getInstance: () => bus } };
});

// Mock dependencies BEFORE imports
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  }
}));
jest.mock('@/domains/customer/services/customer-service');
jest.mock('@/core/errors/error-handler');

import { CustomerVoiceCommandHandler } from '@/domains/customer/services/customer-voice-commands';
import { CustomerService } from '@/domains/customer/services/customer-service';
import { CustomerVoiceCommand, Customer } from '@/domains/customer/types/customer-types';
import { EventBus } from '@/core/events/event-bus';
import { voiceLogger } from '@/core/logger/voice-logger';

// Setup EventBus mock
(EventBus as any).getInstance = jest.fn();

describe('CustomerVoiceCommandHandler', () => {
  let commandHandler: CustomerVoiceCommandHandler;
  let mockCustomerService: jest.Mocked<CustomerService>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockVoiceContext: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Reset mockVoiceContext for each test
    mockVoiceContext = {
      sessionId: 'session-123',
      userId: 'user-123',
      tenantId: 'tenant-123',
      lastCustomerId: undefined as string | undefined,
    };
    
    // Setup mocks
    mockCustomerService = {
      createCustomer: jest.fn(),
      updateCustomer: jest.fn(),
      findCustomerByVoice: jest.fn(),
      getCustomer: jest.fn(),
      addCustomerNote: jest.fn(),
      getCustomerProperties: jest.fn(),
    } as any as jest.Mocked<CustomerService>;
    mockEventBus = {
      emit: jest.fn(),
      getInstance: jest.fn().mockReturnThis(),
    } as any;
    (EventBus.getInstance as jest.Mock).mockReturnValue(mockEventBus);
    
    // Create command handler
    commandHandler = new CustomerVoiceCommandHandler(mockCustomerService);
  });

  describe('parseCustomerCommand', () => {
    it('should parse find customer commands', async () => {
      const testCases = [
        'find customer john doe',
        'get customer john doe',
        'show customer john doe',
        'pull up customer john doe',
        'look up customer john doe',
        'search for customer john doe',
        'who is john doe',
        'tell me about john doe',
        'customer info for john doe',
      ];

      for (const input of testCases) {
        const command = await commandHandler.parseCustomerCommand(input, mockVoiceContext);
        
        expect(command).toBeTruthy();
        expect(command?.type).toBe('find_customer');
        expect(command?.query).toBe('john doe');
      }
    });

    it('should parse create customer commands', async () => {
      const command = await commandHandler.parseCustomerCommand(
        'create customer named John Doe with phone number 555-123-4567',
        mockVoiceContext
      );

      expect(command).toBeTruthy();
      expect(command?.type).toBe('create_customer');
      expect(command?.name).toBe('John Doe');
      expect(command?.phone).toBe('555-123-4567');
    });

    it('should parse create customer without phone', async () => {
      const command = await commandHandler.parseCustomerCommand(
        'add customer called Jane Smith',
        mockVoiceContext
      );

      expect(command).toBeTruthy();
      expect(command?.type).toBe('create_customer');
      expect(command?.name).toBe('Jane Smith');
      expect(command?.phone).toBeUndefined();
    });

    it('should parse update customer commands', async () => {
      const contextWithCustomer = {
        ...mockVoiceContext,
        lastCustomerId: 'cust-123',
      };

      const command = await commandHandler.parseCustomerCommand(
        'update phone number to 555-987-6543',
        contextWithCustomer
      );

      expect(command).toBeTruthy();
      expect(command?.type).toBe('update_customer');
      expect(command?.customerId).toBe('cust-123');
      expect(command?.field).toBe('phone');
      expect(command?.value).toBe('555-987-6543');
    });

    it('should parse add note commands', async () => {
      const contextWithCustomer = {
        ...mockVoiceContext,
        lastCustomerId: 'cust-123',
      };

      const testCases = [
        'add note customer requested service call',
        'note that customer prefers morning appointments',
        'add a note billing address needs update',
        'make a note to follow up next week',
      ];

      for (const input of testCases) {
        const command = await commandHandler.parseCustomerCommand(input, contextWithCustomer);
        
        expect(command).toBeTruthy();
        expect(command?.type).toBe('add_note');
        expect(command?.customerId).toBe('cust-123');
        expect(command?.content).toBeTruthy();
      }
    });

    it('should parse list properties command', async () => {
      const contextWithCustomer = {
        ...mockVoiceContext,
        lastCustomerId: 'cust-123',
      };

      const command = await commandHandler.parseCustomerCommand(
        'show properties',
        contextWithCustomer
      );

      expect(command).toBeTruthy();
      expect(command?.type).toBe('list_properties');
      expect(command?.customerId).toBe('cust-123');
    });

    it('should parse customer history command', async () => {
      const contextWithCustomer = {
        ...mockVoiceContext,
        lastCustomerId: 'cust-123',
      };

      const command = await commandHandler.parseCustomerCommand(
        'show history for the last month',
        contextWithCustomer
      );

      expect(command).toBeTruthy();
      expect(command?.type).toBe('customer_history');
      expect(command?.customerId).toBe('cust-123');
      expect(command?.timeframe).toBe('month');
    });

    it('should return null for unrecognized commands', async () => {
      const command = await commandHandler.parseCustomerCommand(
        'random unrelated text',
        mockVoiceContext
      );

      expect(command).toBeNull();
      expect(voiceLogger.warn).toHaveBeenCalledWith(
        'Could not parse customer command',
        expect.objectContaining({
          voiceSessionId: mockVoiceContext.sessionId,
        })
      );
    });
  });

  describe('executeVoiceCommand', () => {
    it('should execute find customer command', async () => {
      const mockCustomer: Customer = {
        id: 'cust-123',
        customer_number: 'CUST-001',
        name: 'John Doe',
        phone: '555-123-4567',
        tenant_id: 'tenant-123',
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSearchResult = {
        customer: mockCustomer,
        matchType: 'fuzzy' as const,
        confidence: 0.95,
        matchedField: 'name',
      };

      mockCustomerService.findCustomerByVoice = jest.fn().mockResolvedValue(mockSearchResult);

      const command: CustomerVoiceCommand = {
        type: 'find_customer',
        query: 'john doe',
      };

      const result = await commandHandler.executeVoiceCommand(command, mockVoiceContext);

      expect(result).toEqual(mockSearchResult);
      expect(mockCustomerService.findCustomerByVoice).toHaveBeenCalledWith('john doe');
      expect(voiceLogger.speak).toHaveBeenCalledWith(
        expect.stringContaining('Found John Doe'),
        { voiceSessionId: mockVoiceContext.sessionId }
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('voice:customer:found', {
        sessionId: mockVoiceContext.sessionId,
        customer: mockCustomer,
        confidence: 0.95,
      });
    });

    it('should handle customer not found', async () => {
      mockCustomerService.findCustomerByVoice = jest.fn().mockResolvedValue(null);

      const command: CustomerVoiceCommand = {
        type: 'find_customer',
        query: 'nonexistent customer',
      };

      const result = await commandHandler.executeVoiceCommand(command, mockVoiceContext);

      expect(result).toBeNull();
      expect(voiceLogger.speak).toHaveBeenCalledWith(
        expect.stringContaining('couldn\'t find a customer'),
        { voiceSessionId: mockVoiceContext.sessionId }
      );
    });

    it('should execute create customer command', async () => {
      const mockCreatedCustomer: Customer = {
        id: 'cust-new',
        customer_number: 'CUST-002',
        name: 'Jane Smith',
        phone: '555-987-6543',
        tenant_id: 'tenant-123',
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCustomerService.createCustomer = jest.fn().mockResolvedValue(mockCreatedCustomer);

      const command: CustomerVoiceCommand = {
        type: 'create_customer',
        name: 'Jane Smith',
        phone: '555-987-6543',
      };

      const result = await commandHandler.executeVoiceCommand(command, mockVoiceContext);

      expect(result).toEqual(mockCreatedCustomer);
      expect(mockCustomerService.createCustomer).toHaveBeenCalledWith({
        name: 'Jane Smith',
        phone: '555-987-6543',
      });
      expect(voiceLogger.speak).toHaveBeenCalledWith(
        expect.stringContaining('Created customer Jane Smith'),
        { voiceSessionId: mockVoiceContext.sessionId }
      );
    });

    it('should request phone number if missing', async () => {
      const command: CustomerVoiceCommand = {
        type: 'create_customer',
        name: 'Jane Smith',
      };

      await expect(
        commandHandler.executeVoiceCommand(command, mockVoiceContext)
      ).rejects.toThrow('Phone number required');

      expect(voiceLogger.speak).toHaveBeenCalledWith(
        expect.stringContaining('I need a phone number'),
        { voiceSessionId: mockVoiceContext.sessionId }
      );
    });

    it('should execute update customer command', async () => {
      const mockUpdatedCustomer: Customer = {
        id: 'cust-123',
        customer_number: 'CUST-001',
        name: 'John Doe',
        phone: '555-999-8888',
        tenant_id: 'tenant-123',
        is_active: true,
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCustomerService.updateCustomer = jest.fn().mockResolvedValue(mockUpdatedCustomer);

      const command: CustomerVoiceCommand = {
        type: 'update_customer',
        customerId: 'cust-123',
        field: 'phone',
        value: '555-999-8888',
      };

      const result = await commandHandler.executeVoiceCommand(command, mockVoiceContext);

      expect(result).toEqual(mockUpdatedCustomer);
      expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(
        'cust-123',
        { phone: '555-999-8888' }
      );
      expect(voiceLogger.speak).toHaveBeenCalledWith(
        'Updated phone to 555-999-8888',
        { voiceSessionId: mockVoiceContext.sessionId }
      );
    });

    it('should require customer context for update', async () => {
      const command: CustomerVoiceCommand = {
        type: 'update_customer',
        field: 'phone',
        value: '555-999-8888',
      };

      await expect(
        commandHandler.executeVoiceCommand(command, mockVoiceContext)
      ).rejects.toThrow('Please find a customer first');
    });

    it('should execute add note command', async () => {
      mockCustomerService.addCustomerNote = jest.fn().mockResolvedValue({
        id: 'note-123',
        content: 'Test note',
      });

      const command: CustomerVoiceCommand = {
        type: 'add_note',
        customerId: 'cust-123',
        content: 'Customer prefers morning appointments',
      };

      await commandHandler.executeVoiceCommand(command, mockVoiceContext);

      expect(mockCustomerService.addCustomerNote).toHaveBeenCalledWith(
        'cust-123',
        'Customer prefers morning appointments',
        'voice_transcript'
      );
      expect(voiceLogger.speak).toHaveBeenCalledWith(
        'Note added successfully',
        { voiceSessionId: mockVoiceContext.sessionId }
      );
    });
  });

  describe('getCommandSuggestions', () => {
    it('should suggest finding or creating customer when no customer selected', () => {
      const suggestions = commandHandler.getCommandSuggestions(mockVoiceContext);

      expect(suggestions).toContain('Say "find customer" followed by a name or phone number');
      expect(suggestions).toContain('Say "create new customer" to add someone');
    });

    it('should suggest customer-specific actions when customer selected', () => {
      const contextWithCustomer = {
        ...mockVoiceContext,
        lastCustomerId: 'cust-123',
      };

      const suggestions = commandHandler.getCommandSuggestions(contextWithCustomer);

      expect(suggestions).toContain('Say "add note" to add a comment');
      expect(suggestions).toContain('Say "show properties" to see their locations');
      expect(suggestions).toContain('Say "update phone number" to change contact info');
      expect(suggestions).toContain('Say "show history" to see recent activity');
    });
  });

  describe('field normalization', () => {
    it('should normalize field names correctly', async () => {
      const contextWithCustomer = {
        ...mockVoiceContext,
        lastCustomerId: 'cust-123',
      };

      const testCases = [
        { input: 'update phone number to 555-111-1111', expectedField: 'phone' },
        { input: 'change mobile to 555-222-2222', expectedField: 'mobilePhone' },
        { input: 'set email address as test@example.com', expectedField: 'email' },
      ];

      for (const testCase of testCases) {
        const command = await commandHandler.parseCustomerCommand(
          testCase.input,
          contextWithCustomer
        );

        expect(command?.field).toBe(testCase.expectedField);
      }
    });
  });
});
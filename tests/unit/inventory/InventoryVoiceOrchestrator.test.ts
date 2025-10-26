/**
 * @file tests/unit/inventory/InventoryVoiceOrchestrator.test.ts
 * @purpose Unit tests for InventoryVoiceOrchestrator
 * @coverage Intent routing, entity resolution, CRUD operation execution
 */

import { InventoryVoiceOrchestrator } from '@/domains/inventory/services/inventory-voice-orchestrator.service';
import * as checkInService from '@/domains/inventory/services/check-in.service';
import * as checkOutService from '@/domains/inventory/services/check-out.service';
import * as transferService from '@/domains/inventory/services/transfer.service';
import * as inventoryItemsRepo from '@/domains/inventory/repositories/inventory-items.repository';
import { EquipmentRepository } from '@/domains/equipment/repositories/equipment-repository';
import { MaterialRepository } from '@/domains/material/repositories/material-repository';
import { VoiceLogger } from '@/core/logger/voice-logger';
import { VoiceIntentResult } from '@/domains/intent/types/voice-intent-types';

// Mock dependencies
jest.mock('@/domains/inventory/services/check-in.service');
jest.mock('@/domains/inventory/services/check-out.service');
jest.mock('@/domains/inventory/services/transfer.service');
jest.mock('@/domains/inventory/repositories/inventory-items.repository');
jest.mock('@/domains/equipment/repositories/equipment-repository');
jest.mock('@/domains/material/repositories/material-repository');
jest.mock('@/core/logger/voice-logger');
jest.mock('@/lib/supabase/server');

describe('InventoryVoiceOrchestrator', () => {
  let orchestrator: InventoryVoiceOrchestrator;
  let mockVoiceLogger: jest.Mocked<VoiceLogger>;

  const testUserId = 'user-123';
  const testTenantId = 'tenant-456';
  const testSessionId = 'session-789';

  beforeEach(() => {
    mockVoiceLogger = {
      logVoiceCommand: jest.fn().mockResolvedValue(undefined),
    } as any;

    (VoiceLogger as jest.Mock).mockImplementation(() => mockVoiceLogger);

    orchestrator = new InventoryVoiceOrchestrator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCheckIn', () => {
    it('should execute check-in with complete entities', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer', 'drill'],
          quantities: [5, 2],
          jobId: '123',
          toLocationName: 'warehouse',
        },
        confidence: 0.95,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      // Mock item resolution
      (inventoryItemsRepo.findAll as jest.Mock)
        .mockResolvedValueOnce({
          data: [{ id: 'item-1', name: 'hammer' }],
          error: null,
          count: 1,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'item-2', name: 'drill' }],
          error: null,
          count: 1,
        });

      // Mock check-in service
      (checkInService.checkIn as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [
          { id: 'txn-1', item_id: 'item-1' },
          { id: 'txn-2', item_id: 'item-2' },
        ],
        updatedItems: [],
        closedAssignments: [],
      });

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId,
        testSessionId
      );

      expect(result.success).toBe(true);
      expect(result.intent).toBe('check_in');
      expect(result.response_text).toContain('Checked in 2 item');
      expect(result.response_text).toContain('hammer, drill');
      expect(result.response_text).toContain('job 123');

      expect(checkInService.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: testTenantId,
          userId: testUserId,
          itemIds: ['item-1', 'item-2'],
          jobId: '123',
          voiceSessionId: testSessionId,
        })
      );
    });

    it('should return error when item names are missing', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'check_in',
        entities: {
          jobId: '123',
        },
        confidence: 0.7,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(false);
      expect(result.response_text).toContain('Which items');
      expect(checkInService.checkIn).not.toHaveBeenCalled();
    });

    it('should return error when job ID is missing', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
        },
        confidence: 0.7,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(false);
      expect(result.response_text).toContain('Which job');
      expect(checkInService.checkIn).not.toHaveBeenCalled();
    });

    it('should handle items not found', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'check_in',
        entities: {
          itemNames: ['nonexistent-item'],
          jobId: '123',
        },
        confidence: 0.8,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(false);
      expect(result.response_text).toContain('couldn\'t find');
      expect(result.response_text).toContain('nonexistent-item');
    });
  });

  describe('handleCheckOut', () => {
    it('should execute check-out with complete entities', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'check_out',
        entities: {
          itemNames: ['shovel'],
          quantities: [3],
          jobId: '456',
        },
        confidence: 0.92,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'item-3', name: 'shovel' }],
        error: null,
        count: 1,
      });

      (checkOutService.checkOut as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [{ id: 'txn-3' }],
        updatedItems: [],
        containerAssignments: [],
      });

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(true);
      expect(result.response_text).toContain('Checked out');
      expect(result.response_text).toContain('job 456');

      expect(checkOutService.checkOut).toHaveBeenCalledWith(
        expect.objectContaining({
          itemIds: ['item-3'],
          jobId: '456',
        })
      );
    });
  });

  describe('handleTransfer', () => {
    it('should execute transfer with complete location entities', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'transfer',
        entities: {
          itemNames: ['ladder'],
          fromLocationName: 'Truck 5',
          toLocationName: 'Warehouse',
        },
        confidence: 0.89,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'item-4', name: 'ladder' }],
        error: null,
        count: 1,
      });

      (transferService.transfer as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [{ id: 'txn-4' }],
        updatedItems: [],
        containerAssignments: [],
      });

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(true);
      expect(result.response_text).toContain('Transferred');
      expect(result.response_text).toContain('Truck 5');
      expect(result.response_text).toContain('Warehouse');

      expect(transferService.transfer).toHaveBeenCalled();
    });

    it('should return error when source location is missing', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'transfer',
        entities: {
          itemNames: ['ladder'],
          toLocationName: 'Warehouse',
        },
        confidence: 0.7,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(false);
      expect(result.response_text).toContain('Where are you transferring');
      expect(transferService.transfer).not.toHaveBeenCalled();
    });
  });

  describe('handleInventoryAdd', () => {
    it('should create new equipment item', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'inventory_add',
        entities: {
          itemNames: ['chainsaw'],
          notes: 'New equipment',
        },
        confidence: 0.88,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      const mockEquipmentRepo = {
        createEquipment: jest.fn().mockResolvedValue({
          id: 'new-item-1',
          name: 'chainsaw',
        }),
      };

      (EquipmentRepository as jest.Mock).mockImplementation(() => mockEquipmentRepo);

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId,
        testSessionId
      );

      expect(result.success).toBe(true);
      expect(result.response_text).toContain('Added 1 new item');
      expect(result.response_text).toContain('chainsaw');

      expect(mockEquipmentRepo.createEquipment).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'chainsaw',
          notes: 'New equipment',
          voiceMetadata: expect.objectContaining({
            createdViaVoice: true,
            voiceSessionId: testSessionId,
          }),
        }),
        testTenantId
      );
    });

    it('should create multiple items', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'inventory_add',
        entities: {
          itemNames: ['shovel', 'rake'],
        },
        confidence: 0.9,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      const mockEquipmentRepo = {
        createEquipment: jest.fn()
          .mockResolvedValueOnce({ id: 'item-5', name: 'shovel' })
          .mockResolvedValueOnce({ id: 'item-6', name: 'rake' }),
      };

      (EquipmentRepository as jest.Mock).mockImplementation(() => mockEquipmentRepo);

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(true);
      expect(result.response_text).toContain('Added 2 new items');
      expect(mockEquipmentRepo.createEquipment).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleInventoryCheck', () => {
    it('should report status of found items', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'inventory_check',
        entities: {
          itemNames: ['drill'],
        },
        confidence: 0.85,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'item-7',
            name: 'drill',
            status: 'active',
            current_location_id: 'loc-1',
          },
        ],
        error: null,
        count: 1,
      });

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(true);
      expect(result.response_text).toContain('Found 1 drill');
      expect(result.response_text).toContain('available');
    });

    it('should report when items are not found', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'inventory_check',
        entities: {
          itemNames: ['unicorn'],
        },
        confidence: 0.8,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(true);
      expect(result.response_text).toContain('couldn\'t find any');
      expect(result.response_text).toContain('unicorn');
    });
  });

  describe('unsupported intents', () => {
    it('should return error for unsupported intent', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'unknown' as any,
        entities: {},
        confidence: 0.5,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      const result = await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId
      );

      expect(result.success).toBe(false);
      expect(result.response_text).toContain('don\'t know how to handle');
    });
  });

  describe('voice logging', () => {
    it('should log successful voice command', async () => {
      const mockIntent: VoiceIntentResult = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
          jobId: '123',
        },
        confidence: 0.9,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'item-1', name: 'hammer' }],
        error: null,
        count: 1,
      });

      (checkInService.checkIn as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [{ id: 'txn-1' }],
        updatedItems: [],
        closedAssignments: [],
      });

      await orchestrator.executeIntent(
        mockIntent,
        testUserId,
        testTenantId,
        testSessionId
      );

      expect(mockVoiceLogger.logVoiceCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          tenantId: testTenantId,
          command: 'check_in',
          intent: 'check_in',
          success: true,
          sessionId: testSessionId,
        })
      );
    });
  });
});

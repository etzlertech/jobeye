/**
 * @file tests/integration/voice-to-crud-flow.test.ts
 * @purpose Integration test for complete voice-to-CRUD flow
 * @coverage End-to-end: API → Intent → Orchestrator → Database
 */

import { createMocks } from 'node-mocks-http';
import { POST as voiceCommandPOST } from '@/app/api/voice/command/route';
import { POST as voiceConfirmPOST } from '@/app/api/voice/confirm/route';
import { GeminiIntentService } from '@/domains/intent/services/gemini-intent.service';
import { GeminiConfirmationService } from '@/domains/intent/services/gemini-confirmation.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as checkInService from '@/domains/inventory/services/check-in.service';
import * as inventoryItemsRepo from '@/domains/inventory/repositories/inventory-items.repository';

// Mock external dependencies
jest.mock('@google/generative-ai');
jest.mock('@/lib/auth/context');
jest.mock('@/domains/voice/services/text-to-speech-service');
jest.mock('@/domains/inventory/services/check-in.service');
jest.mock('@/domains/inventory/repositories/inventory-items.repository');

describe('Voice-to-CRUD Integration Flow', () => {
  let mockModel: any;
  let mockGenAI: jest.Mocked<GoogleGenerativeAI>;

  beforeEach(() => {
    // Setup Gemini mock
    mockModel = {
      generateContent: jest.fn(),
    };

    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    } as any;

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => mockGenAI);

    // Mock auth context
    const { getRequestContext } = require('@/lib/auth/context');
    getRequestContext.mockResolvedValue({
      user: {
        id: 'user-123',
        app_metadata: { role: 'supervisor' },
      },
      tenantId: 'tenant-456',
      isCrew: false,
      isSupervisor: true,
    });

    // Mock TTS
    const { TextToSpeechService } = require('@/domains/voice/services/text-to-speech-service');
    TextToSpeechService.prototype.speak = jest.fn().mockResolvedValue('http://audio-url.com/response.mp3');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Check-In Flow', () => {
    it('should process voice command and execute check-in', async () => {
      // Step 1: Mock intent classification
      const mockIntentResponse = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
          quantities: [5],
          jobId: '123',
        },
        confidence: 0.95,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockIntentResponse),
        },
      });

      // Step 2: Mock item resolution
      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'item-hammer', name: 'hammer' }],
        error: null,
        count: 1,
      });

      // Step 3: Mock check-in service
      (checkInService.checkIn as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [
          {
            id: 'txn-1',
            item_id: 'item-hammer',
            transaction_type: 'check_in',
            quantity: 5,
          },
        ],
        updatedItems: [{ id: 'item-hammer', name: 'hammer', status: 'active' }],
        closedAssignments: [],
      });

      // Step 4: Call API
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          transcript: 'Check in 5 hammers from job 123',
          context: {
            role: 'supervisor',
            currentPage: 'inventory',
          },
          settings: {
            use_browser_stt: true,
          },
        },
      });

      await voiceCommandPOST(req as any);

      // Step 5: Verify response
      const responseData = JSON.parse(res._getData());

      expect(responseData.success).toBe(true);
      expect(responseData.intent).toBe('check_in');
      expect(responseData.confidence).toBe(0.95);
      expect(responseData.needs_clarification).toBe(false);
      expect(responseData.action.executed).toBe(true);
      expect(responseData.response.text).toContain('Checked in');
      expect(responseData.response.text).toContain('hammer');
      expect(responseData.response.text).toContain('job 123');

      // Step 6: Verify check-in was called
      expect(checkInService.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-456',
          userId: 'user-123',
          itemIds: ['item-hammer'],
          jobId: '123',
        })
      );
    });

    it('should detect clarification need and respond appropriately', async () => {
      // Mock intent with missing entities
      const mockIntentResponse = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
        },
        confidence: 0.75,
        needs_clarification: true,
        follow_up: 'Which job should I check these items in from?',
        missing_entities: ['jobId'],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockIntentResponse),
        },
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          transcript: 'Check in 5 hammers',
          context: {
            role: 'supervisor',
          },
        },
      });

      await voiceCommandPOST(req as any);

      const responseData = JSON.parse(res._getData());

      expect(responseData.success).toBe(true);
      expect(responseData.needs_clarification).toBe(true);
      expect(responseData.follow_up).toContain('job');
      expect(responseData.action).toBeUndefined(); // No action executed

      // Check-in should NOT have been called
      expect(checkInService.checkIn).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Turn Clarification Flow', () => {
    it('should accumulate entities across multiple turns', async () => {
      // Turn 1: Initial command with missing job ID
      const mockIntentResponse1 = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
        },
        confidence: 0.7,
        needs_clarification: true,
        follow_up: 'Which job?',
        missing_entities: ['jobId'],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockIntentResponse1),
        },
      });

      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        body: {
          transcript: 'Check in hammer',
          context: {
            role: 'supervisor',
          },
        },
      });

      await voiceCommandPOST(req1 as any);

      const response1 = JSON.parse(res1._getData());
      expect(response1.needs_clarification).toBe(true);
      const conversationId = response1.conversation_id;

      // Turn 2: Provide job ID
      const mockIntentResponse2 = {
        entities: {
          itemNames: ['hammer'],
          jobId: '123',
        },
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockIntentResponse2),
        },
      });

      // Mock item resolution and check-in
      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'item-hammer', name: 'hammer' }],
        error: null,
        count: 1,
      });

      (checkInService.checkIn as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [{ id: 'txn-1' }],
        updatedItems: [],
        closedAssignments: [],
      });

      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        body: {
          transcript: 'Job 123',
          conversation_id: conversationId,
        },
      });

      await voiceCommandPOST(req2 as any);

      const response2 = JSON.parse(res2._getData());

      expect(response2.success).toBe(true);
      expect(response2.needs_clarification).toBe(false);
      expect(response2.action.executed).toBe(true);
      expect(checkInService.checkIn).toHaveBeenCalled();
    });
  });

  describe('Confirmation Flow', () => {
    it('should execute action after yes confirmation', async () => {
      const mockPreviousIntent = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
          jobId: '123',
        },
        confidence: 0.9,
      };

      // Mock confirmation service (yes)
      const mockConfirmationResponse = {
        confirmed: true,
        confidence: 1.0,
        interpretation: 'yes',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockConfirmationResponse),
        },
      });

      // Mock item resolution and check-in
      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'item-hammer', name: 'hammer' }],
        error: null,
        count: 1,
      });

      (checkInService.checkIn as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [{ id: 'txn-1' }],
        updatedItems: [],
        closedAssignments: [],
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          transcript: 'yes',
          previous_intent: mockPreviousIntent,
          confirmation_question: 'Are you sure you want to check in the hammer from job 123?',
        },
      });

      await voiceConfirmPOST(req as any);

      const responseData = JSON.parse(res._getData());

      expect(responseData.success).toBe(true);
      expect(responseData.confirmed).toBe(true);
      expect(responseData.interpretation).toBe('yes');
      expect(responseData.action.executed).toBe(true);
      expect(checkInService.checkIn).toHaveBeenCalled();
    });

    it('should cancel action after no confirmation', async () => {
      const mockPreviousIntent = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
          jobId: '123',
        },
        confidence: 0.9,
      };

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          transcript: 'no',
          previous_intent: mockPreviousIntent,
          confirmation_question: 'Are you sure?',
        },
      });

      await voiceConfirmPOST(req as any);

      const responseData = JSON.parse(res._getData());

      expect(responseData.success).toBe(true);
      expect(responseData.confirmed).toBe(false);
      expect(responseData.interpretation).toBe('no');
      expect(responseData.action).toBeUndefined();
      expect(checkInService.checkIn).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle items not found gracefully', async () => {
      const mockIntentResponse = {
        intent: 'check_in',
        entities: {
          itemNames: ['nonexistent-tool'],
          jobId: '123',
        },
        confidence: 0.9,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockIntentResponse),
        },
      });

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          transcript: 'Check in nonexistent-tool from job 123',
        },
      });

      await voiceCommandPOST(req as any);

      const responseData = JSON.parse(res._getData());

      expect(responseData.success).toBe(false);
      expect(responseData.response.text).toContain('couldn\'t find');
      expect(checkInService.checkIn).not.toHaveBeenCalled();
    });

    it('should handle check-in service errors', async () => {
      const mockIntentResponse = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
          jobId: '123',
        },
        confidence: 0.9,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockIntentResponse),
        },
      });

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'item-hammer', name: 'hammer' }],
        error: null,
        count: 1,
      });

      (checkInService.checkIn as jest.Mock).mockResolvedValue({
        success: false,
        transactions: [],
        updatedItems: [],
        closedAssignments: [],
        error: new Error('Database connection failed'),
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          transcript: 'Check in hammer from job 123',
        },
      });

      await voiceCommandPOST(req as any);

      const responseData = JSON.parse(res._getData());

      expect(responseData.success).toBe(false);
      expect(responseData.response.text).toContain('Failed');
    });
  });

  describe('Cost Tracking', () => {
    it('should track costs with browser STT', async () => {
      const mockIntentResponse = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
          jobId: '123',
        },
        confidence: 0.9,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockIntentResponse),
        },
      });

      (inventoryItemsRepo.findAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'item-hammer', name: 'hammer' }],
        error: null,
        count: 1,
      });

      (checkInService.checkIn as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [{ id: 'txn-1' }],
        updatedItems: [],
        closedAssignments: [],
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          transcript: 'Check in hammer from job 123',
          settings: {
            use_browser_stt: true,
          },
        },
      });

      await voiceCommandPOST(req as any);

      const responseData = JSON.parse(res._getData());

      expect(responseData.metadata.costUsd).toBeDefined();
      expect(responseData.metadata.costUsd).toBeLessThan(0.02); // Should be ~$0.015
      expect(responseData.metadata.sttProvider).toBeUndefined(); // No STT when transcript provided
    });
  });
});

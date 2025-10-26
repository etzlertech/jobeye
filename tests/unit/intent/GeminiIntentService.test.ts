/**
 * @file tests/unit/intent/GeminiIntentService.test.ts
 * @purpose Unit tests for GeminiIntentService
 * @coverage Intent classification, entity extraction, conversation tracking, clarification loops
 */

import { GeminiIntentService } from '@/domains/intent/services/gemini-intent.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIInteractionLogger } from '@/domains/intent/services/ai-interaction-logger.service';

// Mock dependencies
jest.mock('@google/generative-ai');
jest.mock('@/domains/intent/services/ai-interaction-logger.service');

describe('GeminiIntentService', () => {
  let service: GeminiIntentService;
  let mockModel: any;
  let mockGenAI: jest.Mocked<GoogleGenerativeAI>;
  let mockLogger: jest.Mocked<AIInteractionLogger>;

  beforeEach(() => {
    // Setup mock Gemini API
    mockModel = {
      generateContent: jest.fn(),
    };

    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    } as any;

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => mockGenAI);

    // Setup mock logger
    mockLogger = {
      logInteraction: jest.fn().mockResolvedValue(undefined),
    } as any;

    (AIInteractionLogger as jest.Mock).mockImplementation(() => mockLogger);

    // Create service
    service = new GeminiIntentService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyIntent', () => {
    it('should classify a simple check-in command with high confidence', async () => {
      // Mock Gemini response
      const mockResponse = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer', 'drill'],
          quantities: [5, 2],
          jobId: '123',
        },
        confidence: 0.95,
        needs_clarification: false,
        missing_entities: [],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      // Execute
      const result = await service.classifyIntent({
        transcript: 'Check in 5 hammers and 2 drills from job 123',
        context: {
          userRole: 'supervisor',
          currentPage: 'inventory',
        },
      });

      // Verify
      expect(result.intent).toBe('check_in');
      expect(result.entities.itemNames).toEqual(['hammer', 'drill']);
      expect(result.entities.quantities).toEqual([5, 2]);
      expect(result.entities.jobId).toBe('123');
      expect(result.confidence).toBe(0.95);
      expect(result.needs_clarification).toBe(false);
      expect(result.conversation_id).toBeDefined();
      expect(result.turn_number).toBe(1);
    });

    it('should detect missing entities and request clarification', async () => {
      const mockResponse = {
        intent: 'check_in',
        entities: {
          itemNames: ['hammer'],
        },
        confidence: 0.7,
        needs_clarification: true,
        follow_up: 'Which job should I check these items in from?',
        missing_entities: ['jobId'],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.classifyIntent({
        transcript: 'Check in 5 hammers',
        context: {
          userRole: 'supervisor',
        },
      });

      expect(result.intent).toBe('check_in');
      expect(result.needs_clarification).toBe(true);
      expect(result.follow_up).toContain('job');
      expect(result.missing_entities).toContain('jobId');
      expect(result.confidence).toBe(0.7);
    });

    it('should handle transfer intent with location entities', async () => {
      const mockResponse = {
        intent: 'transfer',
        entities: {
          itemNames: ['ladder'],
          fromLocationName: 'Truck 5',
          toLocationName: 'Warehouse',
        },
        confidence: 0.92,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.classifyIntent({
        transcript: 'Transfer the ladder from Truck 5 to Warehouse',
        context: {
          userRole: 'crew',
        },
      });

      expect(result.intent).toBe('transfer');
      expect(result.entities.fromLocationName).toBe('Truck 5');
      expect(result.entities.toLocationName).toBe('Warehouse');
    });

    it('should handle inventory add intent', async () => {
      const mockResponse = {
        intent: 'inventory_add',
        entities: {
          itemNames: ['chainsaw', 'leaf blower'],
          quantities: [1, 1],
        },
        confidence: 0.88,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.classifyIntent({
        transcript: 'Add a chainsaw and leaf blower to inventory',
        context: {
          userRole: 'supervisor',
        },
      });

      expect(result.intent).toBe('inventory_add');
      expect(result.entities.itemNames).toEqual(['chainsaw', 'leaf blower']);
    });

    it('should track conversation context across turns', async () => {
      // Turn 1: Initial command with missing entities
      const mockResponse1 = {
        intent: 'check_out',
        entities: {
          itemNames: ['shovel'],
        },
        confidence: 0.75,
        needs_clarification: true,
        follow_up: 'Which job should I assign the shovel to?',
        missing_entities: ['jobId'],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse1),
        },
      });

      const result1 = await service.classifyIntent({
        transcript: 'Check out a shovel',
        context: {
          userRole: 'supervisor',
        },
      });

      expect(result1.conversation_id).toBeDefined();
      expect(result1.turn_number).toBe(1);

      // Turn 2: Provide missing job ID
      const mockResponse2 = {
        entities: {
          itemNames: ['shovel'],
          jobId: '456',
        },
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse2),
        },
      });

      const result2 = await service.clarifyIntent(
        result1.conversation_id!,
        'Job 456'
      );

      expect(result2.conversation_id).toBe(result1.conversation_id);
      expect(result2.turn_number).toBe(2);
      expect(result2.entities.itemNames).toEqual(['shovel']);
      expect(result2.entities.jobId).toBe('456');
      expect(result2.needs_clarification).toBe(false);
    });

    it('should handle malformed Gemini responses gracefully', async () => {
      // Mock invalid JSON response
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'This is not valid JSON',
        },
      });

      const result = await service.classifyIntent({
        transcript: 'Check in items',
        context: {
          userRole: 'supervisor',
        },
      });

      // Should fallback to unknown intent
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0.0);
      expect(result.needs_clarification).toBe(true);
      expect(result.follow_up).toContain('rephrase');
    });

    it('should clean markdown code blocks from responses', async () => {
      const mockResponse = {
        intent: 'check_in',
        entities: { itemNames: ['hammer'] },
        confidence: 0.9,
        needs_clarification: false,
      };

      // Mock response with markdown code blocks
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `\`\`\`json\n${JSON.stringify(mockResponse)}\n\`\`\``,
        },
      });

      const result = await service.classifyIntent({
        transcript: 'Check in hammer',
        context: {
          userRole: 'supervisor',
        },
      });

      expect(result.intent).toBe('check_in');
      expect(result.confidence).toBe(0.9);
    });

    it('should log AI interactions', async () => {
      const mockResponse = {
        intent: 'check_in',
        entities: {},
        confidence: 0.8,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      await service.classifyIntent({
        transcript: 'Check in items',
        context: {
          userRole: 'supervisor',
        },
      });

      expect(mockLogger.logInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          interactionType: 'llm',
          modelUsed: 'gemini-2.0-flash-exp',
          costUsd: expect.any(Number),
        })
      );
    });
  });

  describe('clarifyIntent', () => {
    it('should accumulate entities across clarification turns', async () => {
      // Initial classification
      const mockResponse1 = {
        intent: 'transfer',
        entities: {
          itemNames: ['ladder'],
        },
        confidence: 0.7,
        needs_clarification: true,
        follow_up: 'Where should I transfer the ladder from?',
        missing_entities: ['fromLocationName', 'toLocationName'],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse1),
        },
      });

      const result1 = await service.classifyIntent({
        transcript: 'Transfer the ladder',
        context: {
          userRole: 'crew',
        },
      });

      // First clarification
      const mockResponse2 = {
        entities: {
          itemNames: ['ladder'],
          fromLocationName: 'Truck 5',
        },
        needs_clarification: true,
        follow_up: 'And where to?',
        missing_entities: ['toLocationName'],
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse2),
        },
      });

      const result2 = await service.clarifyIntent(result1.conversation_id!, 'From Truck 5');

      expect(result2.entities.fromLocationName).toBe('Truck 5');
      expect(result2.needs_clarification).toBe(true);

      // Second clarification
      const mockResponse3 = {
        entities: {
          itemNames: ['ladder'],
          fromLocationName: 'Truck 5',
          toLocationName: 'Warehouse',
        },
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse3),
        },
      });

      const result3 = await service.clarifyIntent(result1.conversation_id!, 'To Warehouse');

      expect(result3.entities.toLocationName).toBe('Warehouse');
      expect(result3.entities.fromLocationName).toBe('Truck 5');
      expect(result3.needs_clarification).toBe(false);
    });

    it('should stop after max clarification attempts', async () => {
      // Initial classification
      const mockResponse = {
        intent: 'check_in',
        entities: {},
        confidence: 0.5,
        needs_clarification: true,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result1 = await service.classifyIntent({
        transcript: 'Check in stuff',
        context: {
          userRole: 'supervisor',
        },
      });

      // Attempt clarifications (max 3)
      for (let i = 0; i < 3; i++) {
        mockModel.generateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              entities: {},
              needs_clarification: true,
            }),
          },
        });

        await service.clarifyIntent(result1.conversation_id!, 'unclear response');
      }

      // 4th attempt should give up
      const finalResult = await service.clarifyIntent(
        result1.conversation_id!,
        'still unclear'
      );

      expect(finalResult.intent).toBe('unknown');
      expect(finalResult.follow_up).toContain('start over');
    });

    it('should throw error for non-existent conversation', async () => {
      await expect(
        service.clarifyIntent('non-existent-id', 'some response')
      ).rejects.toThrow('Conversation non-existent-id not found');
    });
  });

  describe('cost tracking', () => {
    it('should calculate cost based on token count', async () => {
      const mockResponse = {
        intent: 'check_in',
        entities: {},
        confidence: 0.8,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.classifyIntent({
        transcript: 'Check in items',
        context: {
          userRole: 'supervisor',
        },
      });

      expect(result.cost_usd).toBeGreaterThan(0);
      expect(result.cost_usd).toBeLessThan(0.001); // Should be very cheap with Gemini Flash
    });
  });

  describe('retry logic', () => {
    it('should retry on API failure', async () => {
      // First call fails, second succeeds
      mockModel.generateContent
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              intent: 'check_in',
              entities: {},
              confidence: 0.8,
              needs_clarification: false,
            }),
          },
        });

      const result = await service.classifyIntent({
        transcript: 'Check in items',
        context: {
          userRole: 'supervisor',
        },
      });

      expect(result.intent).toBe('check_in');
      expect(mockModel.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      await expect(
        service.classifyIntent({
          transcript: 'Check in items',
          context: {
            userRole: 'supervisor',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('conversation context management', () => {
    it('should retrieve conversation context', async () => {
      const mockResponse = {
        intent: 'check_in',
        entities: {},
        confidence: 0.8,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.classifyIntent({
        transcript: 'Check in items',
        context: {
          userRole: 'supervisor',
        },
      });

      const context = service.getConversationContext(result.conversation_id!);
      expect(context).toBeDefined();
      expect(context?.turn_number).toBe(2); // Context is updated for NEXT turn
      expect(context?.previous_transcripts).toEqual(['Check in items']);
    });

    it('should clear conversation context', async () => {
      const mockResponse = {
        intent: 'check_in',
        entities: {},
        confidence: 0.8,
        needs_clarification: false,
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.classifyIntent({
        transcript: 'Check in items',
        context: {
          userRole: 'supervisor',
        },
      });

      service.clearConversation(result.conversation_id!);

      const context = service.getConversationContext(result.conversation_id!);
      expect(context).toBeUndefined();
    });
  });
});

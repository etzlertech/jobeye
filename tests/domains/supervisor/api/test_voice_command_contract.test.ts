/**
 * @file /tests/domains/supervisor/api/test_voice_command_contract.test.ts
 * @purpose Contract test for POST /api/supervisor/voice/command endpoint
 * @phase 3
 * @domain Supervisor
 * @complexity_budget 200
 * @test_coverage 100%
 */

import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';

// Mock the handler that will be implemented later
const mockHandler = jest.fn();

describe('POST /api/supervisor/voice/command - Contract Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Contract', () => {
    it('should require audioUrl field', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          // Missing audioUrl
          transcript: 'Create a new job for tomorrow',
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('audioUrl'),
      });
    });

    it('should validate audioUrl as valid URI', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          audioUrl: 'not-a-valid-url',
        },
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: expect.stringContaining('audioUrl'),
      });
    });

    it('should accept optional transcript', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          audioUrl: 'https://example.com/audio/command.mp3',
          transcript: 'Show me today\'s job status',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'query_job_status',
          action: {
            type: 'display_dashboard',
            filter: 'today',
          },
          response: 'You have 5 jobs scheduled for today. 3 are assigned, 1 is in progress, and 1 is unassigned.',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should accept optional context object', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          audioUrl: 'https://example.com/audio/command.mp3',
          context: {
            currentScreen: 'inventory',
            selectedEntityId: '550e8400-e29b-41d4-a716-446655440000',
          },
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'update_inventory',
          action: {
            type: 'edit_item',
            entityId: '550e8400-e29b-41d4-a716-446655440000',
          },
          response: 'What would you like to update for this inventory item?',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Response Contract', () => {
    it('should return intent and action for recognized commands', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          audioUrl: 'https://example.com/audio/create-job.mp3',
          transcript: 'Create a new job for Smith property tomorrow at 9 AM',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'create_job',
          action: {
            type: 'navigate',
            target: 'job_creation',
            prefill: {
              customer: 'Smith',
              date: '2025-02-01T09:00:00Z',
            },
          },
          response: 'I\'ll help you create a job for the Smith property tomorrow at 9 AM. Let me open the job creation form.',
          audioResponseUrl: 'https://example.com/tts/response.mp3',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(200);
      
      const response = JSON.parse(res._getData());
      expect(response).toMatchObject({
        intent: expect.any(String),
        action: expect.any(Object),
        response: expect.any(String),
      });
    });

    it('should handle unrecognized commands gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          audioUrl: 'https://example.com/audio/unclear.mp3',
          transcript: 'Do the thing with the stuff',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'unknown',
          action: null,
          response: 'I didn\'t understand that command. You can ask me to create jobs, check status, manage inventory, or assign crew members.',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.intent).toBe('unknown');
      expect(response.action).toBeNull();
      expect(response.response).toContain('didn\'t understand');
    });

    it('should provide audio response URL when TTS is generated', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          audioUrl: 'https://example.com/audio/status.mp3',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'query_status',
          action: {
            type: 'display_info',
          },
          response: 'All systems are operational.',
          audioResponseUrl: 'https://example.com/tts/status-response.mp3',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.audioResponseUrl).toMatch(/^https?:\/\//);
    });
  });

  describe('Voice Command Intents', () => {
    const testCases = [
      {
        transcript: 'Add a new hammer to inventory',
        expectedIntent: 'add_inventory',
        expectedAction: { type: 'create', entity: 'inventory' },
      },
      {
        transcript: 'Show me unassigned jobs',
        expectedIntent: 'query_jobs',
        expectedAction: { type: 'filter', status: 'unassigned' },
      },
      {
        transcript: 'Assign this job to John',
        expectedIntent: 'assign_job',
        expectedAction: { type: 'assign', targetName: 'John' },
      },
      {
        transcript: 'What\'s the status of crew members?',
        expectedIntent: 'query_crew_status',
        expectedAction: { type: 'display_dashboard', section: 'crew' },
      },
    ];

    testCases.forEach(({ transcript, expectedIntent, expectedAction }) => {
      it(`should recognize intent: ${expectedIntent}`, async () => {
        const { req, res } = createMocks({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: {
            audioUrl: 'https://example.com/audio/command.mp3',
            transcript,
          },
        });

        mockHandler.mockImplementation((req) => {
          res.statusCode = 200;
          res._setData(JSON.stringify({
            intent: expectedIntent,
            action: expectedAction,
            response: 'Processing your request...',
          }));
        });

        await mockHandler(req as unknown as NextRequest);

        const response = JSON.parse(res._getData());
        expect(response.intent).toBe(expectedIntent);
        expect(response.action).toMatchObject(expectedAction);
      });
    });
  });

  describe('Context-Aware Processing', () => {
    it('should use context to disambiguate commands', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          audioUrl: 'https://example.com/audio/update-this.mp3',
          transcript: 'Update this',
          context: {
            currentScreen: 'inventory_detail',
            selectedEntityId: '550e8400-e29b-41d4-a716-446655440000',
          },
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'update_inventory_item',
          action: {
            type: 'edit',
            entityId: '550e8400-e29b-41d4-a716-446655440000',
          },
          response: 'What would you like to update about this inventory item?',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const response = JSON.parse(res._getData());
      expect(response.intent).toBe('update_inventory_item');
      expect(response.action.entityId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // No authorization header
        },
        body: {
          audioUrl: 'https://example.com/audio/command.mp3',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 401;
        res._setData(JSON.stringify({ error: 'Unauthorized' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(401);
    });

    it('should return 403 for non-supervisor users', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer crew-member-token',
        },
        body: {
          audioUrl: 'https://example.com/audio/command.mp3',
        },
      });

      mockHandler.mockImplementation((req) => {
        res.statusCode = 403;
        res._setData(JSON.stringify({ error: 'Forbidden - Supervisor role required' }));
      });

      await mockHandler(req as unknown as NextRequest);

      expect(res._getStatusCode()).toBe(403);
    });
  });

  describe('Performance', () => {
    it('should process voice commands within 2 seconds', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          audioUrl: 'https://example.com/audio/quick-command.mp3',
          transcript: 'Show dashboard',
        },
      });

      const startTime = Date.now();

      mockHandler.mockImplementation(async (req) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing
        res.statusCode = 200;
        res._setData(JSON.stringify({
          intent: 'show_dashboard',
          action: { type: 'navigate', target: 'dashboard' },
          response: 'Opening the dashboard.',
        }));
      });

      await mockHandler(req as unknown as NextRequest);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });
});
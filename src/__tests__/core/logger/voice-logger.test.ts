import { VoiceLogger, VoiceLogEntry, VoiceCommand } from '@/core/logger/voice-logger';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('VoiceLogger', () => {
  let voiceLogger: VoiceLogger;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    } as any;

    voiceLogger = new VoiceLogger({
      enableVoice: true,
      supabaseClient: mockSupabaseClient,
    });
  });

  describe('logVoiceCommand', () => {
    const mockVoiceCommand: VoiceCommand = {
      command: 'create_job',
      query: 'create a new job for customer smith',
      customerId: 'cust-123',
      metadata: {
        confidence: 0.95,
        provider: 'openai',
      },
    };

    it('should log voice command to database when enabled', async () => {
      await voiceLogger.logVoiceCommand(mockVoiceCommand);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('voice_logs');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          command: mockVoiceCommand.command,
          query: mockVoiceCommand.query,
          customer_id: mockVoiceCommand.customerId,
          metadata: mockVoiceCommand.metadata,
          timestamp: expect.any(String),
        })
      );
    });

    it('should not log when voice is disabled', async () => {
      const disabledLogger = new VoiceLogger({
        enableVoice: false,
        supabaseClient: mockSupabaseClient,
      });

      await disabledLogger.logVoiceCommand(mockVoiceCommand);

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should include tenant and user ID when provided', async () => {
      await voiceLogger.logVoiceCommand({
        ...mockVoiceCommand,
        tenantId: 'tenant-123',
        userId: 'user-123',
      });

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          user_id: 'user-123',
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      await expect(voiceLogger.logVoiceCommand(mockVoiceCommand)).resolves.not.toThrow();
    });
  });

  describe('logError', () => {
    const mockError = new Error('Test error');
    const mockContext = {
      operation: 'voice_search',
      customerId: 'cust-123',
    };

    it('should log error with context', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await voiceLogger.logError(mockError, mockContext);

      expect(consoleSpy).toHaveBeenCalledWith('[Voice Logger] Error:', mockError);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('error_logs');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: mockError.message,
          error_stack: mockError.stack,
          context: mockContext,
          source: 'voice',
          timestamp: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });

    it('should include voice session ID if available', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await voiceLogger.logError(mockError, {
        ...mockContext,
        voiceSessionId: 'session-123',
      });

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          voice_session_id: 'session-123',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should sanitize error stack traces', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorWithSensitiveData = new Error('Error with password=secret123');
      errorWithSensitiveData.stack = 'Stack trace with apiKey=abc123';

      await voiceLogger.logError(errorWithSensitiveData, mockContext);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: expect.not.stringContaining('secret123'),
          error_stack: expect.not.stringContaining('abc123'),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('logVoiceTranscription', () => {
    const mockTranscription = {
      audio: 'audio-url',
      transcript: 'create a new customer john smith',
      confidence: 0.92,
      duration: 3.5,
      provider: 'openai',
    };

    it('should log voice transcription', async () => {
      await voiceLogger.logVoiceTranscription(mockTranscription);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('voice_transcriptions');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          audio_url: mockTranscription.audio,
          transcript: mockTranscription.transcript,
          confidence: mockTranscription.confidence,
          duration: mockTranscription.duration,
          provider: mockTranscription.provider,
          timestamp: expect.any(String),
        })
      );
    });

    it('should include cost tracking if provided', async () => {
      await voiceLogger.logVoiceTranscription({
        ...mockTranscription,
        cost: 0.05,
        tokens: 150,
      });

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          cost: 0.05,
          metadata: expect.objectContaining({
            tokens: 150,
          }),
        })
      );
    });
  });

  describe('getVoiceHistory', () => {
    const mockHistoryEntries: VoiceLogEntry[] = [
      {
        id: 'log-1',
        timestamp: new Date(),
        command: 'create_customer',
        query: 'create customer john',
        success: true,
        duration: 2.1,
      },
      {
        id: 'log-2',
        timestamp: new Date(),
        command: 'find_property',
        query: 'find property on main street',
        success: false,
        error: 'No properties found',
      },
    ];

    it('should retrieve voice history for a user', async () => {
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: mockHistoryEntries,
        error: null,
      });

      const history = await voiceLogger.getVoiceHistory('user-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('voice_logs');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('timestamp', { ascending: false });
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(100);
      expect(history).toEqual(mockHistoryEntries);
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await voiceLogger.getVoiceHistory('user-123', { startDate, endDate });

      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('timestamp', startDate.toISOString());
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('timestamp', endDate.toISOString());
    });

    it('should respect custom limit', async () => {
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await voiceLogger.getVoiceHistory('user-123', { limit: 50 });

      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(50);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      const history = await voiceLogger.getVoiceHistory('user-123');

      expect(history).toEqual([]);
    });
  });

  describe('getVoiceStats', () => {
    it('should calculate voice statistics', async () => {
      const mockLogs = [
        { success: true, duration: 2.0, confidence: 0.95 },
        { success: true, duration: 3.0, confidence: 0.90 },
        { success: false, duration: 1.5, confidence: 0.80 },
        { success: true, duration: 2.5, confidence: 0.92 },
      ];

      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: mockLogs,
        error: null,
      });

      const stats = await voiceLogger.getVoiceStats('user-123');

      expect(stats).toEqual({
        totalCommands: 4,
        successfulCommands: 3,
        failedCommands: 1,
        successRate: 0.75,
        averageDuration: 2.25,
        averageConfidence: 0.8925,
      });
    });

    it('should handle empty data', async () => {
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const stats = await voiceLogger.getVoiceStats('user-123');

      expect(stats).toEqual({
        totalCommands: 0,
        successfulCommands: 0,
        failedCommands: 0,
        successRate: 0,
        averageDuration: 0,
        averageConfidence: 0,
      });
    });
  });

  describe('logVoiceFeedback', () => {
    it('should log user feedback for voice commands', async () => {
      await voiceLogger.logVoiceFeedback({
        commandId: 'cmd-123',
        userId: 'user-123',
        rating: 5,
        feedback: 'Worked perfectly!',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('voice_feedback');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          command_id: 'cmd-123',
          user_id: 'user-123',
          rating: 5,
          feedback: 'Worked perfectly!',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('configuration', () => {
    it('should respect voice enable/disable configuration', async () => {
      const disabledLogger = new VoiceLogger({
        enableVoice: false,
        supabaseClient: mockSupabaseClient,
      });

      await disabledLogger.logVoiceCommand({
        command: 'test',
        query: 'test query',
      });

      await disabledLogger.logVoiceTranscription({
        audio: 'test-audio',
        transcript: 'test transcript',
        confidence: 0.9,
      });

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should work without supabase client in local mode', async () => {
      const localLogger = new VoiceLogger({
        enableVoice: true,
        // No supabaseClient provided
      });

      await expect(
        localLogger.logVoiceCommand({
          command: 'test',
          query: 'test query',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('privacy and security', () => {
    it('should redact sensitive information from logs', async () => {
      const sensitiveCommand = {
        command: 'update_customer',
        query: 'update customer ssn to 123-45-6789',
        metadata: {
          creditCard: '4111-1111-1111-1111',
        },
      };

      await voiceLogger.logVoiceCommand(sensitiveCommand);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.not.stringContaining('123-45-6789'),
          metadata: expect.not.objectContaining({
            creditCard: '4111-1111-1111-1111',
          }),
        })
      );
    });
  });

  describe('performance tracking', () => {
    it('should track command execution duration', async () => {
      const startTime = Date.now();
      
      await voiceLogger.startCommand('cmd-123');
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await voiceLogger.endCommand('cmd-123', { success: true });

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          command_id: 'cmd-123',
          duration: expect.any(Number),
          success: true,
        })
      );
    });
  });
});
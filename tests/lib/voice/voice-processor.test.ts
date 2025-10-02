/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /tests/lib/voice/voice-processor.test.ts
 * phase: 3
 * domain: testing
 * purpose: Comprehensive test suite for voice command processor
 * spec_ref: 007-mvp-intent-driven/contracts/voice-processor-tests.md
 * complexity_budget: 350
 * migrations_touched: []
 * state_machine: {
 *   states: ['setup', 'testing', 'cleanup', 'complete'],
 *   transitions: [
 *     'setup->testing: testsStarted()',
 *     'testing->cleanup: testsFinished()',
 *     'cleanup->complete: cleanupDone()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "testSuite": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/lib/voice/voice-processor'],
 *   external: ['jest', '@testing-library/jest-dom'],
 *   supabase: []
 * }
 * exports: []
 * voice_considerations: Test core voice processing functionality for MVP
 * test_requirements: {
 *   coverage: 95,
 *   scenarios: ['speech recognition', 'intent recognition', 'TTS', 'audio recording']
 * }
 * tasks: [
 *   'Test Web Speech API integration',
 *   'Test intent recognition from voice commands',
 *   'Test text-to-speech response system',
 *   'Test offline voice command queueing'
 * ]
 */

import { VoiceProcessor, VoiceCommand, VoiceResponse } from '@/lib/voice/voice-processor';
import { syncManager } from '@/lib/offline/sync-manager';

// Mock dependencies
jest.mock('@/lib/offline/sync-manager');
jest.mock('@/core/logger/voice-logger', () => ({
  voiceLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock Web Speech API
const mockSpeechRecognition = {
  start: jest.fn(),
  stop: jest.fn(),
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  maxAlternatives: 1,
  onstart: null as any,
  onend: null as any,
  onerror: null as any,
  onresult: null as any
};

const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  getVoices: jest.fn().mockReturnValue([
    { name: 'Test Voice', lang: 'en-US' }
  ])
};

const mockSpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
  text,
  voice: null,
  rate: 1,
  pitch: 1,
  volume: 1,
  onstart: null,
  onend: null,
  onerror: null
}));

// Setup global mocks
(global as any).SpeechRecognition = jest.fn(() => mockSpeechRecognition);
(global as any).webkitSpeechRecognition = jest.fn(() => mockSpeechRecognition);
(global as any).speechSynthesis = mockSpeechSynthesis;
(global as any).SpeechSynthesisUtterance = mockSpeechSynthesisUtterance;

// Mock MediaRecorder
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  state: 'inactive',
  stream: {
    getTracks: jest.fn().mockReturnValue([
      { stop: jest.fn() }
    ])
  },
  ondataavailable: null as any
};

(global as any).MediaRecorder = jest.fn(() => mockMediaRecorder);

// Mock getUserMedia
const mockGetUserMedia = jest.fn().mockResolvedValue({
  getTracks: jest.fn().mockReturnValue([])
});

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  }
});

// Mock custom events
const mockDispatchEvent = jest.fn();
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent
});

describe('VoiceProcessor', () => {
  let voiceProcessor: VoiceProcessor;
  let mockSyncManager: jest.Mocked<typeof syncManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncManager = syncManager as jest.Mocked<typeof syncManager>;
    
    // Reset singleton
    (VoiceProcessor as any).instance = null;
    voiceProcessor = VoiceProcessor.getInstance();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const status = voiceProcessor.getStatus();
      
      expect(status.isSupported).toBe(true);
      expect(status.isListening).toBe(false);
      expect(status.isProcessing).toBe(false);
      expect(status.isSpeaking).toBe(false);
    });

    it('should initialize speech recognition with correct settings', () => {
      expect(mockSpeechRecognition.continuous).toBe(false);
      expect(mockSpeechRecognition.interimResults).toBe(true);
      expect(mockSpeechRecognition.lang).toBe('en-US');
      expect(mockSpeechRecognition.maxAlternatives).toBe(1);
    });

    it('should handle missing speech recognition gracefully', () => {
      // Mock missing speech recognition
      delete (global as any).SpeechRecognition;
      delete (global as any).webkitSpeechRecognition;
      
      const processor = VoiceProcessor.getInstance({});
      const status = processor.getStatus();
      
      expect(status.isSupported).toBe(false);
      
      // Restore mocks
      (global as any).SpeechRecognition = jest.fn(() => mockSpeechRecognition);
      (global as any).webkitSpeechRecognition = jest.fn(() => mockSpeechRecognition);
    });

    it('should handle missing speech synthesis gracefully', () => {
      // Mock missing speech synthesis
      delete (global as any).speechSynthesis;
      
      const processor = VoiceProcessor.getInstance({});
      const status = processor.getStatus();
      
      expect(status.isSupported).toBe(false);
      
      // Restore mock
      (global as any).speechSynthesis = mockSpeechSynthesis;
    });
  });

  describe('Speech Recognition', () => {
    beforeEach(() => {
      mockMediaRecorder.state = 'inactive';
    });

    it('should start listening successfully', async () => {
      await voiceProcessor.startListening();
      
      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    });

    it('should start audio recording when requested', async () => {
      await voiceProcessor.startListening({ recordAudio: true });
      
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(mockMediaRecorder.start).toHaveBeenCalledWith(100);
    });

    it('should stop previous session before starting new one', async () => {
      // Simulate already listening
      (voiceProcessor as any).isListening = true;
      
      const stopSpy = jest.spyOn(voiceProcessor, 'stopListening');
      
      await voiceProcessor.startListening();
      
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should handle speech recognition start event', () => {
      mockSpeechRecognition.onstart();
      
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice:voicestart'
        })
      );
    });

    it('should handle speech recognition end event', () => {
      mockSpeechRecognition.onend();
      
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice:voiceend'
        })
      );
    });

    it('should handle speech recognition error', () => {
      const errorEvent = { error: 'network' };
      mockSpeechRecognition.onerror(errorEvent);
      
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice:voiceerror',
          detail: { error: 'network' }
        })
      );
    });

    it('should process final speech results', async () => {
      const mockResult = {
        results: [
          {
            0: { transcript: 'test command', confidence: 0.9 },
            isFinal: true
          }
        ]
      };

      const processSpy = jest.spyOn(voiceProcessor, 'processVoiceCommand');
      
      await mockSpeechRecognition.onresult(mockResult);
      
      expect(processSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          transcript: 'test command',
          confidence: 0.9
        })
      );
    });

    it('should ignore interim results', async () => {
      const mockResult = {
        results: [
          {
            0: { transcript: 'test', confidence: 0.7 },
            isFinal: false
          }
        ]
      };

      const processSpy = jest.spyOn(voiceProcessor, 'processVoiceCommand');
      
      await mockSpeechRecognition.onresult(mockResult);
      
      expect(processSpy).not.toHaveBeenCalled();
    });

    it('should stop listening correctly', () => {
      mockMediaRecorder.state = 'recording';
      
      voiceProcessor.stopListening();
      
      expect(mockSpeechRecognition.stop).toHaveBeenCalled();
      expect(mockMediaRecorder.stop).toHaveBeenCalled();
    });
  });

  describe('Intent Recognition', () => {
    it('should recognize navigation intents', async () => {
      const command: VoiceCommand = {
        id: 'test-1',
        transcript: 'show me my jobs',
        confidence: 0.9,
        timestamp: Date.now()
      };

      const response = await voiceProcessor.processVoiceCommand(command);
      
      expect(response.text).toContain('Navigating to jobs');
      expect(response.actions).toContainEqual({
        type: 'navigate',
        target: '/crew'
      });
    });

    it('should recognize camera intents', async () => {
      const command: VoiceCommand = {
        id: 'test-2',
        transcript: 'open camera for photos',
        confidence: 0.9,
        timestamp: Date.now()
      };

      const response = await voiceProcessor.processVoiceCommand(command);
      
      expect(response.text).toContain('Opening camera');
      expect(response.actions).toContainEqual({
        type: 'open_camera'
      });
    });

    it('should recognize job management intents', async () => {
      const command: VoiceCommand = {
        id: 'test-3',
        transcript: 'start my job',
        confidence: 0.9,
        timestamp: Date.now()
      };

      const response = await voiceProcessor.processVoiceCommand(command);
      
      expect(response.text).toContain('Starting your job');
      expect(response.actions).toContainEqual({
        type: 'show_job_selection'
      });
    });

    it('should recognize admin intents for admin users', async () => {
      const command: VoiceCommand = {
        id: 'test-4',
        transcript: 'manage users',
        confidence: 0.9,
        timestamp: Date.now(),
        context: {
          page: 'admin',
          userId: 'admin-1',
          role: 'admin'
        }
      };

      const response = await voiceProcessor.processVoiceCommand(command);
      
      expect(response.text).toContain('Opening user management');
      expect(response.actions).toContainEqual({
        type: 'navigate',
        target: '/admin'
      });
    });

    it('should handle unknown intents gracefully', async () => {
      const command: VoiceCommand = {
        id: 'test-5',
        transcript: 'xyz unknown command',
        confidence: 0.9,
        timestamp: Date.now()
      };

      const response = await voiceProcessor.processVoiceCommand(command);
      
      expect(response.text).toContain('I can help you navigate');
      expect(response.shouldSpeak).toBe(true);
    });
  });

  describe('Voice Command Processing', () => {
    beforeEach(() => {
      mockSyncManager.queueVoiceRecording.mockResolvedValue();
    });

    it('should store voice recording when audio is available', async () => {
      const audioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      const command: VoiceCommand = {
        id: 'test-audio',
        transcript: 'test command',
        confidence: 0.9,
        timestamp: Date.now(),
        audioBlob,
        context: {
          page: 'crew',
          userId: 'user-1',
          role: 'crew',
          jobId: 'job-123'
        }
      };

      await voiceProcessor.processVoiceCommand(command);
      
      expect(mockSyncManager.queueVoiceRecording).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-audio',
          blob: audioBlob,
          transcript: 'test command',
          jobId: 'job-123',
          syncStatus: 'pending'
        })
      );
    });

    it('should include context in intent recognition', async () => {
      const command: VoiceCommand = {
        id: 'test-context',
        transcript: 'start job',
        confidence: 0.9,
        timestamp: Date.now(),
        context: {
          page: 'crew-dashboard',
          userId: 'crew-1',
          role: 'crew',
          jobId: 'current-job'
        }
      };

      const response = await voiceProcessor.processVoiceCommand(command);
      
      expect(response.shouldSpeak).toBe(true);
      expect(command.intent).toBeDefined();
      expect(command.intent?.action).toBe('start_job');
    });

    it('should auto-speak responses when enabled', async () => {
      const speakSpy = jest.spyOn(voiceProcessor, 'speak');
      speakSpy.mockResolvedValue();

      const command: VoiceCommand = {
        id: 'test-speak',
        transcript: 'show jobs',
        confidence: 0.9,
        timestamp: Date.now()
      };

      await voiceProcessor.processVoiceCommand(command);
      
      expect(speakSpy).toHaveBeenCalledWith('Navigating to jobs');
    });

    it('should handle processing errors gracefully', async () => {
      mockSyncManager.queueVoiceRecording.mockRejectedValue(new Error('Storage error'));
      
      const command: VoiceCommand = {
        id: 'test-error',
        transcript: 'test command',
        confidence: 0.9,
        timestamp: Date.now(),
        audioBlob: new Blob(['audio'], { type: 'audio/wav' })
      };

      const response = await voiceProcessor.processVoiceCommand(command);
      
      expect(response.text).toContain('Sorry, I had trouble processing');
      expect(response.shouldSpeak).toBe(true);
    });

    it('should dispatch command processed event', async () => {
      const command: VoiceCommand = {
        id: 'test-event',
        transcript: 'test command',
        confidence: 0.9,
        timestamp: Date.now()
      };

      await voiceProcessor.processVoiceCommand(command);
      
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice:commandprocessed',
          detail: expect.objectContaining({
            command,
            response: expect.any(Object)
          })
        })
      );
    });
  });

  describe('Text-to-Speech', () => {
    let mockUtterance: any;

    beforeEach(() => {
      mockUtterance = {
        text: '',
        voice: null,
        rate: 1,
        pitch: 1,
        volume: 1,
        onstart: null,
        onend: null,
        onerror: null
      };
      mockSpeechSynthesisUtterance.mockReturnValue(mockUtterance);
    });

    it('should speak text successfully', async () => {
      const speakPromise = voiceProcessor.speak('Hello world');
      
      // Simulate speech start and end
      setTimeout(() => {
        mockUtterance.onstart();
        setTimeout(() => {
          mockUtterance.onend();
        }, 10);
      }, 0);

      await speakPromise;
      
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledWith(mockUtterance);
      expect(mockUtterance.text).toBe('Hello world');
    });

    it('should apply custom voice options', async () => {
      const customVoice = { name: 'Custom Voice' };
      const options = {
        voice: customVoice as SpeechSynthesisVoice,
        rate: 1.2,
        pitch: 0.8,
        volume: 0.9
      };

      const speakPromise = voiceProcessor.speak('Test', options);
      
      setTimeout(() => {
        mockUtterance.onstart();
        setTimeout(() => {
          mockUtterance.onend();
        }, 10);
      }, 0);

      await speakPromise;
      
      expect(mockUtterance.voice).toBe(customVoice);
      expect(mockUtterance.rate).toBe(1.2);
      expect(mockUtterance.pitch).toBe(0.8);
      expect(mockUtterance.volume).toBe(0.9);
    });

    it('should cancel previous speech before starting new one', async () => {
      (voiceProcessor as any).isSpeaking = true;
      
      voiceProcessor.speak('New text');
      
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should handle speech synthesis errors', async () => {
      const speakPromise = voiceProcessor.speak('Error test');
      
      setTimeout(() => {
        mockUtterance.onstart();
        setTimeout(() => {
          mockUtterance.onerror({ error: 'synthesis-failed' });
        }, 10);
      }, 0);

      await expect(speakPromise).rejects.toThrow('Speech synthesis failed');
    });

    it('should dispatch speech events', async () => {
      const speakPromise = voiceProcessor.speak('Event test');
      
      setTimeout(() => {
        mockUtterance.onstart();
        setTimeout(() => {
          mockUtterance.onend();
        }, 10);
      }, 0);

      await speakPromise;
      
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice:speechstart',
          detail: { text: 'Event test' }
        })
      );
      
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice:speechend'
        })
      );
    });

    it('should stop speaking correctly', () => {
      voiceProcessor.stopSpeaking();
      
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('Event Listeners', () => {
    it('should register voice start event listener', () => {
      const callback = jest.fn();
      const unsubscribe = voiceProcessor.onVoiceStart(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should register voice result event listener', () => {
      const callback = jest.fn();
      const unsubscribe = voiceProcessor.onVoiceResult(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should register command processed event listener', () => {
      const callback = jest.fn();
      const unsubscribe = voiceProcessor.onCommandProcessed(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should register speech events listeners', () => {
      const startCallback = jest.fn();
      const endCallback = jest.fn();
      
      const unsubscribeStart = voiceProcessor.onSpeechStart(startCallback);
      const unsubscribeEnd = voiceProcessor.onSpeechEnd(endCallback);
      
      expect(typeof unsubscribeStart).toBe('function');
      expect(typeof unsubscribeEnd).toBe('function');
    });
  });

  describe('Voice Management', () => {
    it('should get available voices', () => {
      const voices = voiceProcessor.getAvailableVoices();
      
      expect(mockSpeechSynthesis.getVoices).toHaveBeenCalled();
      expect(Array.isArray(voices)).toBe(true);
    });

    it('should return empty array when synthesis not available', () => {
      // Mock missing synthesis
      (voiceProcessor as any).synthesis = null;
      
      const voices = voiceProcessor.getAvailableVoices();
      
      expect(voices).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const stopListeningSpy = jest.spyOn(voiceProcessor, 'stopListening');
      const stopSpeakingSpy = jest.spyOn(voiceProcessor, 'stopSpeaking');
      
      voiceProcessor.destroy();
      
      expect(stopListeningSpy).toHaveBeenCalled();
      expect(stopSpeakingSpy).toHaveBeenCalled();
    });

    it('should stop media tracks on destroy', () => {
      const mockTrack = { stop: jest.fn() };
      mockMediaRecorder.stream.getTracks.mockReturnValue([mockTrack]);
      (voiceProcessor as any).currentMediaRecorder = mockMediaRecorder;
      
      voiceProcessor.destroy();
      
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });

  describe('Status and State', () => {
    it('should report correct status during different states', () => {
      // Initial state
      let status = voiceProcessor.getStatus();
      expect(status.isListening).toBe(false);
      expect(status.isProcessing).toBe(false);
      expect(status.isSpeaking).toBe(false);

      // Simulate listening state
      (voiceProcessor as any).isListening = true;
      status = voiceProcessor.getStatus();
      expect(status.isListening).toBe(true);

      // Simulate processing state
      (voiceProcessor as any).isProcessing = true;
      status = voiceProcessor.getStatus();
      expect(status.isProcessing).toBe(true);

      // Simulate speaking state
      (voiceProcessor as any).isSpeaking = true;
      status = voiceProcessor.getStatus();
      expect(status.isSpeaking).toBe(true);
    });
  });
});
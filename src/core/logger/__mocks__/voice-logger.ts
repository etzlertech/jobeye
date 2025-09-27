/**
 * Mock for VoiceLogger class
 */

export class VoiceLogger {
  constructor() {}

  // All methods as mocks - log takes 2 params in VoiceLogger usage
  log = jest.fn((message: string, context?: any) => Promise.resolve());
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
  critical = jest.fn();
  logVoiceCommand = jest.fn();
  logError = jest.fn();
  logVoiceTranscription = jest.fn();
  logSpeechRecognition = jest.fn();
  logTextToSpeech = jest.fn();
  getVoiceHistory = jest.fn(() => Promise.resolve([]));
  getVoiceStats = jest.fn(() => Promise.resolve({
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    successRate: 0,
    averageDuration: 0,
    averageConfidence: 0,
  }));
  logVoiceFeedback = jest.fn();
  startCommand = jest.fn();
  endCommand = jest.fn();
  speakError = jest.fn();
  speak = jest.fn();
}

// Export singleton instance as a mock
const mockVoiceLogger = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  critical: jest.fn(),
  logVoiceCommand: jest.fn(),
  logError: jest.fn(),
  logVoiceTranscription: jest.fn(),
  logSpeechRecognition: jest.fn(),
  logTextToSpeech: jest.fn(),
  getVoiceHistory: jest.fn(() => Promise.resolve([])),
  getVoiceStats: jest.fn(() => Promise.resolve({
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    successRate: 0,
    averageDuration: 0,
    averageConfidence: 0,
  })),
  logVoiceFeedback: jest.fn(),
  startCommand: jest.fn(),
  endCommand: jest.fn(),
  speakError: jest.fn(),
  speak: jest.fn(),
};

export const voiceLogger = mockVoiceLogger;
export const logVoiceCommand = jest.fn();
export const logSpeechRecognition = jest.fn();
export const logTextToSpeech = jest.fn();
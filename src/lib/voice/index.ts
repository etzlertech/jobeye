/**
 * Voice Module Exports
 *
 * Central export point for voice processing functionality
 */

// Core voice processor
export { voiceProcessor, VoiceProcessor } from './voice-processor';
export type { VoiceCommand, VoiceResponse, VoiceProcessorOptions } from './voice-processor';

// Task-specific voice commands
export {
  taskVoiceCommands,
  processTaskCommand,
  setTaskContext,
  clearTaskContext,
  getTaskContext,
  getTaskCommandHelp,
} from './taskCommands';
export type { TaskCommandHandler } from './taskCommands';

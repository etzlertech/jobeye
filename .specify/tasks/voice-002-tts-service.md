# Task: Text-to-Speech Service

**Slug:** `voice-002-tts-service`
**Priority:** High
**Size:** 1 PR

## Description
Implement TTS service for voice confirmations and feedback using Web Speech API with queueing support.

## Files to Create
- `src/domains/voice/services/tts-service.ts`
- `src/domains/voice/utils/speech-queue.ts`
- `src/domains/voice/config/voice-settings.ts`

## Files to Modify
- `src/components/shared/offline-indicator.tsx` - Use TTS for announcements

## Acceptance Criteria
- [ ] Synthesizes text using Web Speech API
- [ ] Queues multiple utterances (no overlapping)
- [ ] Supports voice/rate/pitch configuration
- [ ] Interrupts on new high-priority speech
- [ ] Tracks synthesis costs ($0.016/1K chars)
- [ ] Works with screen readers (ARIA coordination)

## Test Files
**Create:** `src/__tests__/domains/voice/services/tts-service.test.ts`

Test cases:
- `speaks single utterance`
  - Call speak("Hello")
  - Assert speechSynthesis.speak called
  - Assert utterance completed
  
- `queues multiple utterances`
  - Speak three messages rapidly
  - Assert spoken in order
  - Assert no overlap
  
- `interrupts for priority speech`
  - Start long utterance
  - Speak priority message
  - Assert first cancelled
  - Assert priority spoken immediately
  
- `tracks synthesis costs`
  - Speak 1000 characters
  - Assert cost = $0.016
  - Assert cost logged

**Create:** `src/__tests__/domains/voice/utils/speech-queue.test.ts`

Test cases:
- `maintains FIFO order`
- `handles priority insertion`
- `clears queue on demand`

## Dependencies
- Browser API: Web Speech Synthesis API
- Existing: Voice logger for announcements

## Service Interface
```typescript
interface TTSService {
  speak(text: string, options?: TTSOptions): Promise<void>;
  pause(): void;
  resume(): void;
  cancel(): void;
  setVoice(voiceURI: string): void;
}

interface TTSOptions {
  priority?: 'normal' | 'high';
  rate?: number; // 0.1 - 10
  pitch?: number; // 0 - 2
  volume?: number; // 0 - 1
  voice?: string; // voice URI
}
```

## Configuration
```typescript
// Default voice settings
export const DEFAULT_VOICE_SETTINGS = {
  rate: 1.0,
  pitch: 1.0,
  volume: 0.9,
  preferredVoice: 'Google US English' // or first available
};
```
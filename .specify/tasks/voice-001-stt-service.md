# Task: Speech-to-Text Service

**Slug:** `voice-001-stt-service`
**Priority:** High
**Size:** 1 PR

## Description
Implement Web Speech API with cloud fallback for speech-to-text transcription, including wake word detection.

## Files to Create
- `src/domains/voice/services/stt-service.ts`
- `src/domains/voice/utils/wake-word-detector.ts`
- `src/domains/voice/types/stt-types.ts`

## Files to Modify
- `src/components/providers/pwa-provider.tsx` - Add STT initialization

## Acceptance Criteria
- [ ] Detects "Hey JobEye" wake word to start listening
- [ ] Transcribes speech using Web Speech API
- [ ] Falls back to cloud STT if unavailable
- [ ] Stops on 2s silence detection
- [ ] Returns transcript with confidence score
- [ ] Tracks cost per transcription ($0.006/min)

## Test Files
**Create:** `src/__tests__/domains/voice/services/stt-service.test.ts`

Test cases:
- `starts listening on wake word`
  - Simulate "Hey JobEye" audio
  - Assert listening state activated
  - Assert onListeningStart callback fired
  
- `transcribes speech accurately`
  - Mock speech recognition result
  - Assert transcript matches input
  - Assert confidence score included
  
- `stops on silence detection`
  - Simulate 2s without speech
  - Assert listening stopped
  - Assert final transcript returned
  
- `tracks transcription costs`
  - Transcribe 30s of speech
  - Assert cost calculated as $0.003
  - Assert cost logged to service

**Create:** `src/__tests__/domains/voice/utils/wake-word-detector.test.ts`

Test cases:
- `detects wake word variations`
  - Test "Hey JobEye", "Hi JobEye", "OK JobEye"
  - Assert all variations detected
  - Assert false positives rejected

## Dependencies
- Browser API: Web Speech API
- Cloud fallback: OpenAI Whisper or Google Speech

## Service Interface
```typescript
interface STTService {
  startListening(options?: STTOptions): Promise<void>;
  stopListening(): void;
  onTranscript: (callback: TranscriptCallback) => void;
  onError: (callback: ErrorCallback) => void;
}

interface STTOptions {
  continuous?: boolean;
  interimResults?: boolean;
  maxDuration?: number; // ms
  costBudget?: number; // dollars
}

interface TranscriptResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  cost: number;
}
```
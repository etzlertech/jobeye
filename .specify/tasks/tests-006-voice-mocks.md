# Task: Voice Interaction Test Mocks

**Slug:** `tests-006-voice-mocks`
**Priority:** Low
**Size:** 1 PR

## Description
Create comprehensive mock infrastructure for testing voice interactions without real STT/TTS services.

## Files to Create
- `src/__tests__/mocks/voice-mocks.ts`
- `src/__tests__/mocks/speech-recognition-mock.ts`
- `src/__tests__/mocks/speech-synthesis-mock.ts`
- `src/__tests__/fixtures/voice-samples.ts`

## Files to Modify
- Test setup files to register mocks

## Acceptance Criteria
- [ ] Mocks Web Speech API completely
- [ ] Simulates recognition events
- [ ] Simulates synthesis events
- [ ] Provides test voice samples
- [ ] Supports error simulation
- [ ] Enables timing control

## Test Files
**Create:** `src/__tests__/mocks/speech-recognition-mock.ts`

Mock implementation:
- `MockSpeechRecognition` class
  - Simulates recognition lifecycle
  - Fires result events
  - Handles interim results
  - Simulates errors
  - Controls timing

**Create:** `src/__tests__/mocks/speech-synthesis-mock.ts`

Mock implementation:
- `MockSpeechSynthesis` class
  - Simulates speech queue
  - Fires progress events
  - Handles pause/resume
  - Tracks spoken text
  - Simulates voices

## Dependencies
- None (mock infrastructure)

## Mock Interfaces
```typescript
// Speech Recognition Mock
export class MockSpeechRecognition implements SpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = false;
  lang: string = 'en-US';
  
  private handlers: Map<string, Function[]> = new Map();
  private recognizing: boolean = false;
  
  start(): void {
    this.recognizing = true;
    this.emit('start', new Event('start'));
    
    // Simulate recognition after delay
    setTimeout(() => {
      if (this.recognizing) {
        this.simulateResult();
      }
    }, 1000);
  }
  
  stop(): void {
    this.recognizing = false;
    this.emit('end', new Event('end'));
  }
  
  simulateResult(transcript: string = 'test command'): void {
    const event = new CustomEvent('result') as any;
    event.results = [{
      [0]: {
        transcript,
        confidence: 0.95
      },
      isFinal: true
    }];
    
    this.emit('result', event);
  }
  
  simulateError(error: string): void {
    const event = new CustomEvent('error') as any;
    event.error = error;
    this.emit('error', event);
  }
  
  addEventListener(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }
  
  private emit(event: string, data: any): void {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(h => h(data));
  }
}
```

## Voice Sample Fixtures
```typescript
// src/__tests__/fixtures/voice-samples.ts
export const VoiceSamples = {
  commands: {
    createJob: {
      perfect: "Create a job for John Smith at 123 Main Street",
      unclear: "Create uh job for Jon Smyth at 123 Main",
      noisy: "Create [noise] job for [unclear] Smith"
    },
    
    confirmation: {
      yes: ["yes", "yeah", "correct", "that's right", "confirm"],
      no: ["no", "nope", "incorrect", "wrong", "cancel"],
      unclear: ["uh", "maybe", "I think so", "hmm"]
    },
    
    entityMentions: {
      customer: ["Smith property", "the Johnsons", "ABC Company"],
      service: ["lawn service", "mowing", "irrigation repair"],
      time: ["tomorrow morning", "next Tuesday", "ASAP"]
    }
  },
  
  synthesis: {
    prompts: {
      jobConfirmation: "I'll create a lawn service job for Smith property tomorrow. Is that correct?",
      disambiguation: "I found 3 customers named Smith. Do you mean John Smith on Main Street?",
      error: "I'm sorry, I didn't understand that. Could you please repeat?"
    }
  }
};
```

## Test Helpers
```typescript
export const VoiceTestHelpers = {
  // Setup mock environment
  setupVoiceMocks(): void {
    global.SpeechRecognition = MockSpeechRecognition as any;
    global.speechSynthesis = new MockSpeechSynthesis() as any;
  },
  
  // Simulate voice command flow
  async simulateVoiceCommand(command: string): Promise<string> {
    const recognition = new MockSpeechRecognition();
    const result = new Promise<string>((resolve) => {
      recognition.addEventListener('result', (e: any) => {
        resolve(e.results[0][0].transcript);
      });
    });
    
    recognition.start();
    recognition.simulateResult(command);
    
    return result;
  },
  
  // Verify synthesis
  expectSpoken(text: string): void {
    const synthesis = global.speechSynthesis as MockSpeechSynthesis;
    expect(synthesis.spokenTexts).toContain(text);
  },
  
  // Control timing
  async advanceTimers(ms: number): Promise<void> {
    jest.advanceTimersByTime(ms);
    await Promise.resolve(); // Flush promises
  }
};
```

## Usage in Tests
```typescript
describe('Voice Service', () => {
  beforeEach(() => {
    VoiceTestHelpers.setupVoiceMocks();
    jest.useFakeTimers();
  });
  
  it('processes voice commands', async () => {
    const service = new VoiceService();
    
    const resultPromise = service.listenForCommand();
    
    // Simulate speech after delay
    await VoiceTestHelpers.advanceTimers(1000);
    await VoiceTestHelpers.simulateVoiceCommand('Create a job');
    
    const result = await resultPromise;
    expect(result.transcript).toBe('Create a job');
    expect(result.intent).toBe('create_job');
  });
});
```
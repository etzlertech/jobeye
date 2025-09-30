/**
 * @file speech-synthesis.mock.ts
 * @purpose Mock Web Speech API for voice narration testing
 * @test_type mock
 */

/**
 * Mock SpeechSynthesisUtterance
 */
export class MockSpeechSynthesisUtterance {
  text: string = '';
  lang: string = 'en-US';
  voice: SpeechSynthesisVoice | null = null;
  volume: number = 1;
  rate: number = 1;
  pitch: number = 1;

  onstart: ((event: any) => void) | null = null;
  onend: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onpause: ((event: any) => void) | null = null;
  onresume: ((event: any) => void) | null = null;
  onmark: ((event: any) => void) | null = null;
  onboundary: ((event: any) => void) | null = null;

  constructor(text?: string) {
    if (text) {
      this.text = text;
    }
  }
}

/**
 * Mock SpeechSynthesis
 */
export class MockSpeechSynthesis {
  private queue: MockSpeechSynthesisUtterance[] = [];
  private currentUtterance: MockSpeechSynthesisUtterance | null = null;
  private _speaking: boolean = false;
  private _paused: boolean = false;
  private _pending: boolean = false;

  get speaking(): boolean {
    return this._speaking;
  }

  get paused(): boolean {
    return this._paused;
  }

  get pending(): boolean {
    return this._pending;
  }

  speak(utterance: MockSpeechSynthesisUtterance): void {
    this.queue.push(utterance);
    this._pending = this.queue.length > 1;

    if (!this._speaking) {
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      this._speaking = false;
      this._pending = false;
      return;
    }

    this.currentUtterance = this.queue.shift()!;
    this._speaking = true;
    this._pending = this.queue.length > 0;

    // Trigger onstart
    if (this.currentUtterance.onstart) {
      setTimeout(() => {
        this.currentUtterance!.onstart!({ type: 'start' });
      }, 0);
    }

    // Simulate speech duration based on text length
    const duration = Math.max(100, this.currentUtterance.text.length * 50 / this.currentUtterance.rate);

    setTimeout(() => {
      if (this.currentUtterance?.onend) {
        this.currentUtterance.onend({ type: 'end' });
      }
      this.currentUtterance = null;
      this._speaking = false;
      this.processQueue();
    }, duration);
  }

  cancel(): void {
    this.queue = [];

    if (this.currentUtterance?.onend) {
      this.currentUtterance.onend({ type: 'end' });
    }

    this.currentUtterance = null;
    this._speaking = false;
    this._paused = false;
    this._pending = false;
  }

  pause(): void {
    if (this._speaking && !this._paused) {
      this._paused = true;

      if (this.currentUtterance?.onpause) {
        this.currentUtterance.onpause({ type: 'pause' });
      }
    }
  }

  resume(): void {
    if (this._speaking && this._paused) {
      this._paused = false;

      if (this.currentUtterance?.onresume) {
        this.currentUtterance.onresume({ type: 'resume' });
      }
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return [
      {
        voiceURI: 'mock-voice',
        name: 'Mock Voice',
        lang: 'en-US',
        localService: true,
        default: true
      } as SpeechSynthesisVoice
    ];
  }
}

/**
 * Setup Speech Synthesis mock in global scope
 */
export function setupSpeechSynthesisMock() {
  const mockSynthesis = new MockSpeechSynthesis();

  // @ts-ignore - Adding to global
  global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

  // @ts-ignore - Adding to global
  global.speechSynthesis = mockSynthesis;

  // Also add to window if available
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    // @ts-ignore
    window.speechSynthesis = mockSynthesis;
  }

  return mockSynthesis;
}

/**
 * Cleanup Speech Synthesis mock
 */
export function cleanupSpeechSynthesisMock() {
  // @ts-ignore
  delete global.SpeechSynthesisUtterance;
  // @ts-ignore
  delete global.speechSynthesis;

  if (typeof window !== 'undefined') {
    // @ts-ignore
    delete window.SpeechSynthesisUtterance;
    // @ts-ignore
    delete window.speechSynthesis;
  }
}

/**
 * Default export
 */
export default {
  setupSpeechSynthesisMock,
  cleanupSpeechSynthesisMock,
  MockSpeechSynthesis,
  MockSpeechSynthesisUtterance,
  __esModule: true
};
/**
 * @file src/types/voice-events.d.ts
 * @description Global custom event typings for voice processor interactions.
 * END AGENT DIRECTIVE BLOCK
 */

import type { VoiceCommand, VoiceResponse } from '@/lib/voice/voice-processor';

declare global {
  interface WindowEventMap {
    'voice:voicestart': CustomEvent<void>;
    'voice:voiceend': CustomEvent<void>;
    'voice:voiceresult': CustomEvent<{ transcript: string; confidence: number; isFinal: boolean }>;
    'voice:commandprocessed': CustomEvent<{ command: VoiceCommand; response: VoiceResponse }>;
    'voice:voiceerror': CustomEvent<{ error?: string }>;
    'voice:speechstart': CustomEvent<{ text: string }>;
    'voice:speechend': CustomEvent<void>;
    'voice:speecherror': CustomEvent<{ error?: string }>;
  }
}

export {};

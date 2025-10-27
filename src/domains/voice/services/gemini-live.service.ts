/**
 * @file Gemini Live API Service
 * @purpose WebSocket connection management for Gemini Live API
 * @phase 3
 * @domain Voice
 */

export interface GeminiLiveConfig {
  model?: string;
  systemInstruction?: string;
  tools?: ToolDeclaration[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

export interface ToolDeclaration {
  functionDeclarations: FunctionDeclaration[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AudioChunk {
  data: string; // base64-encoded PCM audio
  mimeType: string;
}

export interface ToolCall {
  functionCalls: Array<{
    id: string;
    name: string;
    args: Record<string, any>;
  }>;
}

export interface ToolResponse {
  functionResponses: Array<{
    id: string;
    name: string;
    response: Record<string, any>;
  }>;
}

export type GeminiLiveEventHandler = {
  onSetupComplete?: () => void;
  onServerContent?: (content: any) => void;
  onToolCall?: (toolCall: ToolCall) => Promise<ToolResponse>;
  onError?: (error: Error) => void;
  onClose?: () => void;
};

/**
 * Gemini Live API WebSocket Service
 */
export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private apiKey: string;
  private handlers: GeminiLiveEventHandler;
  private isSetupComplete = false;

  constructor(apiKey: string, config: GeminiLiveConfig, handlers: GeminiLiveEventHandler) {
    this.apiKey = apiKey;
    this.config = config;
    this.handlers = handlers;
  }

  /**
   * Connect to Gemini Live API
   */
  async connect(): Promise<void> {
    const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

    console.log('[GeminiLive] Connecting to', endpoint);

    this.ws = new WebSocket(endpoint);

    this.ws.onopen = () => {
      console.log('[GeminiLive] WebSocket connected');
      this.sendSetup();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (event) => {
      console.error('[GeminiLive] WebSocket error:', event);
      if (this.handlers.onError) {
        this.handlers.onError(new Error('WebSocket error'));
      }
    };

    this.ws.onclose = () => {
      console.log('[GeminiLive] WebSocket closed');
      if (this.handlers.onClose) {
        this.handlers.onClose();
      }
    };
  }

  /**
   * Send initial setup configuration
   */
  private sendSetup(): void {
    if (!this.ws) return;

    const setupMessage = {
      setup: {
        model: this.config.model || 'models/gemini-2.0-flash-live-001',
        generationConfig: this.config.generationConfig,
        systemInstruction: this.config.systemInstruction
          ? {
              parts: [{ text: this.config.systemInstruction }],
            }
          : undefined,
        tools: this.config.tools,
      },
    };

    console.log('[GeminiLive] Sending setup:', setupMessage);
    this.ws.send(JSON.stringify(setupMessage));
  }

  /**
   * Send audio chunk
   */
  sendAudio(audioData: string): void {
    if (!this.ws || !this.isSetupComplete) {
      console.warn('[GeminiLive] Cannot send audio: setup not complete');
      return;
    }

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: audioData, // base64-encoded PCM
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send tool response
   */
  sendToolResponse(response: ToolResponse): void {
    if (!this.ws) return;

    const message = {
      toolResponse: response,
    };

    console.log('[GeminiLive] Sending tool response:', message);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data);

      console.log('[GeminiLive] Received message:', message);

      // Setup complete
      if (message.setupComplete) {
        console.log('[GeminiLive] Setup complete');
        this.isSetupComplete = true;
        if (this.handlers.onSetupComplete) {
          this.handlers.onSetupComplete();
        }
      }

      // Server content (audio/text)
      if (message.serverContent) {
        if (this.handlers.onServerContent) {
          this.handlers.onServerContent(message.serverContent);
        }
      }

      // Tool call
      if (message.toolCall) {
        console.log('[GeminiLive] Tool call received:', message.toolCall);
        if (this.handlers.onToolCall) {
          const response = await this.handlers.onToolCall(message.toolCall);
          this.sendToolResponse(response);
        }
      }
    } catch (error) {
      console.error('[GeminiLive] Error handling message:', error);
      if (this.handlers.onError) {
        this.handlers.onError(error as Error);
      }
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isSetupComplete = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

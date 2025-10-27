/**
 * Audio Processor Worklet
 * Processes microphone audio for Gemini Live API
 * Converts to 16-bit PCM at 16kHz
 */

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (input && input.length > 0) {
      const channelData = input[0]; // Mono channel

      // Convert Float32Array to Int16Array (PCM16)
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        this.buffer.push(Math.floor(sample * 32767));
      }

      // Send buffer when it reaches target size
      if (this.buffer.length >= this.bufferSize) {
        const pcmData = new Int16Array(this.buffer);
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
        this.buffer = [];
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);

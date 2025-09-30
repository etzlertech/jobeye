/**
 * @file /src/domains/vision/services/voice-narration.service.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Voice narration service for verification results
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

import { VerifyKitResult } from './vision-verification.service';

export interface VoiceNarrationOptions {
  rate?: number; // 0.1 to 10 (default 1)
  pitch?: number; // 0 to 2 (default 1)
  volume?: number; // 0 to 1 (default 1)
  voice?: SpeechSynthesisVoice;
  language?: string; // e.g., 'en-US'
}

/**
 * Voice Narration Service using Web Speech API
 */
export class VoiceNarrationService {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isAvailable: boolean = false;

  constructor() {
    // Check both window (browser) and global (Node.js/Jest) for speechSynthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.isAvailable = true;
    } else if (typeof global !== 'undefined' && 'speechSynthesis' in global) {
      this.synthesis = (global as any).speechSynthesis;
      this.isAvailable = true;
    }
  }

  /**
   * Check if voice narration is available
   */
  isSupported(): boolean {
    return this.isAvailable;
  }

  /**
   * Create a SpeechSynthesisUtterance (works in both browser and test environments)
   */
  private createUtterance(text: string): SpeechSynthesisUtterance {
    // Try window first (browser), then global (Jest)
    if (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) {
      return new window.SpeechSynthesisUtterance(text);
    } else if (typeof global !== 'undefined' && (global as any).SpeechSynthesisUtterance) {
      return new (global as any).SpeechSynthesisUtterance(text);
    }
    throw new Error('SpeechSynthesisUtterance not available');
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  /**
   * Narrate verification result
   */
  async narrateResult(
    result: VerifyKitResult & { kitId: string },
    options: VoiceNarrationOptions = {}
  ): Promise<void> {
    if (!this.synthesis) {
      throw new Error('Speech synthesis not available');
    }

    // Stop any current narration
    this.stop();

    // Generate narration text
    const text = this.generateNarrationText(result);

    // Create utterance
    const utterance = this.createUtterance(text);

    // Apply options
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    if (options.voice) {
      utterance.voice = options.voice;
    } else if (options.language) {
      utterance.lang = options.language;
    }

    // Store current utterance
    this.currentUtterance = utterance;

    // Return promise that resolves when narration completes
    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        reject(new Error(`Narration error: ${event.error}`));
      };

      this.synthesis!.speak(utterance);
    });
  }

  /**
   * Generate natural language narration text from result
   */
  private generateNarrationText(result: VerifyKitResult & { kitId: string }): string {
    const parts: string[] = [];

    // Opening
    parts.push(`Kit verification complete for ${result.kitId}.`);

    // Overall result
    const statusText = {
      complete: 'All items verified successfully.',
      incomplete: 'Verification incomplete. Some items are missing or uncertain.',
      failed: 'Verification failed. Multiple items are missing.'
    }[result.verificationResult];

    parts.push(statusText);

    // Confidence score
    const confidencePercent = Math.round(result.confidenceScore * 100);
    parts.push(`Confidence score: ${confidencePercent} percent.`);

    // Detected items summary
    const matchedCount = result.detectedItems.filter(i => i.matchStatus === 'matched').length;
    const uncertainCount = result.detectedItems.filter(i => i.matchStatus === 'uncertain').length;
    const unmatchedCount = result.detectedItems.filter(i => i.matchStatus === 'unmatched').length;

    if (matchedCount > 0) {
      parts.push(`${matchedCount} ${matchedCount === 1 ? 'item' : 'items'} matched.`);
    }

    if (uncertainCount > 0) {
      parts.push(`${uncertainCount} ${uncertainCount === 1 ? 'item' : 'items'} uncertain.`);
    }

    if (unmatchedCount > 0) {
      parts.push(`${unmatchedCount} ${unmatchedCount === 1 ? 'item' : 'items'} unmatched.`);
    }

    // Missing items
    if (result.missingItems.length > 0) {
      if (result.missingItems.length <= 3) {
        parts.push(`Missing items: ${result.missingItems.join(', ')}.`);
      } else {
        parts.push(`${result.missingItems.length} items are missing.`);
      }
    }

    // Unexpected items
    if (result.unexpectedItems.length > 0) {
      if (result.unexpectedItems.length <= 3) {
        parts.push(`Unexpected items detected: ${result.unexpectedItems.join(', ')}.`);
      } else {
        parts.push(`${result.unexpectedItems.length} unexpected items detected.`);
      }
    }

    // Processing details
    if (result.processingMethod === 'cloud_vlm') {
      parts.push('Used cloud vision model for verification.');
      parts.push(`Cost: ${result.costUsd.toFixed(2)} dollars.`);
    } else {
      parts.push('Used local YOLO model for verification.');
    }

    // Processing time
    const timeSeconds = (result.processingTimeMs / 1000).toFixed(1);
    parts.push(`Processing time: ${timeSeconds} seconds.`);

    // Closing
    if (result.verificationResult === 'complete') {
      parts.push('Kit is ready for use.');
    } else if (result.verificationResult === 'incomplete') {
      parts.push('Please review missing or uncertain items.');
    } else {
      parts.push('Please verify kit contents manually.');
    }

    return parts.join(' ');
  }

  /**
   * Narrate quick summary (shorter version)
   */
  async narrateQuickSummary(
    result: VerifyKitResult & { kitId: string },
    options: VoiceNarrationOptions = {}
  ): Promise<void> {
    if (!this.synthesis) {
      throw new Error('Speech synthesis not available');
    }

    this.stop();

    const parts: string[] = [];

    // Quick summary
    const statusEmoji = {
      complete: 'Success',
      incomplete: 'Incomplete',
      failed: 'Failed'
    }[result.verificationResult];

    parts.push(`${statusEmoji}.`);

    const matchedCount = result.detectedItems.filter(i => i.matchStatus === 'matched').length;
    parts.push(`${matchedCount} items matched.`);

    if (result.missingItems.length > 0) {
      parts.push(`${result.missingItems.length} missing.`);
    }

    const confidencePercent = Math.round(result.confidenceScore * 100);
    parts.push(`${confidencePercent} percent confidence.`);

    const text = parts.join(' ');

    const utterance = this.createUtterance(text);
    utterance.rate = options.rate ?? 1.2; // Slightly faster for quick summary
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    if (options.voice) {
      utterance.voice = options.voice;
    }

    this.currentUtterance = utterance;

    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        reject(new Error(`Narration error: ${event.error}`));
      };

      this.synthesis!.speak(utterance);
    });
  }

  /**
   * Speak custom text
   */
  async speak(text: string, options: VoiceNarrationOptions = {}): Promise<void> {
    if (!this.synthesis) {
      throw new Error('Speech synthesis not available');
    }

    this.stop();

    const utterance = this.createUtterance(text);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    if (options.voice) {
      utterance.voice = options.voice;
    } else if (options.language) {
      utterance.lang = options.language;
    }

    this.currentUtterance = utterance;

    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        reject(new Error(`Narration error: ${event.error}`));
      };

      this.synthesis!.speak(utterance);
    });
  }

  /**
   * Pause current narration
   */
  pause(): void {
    if (this.synthesis && this.synthesis.speaking) {
      this.synthesis.pause();
    }
  }

  /**
   * Resume paused narration
   */
  resume(): void {
    if (this.synthesis && this.synthesis.paused) {
      this.synthesis.resume();
    }
  }

  /**
   * Stop current narration
   */
  stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis?.speaking ?? false;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.synthesis?.paused ?? false;
  }

  /**
   * Generate narration text for a single detected item
   */
  narrateDetectedItem(item: { label: string; confidence: number }): string {
    // Format label: replace underscores with spaces
    const formattedLabel = item.label.replace(/_/g, ' ');

    // High confidence (>=0.80): confident statement
    if (item.confidence >= 0.80) {
      return `I see a ${formattedLabel}`;
    }

    // Medium confidence (0.65-0.80): slightly uncertain
    if (item.confidence >= 0.65) {
      return `I see what appears to be a ${formattedLabel}`;
    }

    // Low confidence (<0.65): uncertain
    return `I might see a ${formattedLabel}, but I'm not sure`;
  }

  /**
   * Generate narration text for missing items
   */
  narrateMissingItems(missingItems: string[]): string {
    if (missingItems.length === 0) {
      return '';
    }

    // Format items: replace underscores
    const formatted = missingItems.map(item => item.replace(/_/g, ' '));

    if (missingItems.length === 1) {
      return `Missing: ${formatted[0]}`;
    }

    if (missingItems.length === 2) {
      return `Missing: ${formatted[0]} and ${formatted[1]}`;
    }

    // 3+ items
    const lastItem = formatted.pop();
    return `Missing: ${formatted.join(', ')}, and ${lastItem}`;
  }

  /**
   * Generate cost warning when budget is exceeded
   */
  narrateCostWarning(currentCost: number, budgetCap: number): string {
    if (currentCost < budgetCap) {
      return ''; // No warning needed
    }

    if (currentCost === budgetCap) {
      return `Warning: Daily budget limit of $${budgetCap.toFixed(2)} reached`;
    }

    // Over budget
    const overage = currentCost - budgetCap;
    return `Warning: Daily budget exceeded by $${overage.toFixed(2)}. Current: $${currentCost.toFixed(2)}, Limit: $${budgetCap.toFixed(2)}`;
  }

  /**
   * Generate narration text from result (text-only, doesn't speak)
   *
   * This is the synchronous version that just returns the text.
   * Use narrateResult() for the async version that actually speaks.
   */
  narrateResultText(result: any): string {
    const parts: string[] = [];

    // Check if result has full VerifyKitResult structure or simple test structure
    if (result.verified !== undefined) {
      // Simple test structure
      if (result.verified) {
        parts.push('Kit verified successfully');
      } else {
        parts.push('Kit verification incomplete');
      }

      // Add detected items
      if (result.detectedItems && result.detectedItems.length > 0) {
        const items = result.detectedItems
          .map((item: any) => item.label || item)
          .join(', ');
        parts.push(`Detected items: ${items}`);
      }

      // Add missing items
      if (result.missingItems && result.missingItems.length > 0) {
        const missing = result.missingItems.join(', ');
        parts.push(`Missing items: ${missing}`);
      }

      // Add confidence
      if (result.confidence !== undefined) {
        const confidencePercent = Math.round(result.confidence * 100);
        parts.push(`Confidence: ${confidencePercent}%`);

        if (result.confidence < 0.70) {
          parts.push('Low confidence - may need review');
        }
      }

      return parts.join('. ');
    }

    // Full VerifyKitResult structure - use existing generateNarrationText
    if (result.kitId) {
      return this.generateNarrationText(result);
    }

    return 'Verification result unavailable';
  }
}

/**
 * Singleton instance
 */
let serviceInstance: VoiceNarrationService | null = null;

export function getVoiceNarrationService(): VoiceNarrationService {
  if (!serviceInstance) {
    serviceInstance = new VoiceNarrationService();
  }
  return serviceInstance;
}
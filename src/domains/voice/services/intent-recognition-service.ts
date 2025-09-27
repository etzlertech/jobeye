// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/voice/services/intent-recognition-service.ts
// phase: 3
// domain: voice-pipeline
// purpose: Natural language intent classification and entity extraction
// spec_ref: phase3/voice-pipeline#intent-recognition
// version: 2025-08-1
// complexity_budget: 400 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/voice/types/voice-types
//     - /src/core/logger/voice-logger
//   external:
//     - zod: ^3.22.0
//
// exports:
//   - IntentRecognitionService: class - Intent classification service
//   - classifyIntent: function - Classify voice command intent
//   - extractEntities: function - Extract entities from text
//   - getConfidenceScore: function - Get classification confidence
//
// voice_considerations: |
//   Natural language processing for voice commands.
//   Support for command variations and synonyms.
//   Context-aware intent resolution.
//   Confidence scoring for ambiguous commands.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/voice/services/intent-recognition-service.test.ts
//
// tasks:
//   1. Define intent taxonomy and patterns
//   2. Implement pattern matching engine
//   3. Create entity extraction logic
//   4. Add confidence scoring
//   5. Build context management
//   6. Add offline pattern cache
// --- END DIRECTIVE BLOCK ---

import { VoiceCommand, VoiceIntent, CommandEntity } from '../types/voice-types';
import { VoiceLogger } from '@/core/logger/voice-logger';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

// Intent patterns for different domains
export interface IntentPattern {
  intent: VoiceIntent;
  patterns: RegExp[];
  entities: string[];
  examples: string[];
  requiredEntities?: string[];
}

// Entity extraction patterns
export interface EntityPattern {
  type: string;
  patterns: RegExp[];
  transformer?: (match: string) => any;
}

// Intent classification result
export interface IntentClassification {
  intent: VoiceIntent;
  confidence: number;
  entities: CommandEntity[];
  alternativeIntents?: Array<{
    intent: VoiceIntent;
    confidence: number;
  }>;
}

export class IntentRecognitionService {
  private intentPatterns: IntentPattern[];
  private entityPatterns: Map<string, EntityPattern>;
  private contextHistory: VoiceIntent[];
  private logger: VoiceLogger;

  constructor(logger?: VoiceLogger) {
    this.logger = logger || new VoiceLogger();
    this.contextHistory = [];
    this.intentPatterns = this.initializeIntentPatterns();
    this.entityPatterns = this.initializeEntityPatterns();
  }

  /**
   * Classify intent from voice command text
   */
  async classifyIntent(
    text: string,
    context?: {
      previousIntent?: VoiceIntent;
      sessionId?: string;
      userId?: string;
    }
  ): Promise<IntentClassification> {
    try {
      const normalizedText = this.normalizeText(text);
      
      // Score all intents
      const intentScores = this.scoreIntents(normalizedText, context?.previousIntent);
      
      // Sort by confidence
      const sortedIntents = intentScores.sort((a, b) => b.confidence - a.confidence);
      
      if (sortedIntents.length === 0 || sortedIntents[0].confidence < 0.3) {
        throw new Error('Unable to determine intent from command');
      }

      const bestMatch = sortedIntents[0];
      const entities = await this.extractEntities(normalizedText, bestMatch.pattern);

      // Validate required entities
      this.validateRequiredEntities(bestMatch.pattern, entities);

      // Update context history
      this.updateContext(bestMatch.intent);

      // Log classification
      await this.logger.logVoiceInteraction({
        action: 'intent_classified',
        intent: bestMatch.intent,
        confidence: bestMatch.confidence,
        entities: entities.length,
        originalText: text,
        normalizedText,
        metadata: {
          sessionId: context?.sessionId,
          userId: context?.userId,
        },
      });

      return {
        intent: bestMatch.intent,
        confidence: bestMatch.confidence,
        entities,
        alternativeIntents: sortedIntents.slice(1, 4).map(({ intent, confidence }) => ({
          intent,
          confidence,
        })),
      };
    } catch (error) {
      throw createAppError({
        code: 'INTENT_CLASSIFICATION_FAILED',
        message: 'Failed to classify voice command intent',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Extract entities from text
   */
  async extractEntities(text: string, pattern: IntentPattern): Promise<CommandEntity[]> {
    const entities: CommandEntity[] = [];
    
    for (const entityType of pattern.entities) {
      const entityPattern = this.entityPatterns.get(entityType);
      if (!entityPattern) continue;

      for (const regex of entityPattern.patterns) {
        const matches = text.matchAll(regex);
        for (const match of matches) {
          const value = entityPattern.transformer 
            ? entityPattern.transformer(match[1] || match[0])
            : match[1] || match[0];
            
          entities.push({
            type: entityType,
            value,
            confidence: 0.9, // High confidence for pattern matches
            startIndex: match.index || 0,
            endIndex: (match.index || 0) + match[0].length,
          });
        }
      }
    }

    return this.deduplicateEntities(entities);
  }

  /**
   * Get confidence score for a classification
   */
  getConfidenceScore(classification: IntentClassification): number {
    // Adjust confidence based on entity completeness
    let score = classification.confidence;
    
    // Boost confidence if all required entities are present
    const pattern = this.intentPatterns.find(p => p.intent === classification.intent);
    if (pattern?.requiredEntities) {
      const foundTypes = new Set(classification.entities.map(e => e.type));
      const hasAllRequired = pattern.requiredEntities.every(type => foundTypes.has(type));
      
      if (hasAllRequired) {
        score = Math.min(1.0, score * 1.2);
      } else {
        score = Math.max(0.1, score * 0.7);
      }
    }

    return score;
  }

  /**
   * Initialize intent patterns for all domains
   */
  private initializeIntentPatterns(): IntentPattern[] {
    return [
      // Customer domain intents
      {
        intent: VoiceIntent.CREATE_CUSTOMER,
        patterns: [
          /create\s+(?:a\s+)?(?:new\s+)?customer/i,
          /add\s+(?:a\s+)?(?:new\s+)?customer/i,
          /new\s+customer/i,
          /sign\s+up\s+(?:a\s+)?customer/i,
        ],
        entities: ['customer_name', 'phone', 'email', 'address'],
        examples: ['Create a new customer John Smith', 'Add customer Jane Doe'],
        requiredEntities: ['customer_name'],
      },
      {
        intent: VoiceIntent.FIND_CUSTOMER,
        patterns: [
          /find\s+customer/i,
          /search\s+(?:for\s+)?customer/i,
          /look\s+up\s+customer/i,
          /get\s+customer/i,
          /show\s+customer/i,
        ],
        entities: ['customer_name', 'phone', 'customer_id'],
        examples: ['Find customer John Smith', 'Look up customer by phone 555-1234'],
      },
      {
        intent: VoiceIntent.UPDATE_CUSTOMER,
        patterns: [
          /update\s+customer/i,
          /change\s+customer/i,
          /edit\s+customer/i,
          /modify\s+customer/i,
        ],
        entities: ['customer_name', 'customer_id', 'field_name', 'field_value'],
        examples: ['Update customer John Smith phone to 555-5678'],
        requiredEntities: ['customer_name', 'field_name', 'field_value'],
      },
      
      // Job domain intents
      {
        intent: VoiceIntent.CREATE_JOB,
        patterns: [
          /create\s+(?:a\s+)?(?:new\s+)?job/i,
          /schedule\s+(?:a\s+)?job/i,
          /add\s+(?:a\s+)?job/i,
          /book\s+(?:a\s+)?(?:service|appointment)/i,
        ],
        entities: ['job_type', 'customer_name', 'date', 'time', 'duration', 'address'],
        examples: ['Create a lawn care job for John Smith tomorrow at 2pm'],
        requiredEntities: ['job_type', 'customer_name'],
      },
      {
        intent: VoiceIntent.UPDATE_JOB_STATUS,
        patterns: [
          /(?:update|change)\s+job\s+status/i,
          /mark\s+job\s+(?:as\s+)?(\w+)/i,
          /job\s+is\s+(\w+)/i,
          /start(?:ing)?\s+job/i,
          /complet(?:e|ed|ing)\s+job/i,
        ],
        entities: ['job_id', 'job_status', 'notes'],
        examples: ['Mark job as completed', 'Starting job now', 'Update job status to in progress'],
      },
      {
        intent: VoiceIntent.FIND_JOBS,
        patterns: [
          /(?:show|list|find)\s+jobs/i,
          /what\s+jobs/i,
          /my\s+jobs/i,
          /today(?:'s)?\s+jobs/i,
          /tomorrow(?:'s)?\s+jobs/i,
        ],
        entities: ['date', 'job_status', 'customer_name', 'job_type'],
        examples: ["Show today's jobs", 'List all pending jobs', 'Find jobs for John Smith'],
      },
      
      // Equipment domain intents
      {
        intent: VoiceIntent.CHECK_EQUIPMENT,
        patterns: [
          /check\s+equipment/i,
          /equipment\s+status/i,
          /(?:where|find)\s+(?:is\s+)?(?:the\s+)?(\w+)/i,
          /locate\s+equipment/i,
        ],
        entities: ['equipment_name', 'equipment_type', 'equipment_id'],
        examples: ['Check equipment status', 'Where is the mower', 'Find trimmer location'],
      },
      {
        intent: VoiceIntent.UPDATE_EQUIPMENT,
        patterns: [
          /update\s+equipment/i,
          /equipment\s+needs\s+(\w+)/i,
          /(\w+)\s+is\s+broken/i,
          /mark\s+equipment/i,
        ],
        entities: ['equipment_name', 'equipment_id', 'equipment_status', 'notes'],
        examples: ['Mower needs maintenance', 'Trimmer is broken', 'Update equipment status'],
      },
      
      // Material domain intents
      {
        intent: VoiceIntent.CHECK_INVENTORY,
        patterns: [
          /check\s+(?:inventory|stock)/i,
          /how\s+much\s+(\w+)/i,
          /(?:inventory|stock)\s+(?:level|count)/i,
          /what(?:'s)?\s+(?:in\s+)?stock/i,
        ],
        entities: ['material_name', 'material_type', 'location'],
        examples: ['Check fertilizer inventory', 'How much seed do we have', 'Stock levels'],
      },
      {
        intent: VoiceIntent.USE_MATERIAL,
        patterns: [
          /use(?:d)?\s+(\d+)\s*(?:\w+)?\s*(?:of\s+)?(\w+)/i,
          /apply(?:ing)?\s+(\w+)/i,
          /record\s+material\s+use/i,
        ],
        entities: ['quantity', 'unit', 'material_name', 'job_id'],
        examples: ['Used 10 pounds of fertilizer', 'Applying seed to lawn', 'Record material usage'],
      },
      
      // General intents
      {
        intent: VoiceIntent.HELP,
        patterns: [
          /help/i,
          /what\s+can\s+(?:you|i)\s+(?:do|say)/i,
          /how\s+do\s+i/i,
          /show\s+commands/i,
        ],
        entities: ['topic'],
        examples: ['Help', 'What can you do', 'How do I create a job'],
      },
      {
        intent: VoiceIntent.CANCEL,
        patterns: [
          /cancel/i,
          /never\s*mind/i,
          /stop/i,
          /abort/i,
          /go\s+back/i,
        ],
        entities: [],
        examples: ['Cancel', 'Never mind', 'Stop'],
      },
    ];
  }

  /**
   * Initialize entity extraction patterns
   */
  private initializeEntityPatterns(): Map<string, EntityPattern> {
    const patterns = new Map<string, EntityPattern>();

    // Customer name patterns
    patterns.set('customer_name', {
      type: 'customer_name',
      patterns: [
        /(?:customer|client)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        /for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        /(?:mr\.|mrs\.|ms\.|miss)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      ],
    });

    // Phone patterns
    patterns.set('phone', {
      type: 'phone',
      patterns: [
        /\b(\d{3}[-.]?\d{3}[-.]?\d{4})\b/,
        /\b(\d{10})\b/,
        /phone\s*(?:number)?\s*(?:is)?\s*(\d{3}[-.]?\d{3}[-.]?\d{4})/i,
      ],
      transformer: (match: string) => match.replace(/[-.]/g, ''),
    });

    // Email patterns
    patterns.set('email', {
      type: 'email',
      patterns: [
        /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/,
        /email\s*(?:is)?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      ],
    });

    // Date patterns
    patterns.set('date', {
      type: 'date',
      patterns: [
        /\b(today|tomorrow|yesterday)\b/i,
        /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/,
        /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\b/i,
      ],
      transformer: (match: string) => this.parseDate(match),
    });

    // Time patterns
    patterns.set('time', {
      type: 'time',
      patterns: [
        /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i,
        /\b(\d{1,2}\s*(?:am|pm))\b/i,
        /at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
      ],
    });

    // Quantity patterns
    patterns.set('quantity', {
      type: 'quantity',
      patterns: [
        /\b(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?|gallons?|gal|bags?|units?)\b/i,
        /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:pounds?|gallons?|bags?)\b/i,
      ],
      transformer: (match: string) => this.parseQuantity(match),
    });

    // Job type patterns
    patterns.set('job_type', {
      type: 'job_type',
      patterns: [
        /\b(lawn\s*(?:care|mowing|service)|mow(?:ing)?)\b/i,
        /\b(landscap(?:e|ing)|yard\s*work)\b/i,
        /\b(irrigat(?:e|ion)|sprinkler)\b/i,
        /\b(fertiliz(?:e|ing|ation)|pest\s*control|weed\s*control)\b/i,
        /\b(trim(?:ming)?|edg(?:e|ing)|cleanup?)\b/i,
      ],
    });

    // Job status patterns
    patterns.set('job_status', {
      type: 'job_status',
      patterns: [
        /\b(scheduled|assigned|in\s*progress|on\s*hold|complet(?:e|ed)|cancel(?:led)?)\b/i,
        /\b(start(?:ed|ing)|finish(?:ed)?|done)\b/i,
      ],
      transformer: (match: string) => this.normalizeJobStatus(match),
    });

    // Equipment patterns
    patterns.set('equipment_name', {
      type: 'equipment_name',
      patterns: [
        /\b(mower|trimmer|blower|edger|spreader|sprayer)\b/i,
        /\b(truck|trailer|van)\s*(?:#?\d+)?\b/i,
      ],
    });

    // Material patterns
    patterns.set('material_name', {
      type: 'material_name',
      patterns: [
        /\b(fertilizer|seed|pesticide|herbicide|mulch|soil|sand)\b/i,
        /\b(\w+\s*(?:grass|lawn)\s*seed)\b/i,
      ],
    });

    return patterns;
  }

  /**
   * Score intents against the input text
   */
  private scoreIntents(
    text: string,
    previousIntent?: VoiceIntent
  ): Array<{ intent: VoiceIntent; confidence: number; pattern: IntentPattern }> {
    const scores: Array<{ intent: VoiceIntent; confidence: number; pattern: IntentPattern }> = [];

    for (const pattern of this.intentPatterns) {
      let maxScore = 0;
      
      for (const regex of pattern.patterns) {
        if (regex.test(text)) {
          // Base score for pattern match
          let score = 0.7;
          
          // Boost score for exact matches
          const match = text.match(regex);
          if (match && match[0].length / text.length > 0.8) {
            score = 0.9;
          }
          
          // Context boost
          if (previousIntent && this.isRelatedIntent(previousIntent, pattern.intent)) {
            score = Math.min(1.0, score * 1.15);
          }
          
          maxScore = Math.max(maxScore, score);
        }
      }
      
      if (maxScore > 0) {
        scores.push({
          intent: pattern.intent,
          confidence: maxScore,
          pattern,
        });
      }
    }

    return scores;
  }

  /**
   * Check if two intents are related for context scoring
   */
  private isRelatedIntent(intent1: VoiceIntent, intent2: VoiceIntent): boolean {
    const relatedGroups = [
      [VoiceIntent.CREATE_CUSTOMER, VoiceIntent.FIND_CUSTOMER, VoiceIntent.UPDATE_CUSTOMER],
      [VoiceIntent.CREATE_JOB, VoiceIntent.UPDATE_JOB_STATUS, VoiceIntent.FIND_JOBS],
      [VoiceIntent.CHECK_EQUIPMENT, VoiceIntent.UPDATE_EQUIPMENT],
      [VoiceIntent.CHECK_INVENTORY, VoiceIntent.USE_MATERIAL],
    ];

    return relatedGroups.some(group => 
      group.includes(intent1) && group.includes(intent2)
    );
  }

  /**
   * Normalize text for pattern matching
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s@.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate required entities are present
   */
  private validateRequiredEntities(pattern: IntentPattern, entities: CommandEntity[]): void {
    if (!pattern.requiredEntities) return;

    const foundTypes = new Set(entities.map(e => e.type));
    const missing = pattern.requiredEntities.filter(type => !foundTypes.has(type));

    if (missing.length > 0) {
      throw new Error(`Missing required information: ${missing.join(', ')}`);
    }
  }

  /**
   * Update context history
   */
  private updateContext(intent: VoiceIntent): void {
    this.contextHistory.push(intent);
    
    // Keep only last 5 intents for context
    if (this.contextHistory.length > 5) {
      this.contextHistory.shift();
    }
  }

  /**
   * Deduplicate extracted entities
   */
  private deduplicateEntities(entities: CommandEntity[]): CommandEntity[] {
    const seen = new Set<string>();
    return entities.filter(entity => {
      const key = `${entity.type}:${entity.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Parse date strings into Date objects
   */
  private parseDate(dateStr: string): Date {
    const today = new Date();
    const normalized = dateStr.toLowerCase();

    if (normalized === 'today') return today;
    if (normalized === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }
    if (normalized === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return yesterday;
    }

    // Handle day names
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = dayNames.indexOf(normalized);
    if (dayIndex !== -1) {
      const targetDate = new Date(today);
      const currentDay = today.getDay();
      let daysUntil = dayIndex - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      targetDate.setDate(today.getDate() + daysUntil);
      return targetDate;
    }

    // Try to parse as regular date
    return new Date(dateStr);
  }

  /**
   * Parse quantity strings into numbers
   */
  private parseQuantity(quantityStr: string): number {
    const numberWords: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };

    const normalized = quantityStr.toLowerCase();
    
    // Check for word numbers
    for (const [word, value] of Object.entries(numberWords)) {
      if (normalized.includes(word)) {
        return value;
      }
    }

    // Extract numeric value
    const match = normalized.match(/\d+(?:\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
  }

  /**
   * Normalize job status strings
   */
  private normalizeJobStatus(status: string): string {
    const normalized = status.toLowerCase();
    
    if (normalized.includes('start')) return 'in_progress';
    if (normalized.includes('finish') || normalized.includes('done')) return 'completed';
    if (normalized.includes('cancel')) return 'cancelled';
    if (normalized.includes('hold')) return 'on_hold';
    
    return normalized.replace(/\s+/g, '_');
  }
}
/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/voice/kit-management-intents.ts
 * phase: 3
 * domain: scheduling
 * purpose: Define kit management voice command patterns
 * spec_ref: 003-scheduling-kits/contracts/kit-management.yaml
 * complexity_budget: 200
 * state_machine: none
 * estimated_llm_cost: 0.001
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/core/voice/intent-types"
 *     - "@/core/logger/voice-logger"
 *   external: none
 *   supabase: none
 * exports:
 *   - KIT_MANAGEMENT_INTENTS
 *   - parseKitIntent
 *   - KitIntentType
 * voice_considerations:
 *   - Natural language for kit operations
 *   - Simple override commands
 *   - Item-specific queries
 * test_requirements:
 *   coverage: 95%
 *   test_file: src/__tests__/scheduling/unit/kit-management-intents.test.ts
 * tasks:
 *   - Define kit intent patterns
 *   - Parse override requests
 *   - Handle item queries
 *   - Support verification commands
 */

import { logger } from '@/core/logger/voice-logger';

export enum KitIntentType {
  LOAD_KIT = 'load_kit',
  VERIFY_KIT = 'verify_kit',
  OVERRIDE_ITEM = 'override_item',
  CHECK_ITEM = 'check_item',
  LIST_ITEMS = 'list_items',
  REPORT_MISSING = 'report_missing',
  SWITCH_VARIANT = 'switch_variant',
  KIT_STATUS = 'kit_status',
  FIND_ITEM = 'find_item',
  ADD_NOTE = 'add_note'
}

export interface KitIntent {
  type: KitIntentType;
  parameters: {
    kitName?: string;
    itemName?: string;
    reason?: string;
    variant?: string;
    quantity?: number;
    location?: string;
    note?: string;
  };
  confidence: number;
  originalText: string;
}

export interface KitIntentPattern {
  type: KitIntentType;
  patterns: RegExp[];
  extractor: (match: RegExpMatchArray, text: string) => any;
}

export const KIT_MANAGEMENT_INTENTS: KitIntentPattern[] = [
  {
    type: KitIntentType.LOAD_KIT,
    patterns: [
      /load (?:the )?(.+?)(?:kit|equipment)/i,
      /(?:get|prepare) (?:the )?(.+?)(?:kit|equipment|tools)/i,
      /(?:i'?m )?loading (?:the )?(.+?)(?:kit|equipment)/i,
      /set up (?:the )?(.+?)(?:kit|equipment)/i
    ],
    extractor: (match) => ({
      kitName: normalizeKitName(match[1])
    })
  },
  {
    type: KitIntentType.VERIFY_KIT,
    patterns: [
      /verify (?:the )?(?:kit|equipment|tools)/i,
      /(?:check|confirm) (?:all )?(?:kit|equipment) (?:is )?(?:loaded|ready)/i,
      /(?:i )?(?:have|got) (?:all|everything)/i,
      /kit (?:is )?(?:complete|ready|verified)/i
    ],
    extractor: () => ({})
  },
  {
    type: KitIntentType.OVERRIDE_ITEM,
    patterns: [
      /(?:override|missing|don'?t have|out of) (.+?)(?:\s+because\s+(.+))?/i,
      /(.+?)(?:is|are) (?:missing|not available|broken)(?:\s+(.+))?/i,
      /(?:can'?t find|no) (.+?)(?:\s+(.+))?/i,
      /(?:skip|exclude) (.+?)(?:\s+(.+))?/i
    ],
    extractor: (match) => ({
      itemName: normalizeItemName(match[1]),
      reason: match[2] || 'Not available'
    })
  },
  {
    type: KitIntentType.CHECK_ITEM,
    patterns: [
      /(?:do )?(?:i|we) (?:have|need) (.+)/i,
      /(?:is|are) (.+) (?:in )?(?:the )?kit/i,
      /check (?:for )?(.+)/i,
      /(?:what about|how about) (.+)/i
    ],
    extractor: (match) => ({
      itemName: normalizeItemName(match[1])
    })
  },
  {
    type: KitIntentType.LIST_ITEMS,
    patterns: [
      /(?:what'?s|what is) (?:in )?(?:the|this) kit/i,
      /(?:list|show|read) (?:all )?(?:kit )?items/i,
      /what (?:do )?(?:i|we) need/i,
      /(?:tell me )?what (?:equipment|tools|items)/i
    ],
    extractor: () => ({})
  },
  {
    type: KitIntentType.REPORT_MISSING,
    patterns: [
      /(?:report|log) missing (?:items|equipment)/i,
      /(?:send|submit) (?:the )?(?:missing|override) (?:report|list)/i,
      /notify (?:supervisor|office) (?:about )?(?:missing items)?/i
    ],
    extractor: () => ({})
  },
  {
    type: KitIntentType.SWITCH_VARIANT,
    patterns: [
      /(?:switch|change) to (.+?)(?:variant|version|kit)/i,
      /use (?:the )?(.+?)(?:variant|version)/i,
      /(?:i )?need (?:the )?(.+?)(?:variant|version|configuration)/i
    ],
    extractor: (match) => ({
      variant: normalizeVariantName(match[1])
    })
  },
  {
    type: KitIntentType.KIT_STATUS,
    patterns: [
      /(?:what'?s|show) (?:the )?kit status/i,
      /(?:how many|what) items (?:are )?missing/i,
      /(?:am i|are we) ready (?:to go)?/i,
      /(?:kit|equipment) (?:status|report)/i
    ],
    extractor: () => ({})
  },
  {
    type: KitIntentType.FIND_ITEM,
    patterns: [
      /(?:where'?s|where is|find) (?:the )?(.+)/i,
      /(?:help me )?(?:locate|find) (.+)/i,
      /(?:i )?(?:can'?t|cannot) (?:find|see) (?:the )?(.+)/i
    ],
    extractor: (match) => ({
      itemName: normalizeItemName(match[1])
    })
  },
  {
    type: KitIntentType.ADD_NOTE,
    patterns: [
      /(?:add )?note(?:\s*:)?\s+(.+)/i,
      /(?:log|record) (?:that )?(.+)/i,
      /(?:remember|remind) (?:that )?(.+)/i
    ],
    extractor: (match) => ({
      note: match[1].trim()
    })
  }
];

export function parseKitIntent(text: string): KitIntent | null {
  const normalizedText = text.toLowerCase().trim();
  
  for (const intentDef of KIT_MANAGEMENT_INTENTS) {
    for (const pattern of intentDef.patterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        try {
          const parameters = intentDef.extractor(match, normalizedText);
          
          logger.debug('Kit intent matched', {
            type: intentDef.type,
            pattern: pattern.source,
            parameters
          });

          return {
            type: intentDef.type,
            parameters,
            confidence: calculateConfidence(match, normalizedText),
            originalText: text
          };
        } catch (error) {
          logger.error('Error extracting kit intent parameters', { 
            error, 
            type: intentDef.type,
            text 
          });
        }
      }
    }
  }

  return null;
}

function normalizeKitName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/i, '');
}

function normalizeItemName(name: string): string {
  // Remove articles and clean up
  let normalized = name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an|some)\s+/i, '');

  // Handle plurals (simple version)
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function normalizeVariantName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  // Map common variants
  const variantMap: Record<string, string> = {
    'summer': 'summer_variant',
    'winter': 'winter_variant',
    'spring': 'spring_variant',
    'fall': 'fall_variant',
    'autumn': 'fall_variant',
    'basic': 'default',
    'standard': 'default',
    'full': 'full_variant',
    'minimal': 'minimal_variant'
  };

  return variantMap[normalized] || normalized;
}

function calculateConfidence(match: RegExpMatchArray, text: string): number {
  const matchedLength = match[0].length;
  const totalLength = text.length;
  const coverage = matchedLength / totalLength;
  
  // Exact match
  if (match[0] === text) return 1.0;
  
  // High confidence for kit commands (they're usually specific)
  return Math.min(0.95, coverage + 0.4);
}

// Voice response helpers
export function getKitIntentResponse(intent: KitIntent): string {
  switch (intent.type) {
    case KitIntentType.LOAD_KIT:
      return `Loading ${intent.parameters.kitName || 'kit'}`;
    case KitIntentType.VERIFY_KIT:
      return 'Verifying kit contents';
    case KitIntentType.OVERRIDE_ITEM:
      return `Logging override for ${intent.parameters.itemName}`;
    case KitIntentType.CHECK_ITEM:
      return `Checking for ${intent.parameters.itemName}`;
    case KitIntentType.LIST_ITEMS:
      return 'Listing kit items';
    case KitIntentType.REPORT_MISSING:
      return 'Sending missing items report';
    case KitIntentType.SWITCH_VARIANT:
      return `Switching to ${intent.parameters.variant} variant`;
    case KitIntentType.KIT_STATUS:
      return 'Checking kit status';
    case KitIntentType.FIND_ITEM:
      return `Looking for ${intent.parameters.itemName}`;
    case KitIntentType.ADD_NOTE:
      return 'Note added';
    default:
      return 'Processing kit request';
  }
}

// Common item aliases for better recognition
export const ITEM_ALIASES: Record<string, string[]> = {
  'trimmer': ['weed eater', 'weed whacker', 'string trimmer', 'line trimmer'],
  'blower': ['leaf blower', 'backpack blower'],
  'mower': ['lawn mower', 'push mower', 'riding mower'],
  'edger': ['lawn edger', 'edge trimmer'],
  'rake': ['leaf rake', 'garden rake'],
  'hose': ['water hose', 'garden hose'],
  'sprayer': ['spray bottle', 'pump sprayer', 'backpack sprayer'],
  'pruner': ['pruning shears', 'hand pruners', 'loppers'],
  'shovel': ['spade', 'digging shovel'],
  'gloves': ['work gloves', 'garden gloves'],
  'safety_glasses': ['safety goggles', 'eye protection'],
  'ear_protection': ['ear plugs', 'ear muffs', 'hearing protection']
};

export function resolveItemAlias(itemName: string): string {
  const normalized = itemName.toLowerCase();
  
  // Check if it's already a standard name
  for (const [standard, aliases] of Object.entries(ITEM_ALIASES)) {
    if (standard === normalized) return standard;
    if (aliases.includes(normalized)) return standard;
  }
  
  // Check partial matches
  for (const [standard, aliases] of Object.entries(ITEM_ALIASES)) {
    if (normalized.includes(standard)) return standard;
    for (const alias of aliases) {
      if (normalized.includes(alias) || alias.includes(normalized)) {
        return standard;
      }
    }
  }
  
  return itemName;
}
/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/domains/intent/prompts/intent-prompts.ts
 * phase: 3
 * domain: intent
 * purpose: Prompt templates for Gemini-based intent classification
 * spec_ref: voice-to-crud-plan.md
 * complexity_budget: 100
 * migrations_touched: []
 * state_machine: null
 * offline_capability: N/A
 * dependencies: {}
 * exports: ['buildIntentClassificationPrompt', 'buildConfirmationPrompt', 'buildClarificationPrompt']
 * voice_considerations: Prompts must be concise to minimize token costs
 * tasks: [
 *   'Create intent classification prompt template',
 *   'Create confirmation prompt template',
 *   'Create clarification prompt template'
 * ]
 */

import { IntentContext } from '../repositories/intent-classification.repository';
import { VoiceIntentType, VoiceIntentEntities, ConversationContext } from '../types/voice-intent-types';

/**
 * Available intents by role
 */
const SUPERVISOR_INTENTS: VoiceIntentType[] = [
  'inventory_add',
  'inventory_check',
  'check_in',
  'check_out',
  'transfer',
  'job_create',
  'job_assign',
  'assign_crew',
  'assign_item',
  'material_usage',
  'cycle_count',
  'kit_create',
  'kit_assign',
  'receipt_scan',
  'job_status',
];

const CREW_INTENTS: VoiceIntentType[] = [
  'load_verify',
  'check_in',
  'check_out',
  'material_usage',
  'maintenance_report',
  'job_status',
  'receipt_scan',
];

/**
 * Get allowed intents for a user role
 */
function getAllowedIntents(role: 'supervisor' | 'crew' | 'admin'): VoiceIntentType[] {
  if (role === 'admin') {
    return [...new Set([...SUPERVISOR_INTENTS, ...CREW_INTENTS])];
  }
  if (role === 'supervisor') {
    return SUPERVISOR_INTENTS;
  }
  return CREW_INTENTS;
}

/**
 * Build intent classification prompt
 */
export function buildIntentClassificationPrompt(
  transcript: string,
  context: IntentContext,
  conversationContext?: ConversationContext
): string {
  const allowedIntents = getAllowedIntents(context.userRole);

  // Build context section
  let contextSection = '';
  if (conversationContext && conversationContext.turn_number > 1) {
    contextSection = `
Previous conversation:
${conversationContext.previous_transcripts.slice(-3).map((t, i) =>
  `Turn ${conversationContext.turn_number - conversationContext.previous_transcripts.length + i}: "${t}"`
).join('\n')}

Previous intents: ${conversationContext.previous_intents.slice(-3).join(', ')}
Accumulated entities: ${JSON.stringify(conversationContext.accumulated_entities, null, 2)}
`;
  }

  if (context.currentPage) {
    contextSection += `\nCurrent page: ${context.currentPage}`;
  }

  const prompt = `You are a field service management assistant. Classify this voice command into an intent and extract entities.

Role: ${context.userRole}
${contextSection}

User said: "${transcript}"

Available intents:
${allowedIntents.map(intent => `- ${intent}: ${getIntentDescription(intent)}`).join('\n')}

Extract the following entities if present:
- itemNames: Array of item names mentioned (e.g., ["hammer", "drill"])
- quantities: Array of quantities (e.g., [5, 2])
- conditions: Array of conditions (e.g., ["good", "damaged"])
- fromLocationName: Source location (e.g., "warehouse", "truck 5")
- toLocationName: Destination location
- jobId or jobNumber: Job identifier (e.g., "123", "JOB-456")
- crewNames: Crew member names
- customerName: Customer name
- propertyAddress: Property address
- scheduledDate: Date in ISO 8601 format
- notes: Any additional notes

Return JSON with this exact structure (no markdown, no code blocks):
{
  "intent": "one_of_the_allowed_intents",
  "entities": {
    "itemNames": ["example"],
    "quantities": [1]
  },
  "confidence": 0.95,
  "needs_clarification": false,
  "follow_up": "optional question if needs_clarification is true",
  "missing_entities": ["list", "of", "missing", "required", "entities"]
}

Rules:
1. confidence should be 0.0-1.0 (use 0.9+ if very clear, 0.7-0.9 if somewhat clear, <0.7 if unclear)
2. Set needs_clarification=true if:
   - Missing required entities (e.g., check_in needs itemNames and jobId)
   - Ambiguous intent (could be multiple intents)
   - Unclear quantities or locations
3. If needs_clarification=true, provide a specific follow_up question
4. missing_entities should list what's needed to proceed
5. Return ONLY valid JSON, no other text

Now classify this command:`;

  return prompt;
}

/**
 * Get human-readable description for an intent
 */
function getIntentDescription(intent: VoiceIntentType): string {
  const descriptions: Record<VoiceIntentType, string> = {
    'inventory_add': 'Add new item to inventory',
    'inventory_check': 'Check inventory status',
    'check_in': 'Return items from job to location',
    'check_out': 'Assign items from location to job',
    'transfer': 'Move items between locations',
    'job_create': 'Create a new job',
    'job_assign': 'Assign job to crew',
    'assign_crew': 'Assign crew members to job',
    'assign_item': 'Assign specific item to job',
    'load_verify': 'Verify truck load with equipment list',
    'maintenance_report': 'Report equipment maintenance issue',
    'receipt_scan': 'Scan and process receipt',
    'job_status': 'Check or update job status',
    'material_usage': 'Record material consumption',
    'cycle_count': 'Perform inventory cycle count',
    'kit_create': 'Create equipment kit or BOM',
    'kit_assign': 'Assign kit to job',
    'unknown': 'Intent unclear or not supported',
  };
  return descriptions[intent] || 'No description available';
}

/**
 * Build confirmation prompt for yes/no responses
 */
export function buildConfirmationPrompt(
  transcript: string,
  confirmationQuestion: string,
  previousIntent: VoiceIntentType
): string {
  return `You are processing a confirmation response for a field service action.

Previous action: ${previousIntent}
Confirmation question: "${confirmationQuestion}"
User response: "${transcript}"

Determine if the user confirmed (yes) or rejected (no) the action.

Common yes responses: yes, yeah, yep, sure, ok, okay, correct, right, do it, go ahead, affirmative
Common no responses: no, nope, nah, cancel, stop, don't, negative, abort

Return JSON with this exact structure (no markdown, no code blocks):
{
  "confirmed": true or false,
  "confidence": 0.95,
  "interpretation": "yes" or "no" or "unclear"
}

Rules:
1. confidence should be 0.0-1.0
2. Set interpretation="unclear" if the response is ambiguous
3. Set confidence < 0.7 if unsure
4. Return ONLY valid JSON, no other text

Now interpret this response:`;
}

/**
 * Build clarification prompt when user provides additional info
 */
export function buildClarificationPrompt(
  transcript: string,
  conversationContext: ConversationContext
): string {
  return `You are helping a user complete a field service action.

Original intent: ${conversationContext.current_intent}
Already collected entities: ${JSON.stringify(conversationContext.accumulated_entities, null, 2)}
Missing entities: ${JSON.stringify(conversationContext.current_intent ? getRequiredEntities(conversationContext.current_intent) : [])}

Previous conversation:
${conversationContext.previous_transcripts.map((t, i) => `Turn ${i + 1}: "${t}"`).join('\n')}

User's new response: "${transcript}"

Extract any new entities from this response and merge with existing entities.

Return JSON with this exact structure (no markdown, no code blocks):
{
  "entities": {
    "itemNames": ["example"],
    "quantities": [1]
  },
  "needs_clarification": false,
  "follow_up": "optional question if still missing entities",
  "missing_entities": ["list", "of", "still", "missing", "entities"]
}

Rules:
1. Include ALL entities (previously collected + newly extracted)
2. Set needs_clarification=true if still missing required entities
3. Provide specific follow_up question if needs_clarification=true
4. Return ONLY valid JSON, no other text

Now extract entities:`;
}

/**
 * Get required entities for an intent
 */
function getRequiredEntities(intent: VoiceIntentType): string[] {
  const requiredByIntent: Record<VoiceIntentType, string[]> = {
    'check_in': ['itemNames', 'jobId'],
    'check_out': ['itemNames', 'jobId'],
    'transfer': ['itemNames', 'fromLocationName', 'toLocationName'],
    'inventory_add': ['itemNames'],
    'job_create': ['customerName', 'scheduledDate'],
    'assign_crew': ['crewNames', 'jobId'],
    'assign_item': ['itemNames', 'jobId'],
    'material_usage': ['itemNames', 'quantities', 'jobId'],
    'cycle_count': ['itemNames', 'quantities'],
    'kit_create': ['kitName', 'itemNames'],
    'kit_assign': ['kitName', 'jobId'],
    'load_verify': ['jobId'],
    'maintenance_report': ['itemNames'],
    'receipt_scan': [],
    'job_status': ['jobId'],
    'inventory_check': ['itemNames'],
    'job_assign': ['jobId', 'crewNames'],
    'unknown': [],
  };
  return requiredByIntent[intent] || [];
}

/**
 * Export required entities helper for external use
 */
export { getRequiredEntities };

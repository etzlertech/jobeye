/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/voice/scheduling-intents.ts
 * phase: 3
 * domain: scheduling
 * purpose: Define scheduling-related voice intent patterns
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 200
 * state_machine: none
 * estimated_llm_cost: 0.001
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/core/voice/intent-types"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - date-fns
 *   supabase:
 *     - none
 * exports:
 *   - SCHEDULING_INTENTS
 *   - parseSchedulingIntent
 *   - SchedulingIntentType
 * voice_considerations:
 *   - Natural language patterns for scheduling
 *   - Support various time expressions
 *   - Handle ambiguous requests
 * test_requirements:
 *   coverage: 95%
 *   test_file: src/__tests__/scheduling/unit/scheduling-intents.test.ts
 * tasks:
 *   - Define intent patterns
 *   - Parse time expressions
 *   - Extract scheduling parameters
 *   - Handle relative dates
 */

import { parse, addDays, startOfDay, endOfDay, setHours, setMinutes } from 'date-fns';
import { logger } from '@/core/logger/voice-logger';

export enum SchedulingIntentType {
  CREATE_SCHEDULE = 'create_schedule',
  VIEW_SCHEDULE = 'view_schedule',
  UPDATE_SCHEDULE = 'update_schedule',
  CANCEL_SCHEDULE = 'cancel_schedule',
  ADD_JOB = 'add_job',
  REMOVE_JOB = 'remove_job',
  RESCHEDULE = 'reschedule',
  OPTIMIZE_ROUTE = 'optimize_route',
  ADD_BREAK = 'add_break',
  CHECK_CONFLICTS = 'check_conflicts',
  TIME_TO_NEXT = 'time_to_next',
  DAILY_SUMMARY = 'daily_summary'
}

export interface SchedulingIntent {
  type: SchedulingIntentType;
  parameters: {
    date?: Date;
    timeRange?: { start: Date; end: Date };
    jobId?: string;
    duration?: number;
    location?: string;
    notes?: string;
  };
  confidence: number;
  originalText: string;
}

export interface IntentPattern {
  type: SchedulingIntentType;
  patterns: RegExp[];
  extractor: (match: RegExpMatchArray, text: string) => any;
}

export const SCHEDULING_INTENTS: IntentPattern[] = [
  {
    type: SchedulingIntentType.CREATE_SCHEDULE,
    patterns: [
      /create (?:a )?(?:new )?schedule (?:for )?(.+)/i,
      /schedule (?:me )?(?:for )?(.+)/i,
      /set up (?:my )?(?:schedule|day) (?:for )?(.+)/i,
      /plan (?:my )?day (?:for )?(.+)/i
    ],
    extractor: (match, text) => ({
      date: parseTimeExpression(match[1])
    })
  },
  {
    type: SchedulingIntentType.VIEW_SCHEDULE,
    patterns: [
      /(?:show|view|what'?s|check) (?:my )?schedule (?:for )?(.+)?/i,
      /what (?:do|am) i (?:doing|scheduled) (.+)?/i,
      /(?:my )?(?:today'?s|tomorrow'?s) schedule/i,
      /what'?s (?:on )?(?:my )?(?:calendar|schedule)/i
    ],
    extractor: (match, text) => ({
      date: match[1] ? parseTimeExpression(match[1]) : new Date()
    })
  },
  {
    type: SchedulingIntentType.ADD_JOB,
    patterns: [
      /add (?:a )?(?:job|appointment|task) (?:at|for) (.+)/i,
      /schedule (?:a )?(?:job|task) (?:at|for) (.+)/i,
      /(?:i )?(?:have|got) (?:a )?(?:job|task) (?:at|for) (.+)/i,
      /put (?:a )?(?:job|task) (?:on|in) (?:my )?schedule (?:at|for) (.+)/i
    ],
    extractor: (match, text) => {
      const timeInfo = extractTimeAndLocation(match[1]);
      return {
        date: timeInfo.date,
        location: timeInfo.location,
        duration: timeInfo.duration
      };
    }
  },
  {
    type: SchedulingIntentType.OPTIMIZE_ROUTE,
    patterns: [
      /optimize (?:my )?(?:route|schedule|day)/i,
      /(?:find|get) (?:the )?(?:best|optimal) route/i,
      /rearrange (?:my )?(?:schedule|stops) (?:to save time)?/i,
      /(?:can you )?make (?:my )?route (?:more )?efficient/i
    ],
    extractor: (match, text) => ({})
  },
  {
    type: SchedulingIntentType.ADD_BREAK,
    patterns: [
      /(?:add|schedule|take) (?:a )?break (?:at|around) (.+)/i,
      /(?:i )?need (?:a )?break (?:at|around) (.+)/i,
      /(?:add|put) (?:a )?(?:lunch|rest) (?:break )?(?:at|around) (.+)/i
    ],
    extractor: (match, text) => {
      const timeStr = match[1];
      const time = parseTimeExpression(timeStr);
      return {
        date: time,
        duration: timeStr.toLowerCase().includes('lunch') ? 30 : 15
      };
    }
  },
  {
    type: SchedulingIntentType.RESCHEDULE,
    patterns: [
      /(?:move|reschedule) (?:the )?(.+) to (.+)/i,
      /change (?:the )?(.+) (?:time )?to (.+)/i,
      /(?:can we )?reschedule (?:the )?(.+) (?:for|to) (.+)/i
    ],
    extractor: (match, text) => ({
      jobId: match[1], // Would need to resolve this
      date: parseTimeExpression(match[2])
    })
  },
  {
    type: SchedulingIntentType.CANCEL_SCHEDULE,
    patterns: [
      /cancel (?:the )?(?:job|appointment|task) (?:at|for) (.+)/i,
      /remove (?:the )?(?:job|task) (?:at|for|scheduled) (.+)/i,
      /(?:i )?(?:can'?t|won'?t) (?:make|do) (?:the )?(.+)/i
    ],
    extractor: (match, text) => ({
      jobId: match[1] // Would need to resolve this
    })
  },
  {
    type: SchedulingIntentType.CHECK_CONFLICTS,
    patterns: [
      /(?:check|are there|do i have) (?:any )?(?:schedule )?conflicts/i,
      /(?:is there|check for) (?:a )?conflict/i,
      /(?:am i )?double[- ]?booked/i
    ],
    extractor: (match, text) => ({})
  },
  {
    type: SchedulingIntentType.TIME_TO_NEXT,
    patterns: [
      /(?:how long|how much time) (?:until|before|to) (?:my )?next (?:job|appointment|task)/i,
      /when'?s (?:my )?next (?:job|appointment|stop)/i,
      /what'?s next (?:on )?(?:my )?(?:schedule|list)/i
    ],
    extractor: (match, text) => ({})
  },
  {
    type: SchedulingIntentType.DAILY_SUMMARY,
    patterns: [
      /(?:give me |what'?s )?(?:my )?(?:daily|day) summary/i,
      /summarize (?:my )?(?:day|schedule)/i,
      /(?:how many|what) (?:jobs|tasks) (?:do i have )?today/i,
      /(?:what'?s|how'?s) (?:my )?day (?:looking|look)/i
    ],
    extractor: (match, text) => ({
      date: new Date()
    })
  }
];

export function parseSchedulingIntent(text: string): SchedulingIntent | null {
  const normalizedText = text.toLowerCase().trim();
  
  for (const intentDef of SCHEDULING_INTENTS) {
    for (const pattern of intentDef.patterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        try {
          const parameters = intentDef.extractor(match, normalizedText);
          
          logger.debug('Scheduling intent matched', {
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
          logger.error('Error extracting intent parameters', { 
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

function parseTimeExpression(expr: string): Date {
  const normalized = expr.toLowerCase().trim();
  const now = new Date();

  // Relative dates
  if (normalized.includes('today')) return startOfDay(now);
  if (normalized.includes('tomorrow')) return startOfDay(addDays(now, 1));
  if (normalized.includes('yesterday')) return startOfDay(addDays(now, -1));
  
  // Days of week
  const dayMatch = normalized.match(/(?:next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (dayMatch) {
    return getNextDayOfWeek(dayMatch[1]);
  }

  // Relative days
  const inDaysMatch = normalized.match(/in (\d+) days?/);
  if (inDaysMatch) {
    return startOfDay(addDays(now, parseInt(inDaysMatch[1])));
  }

  // Time expressions
  const timeMatch = normalized.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const isPM = timeMatch[3] === 'pm';
    
    let date = new Date();
    date = setHours(date, isPM && hours !== 12 ? hours + 12 : hours);
    date = setMinutes(date, minutes);
    return date;
  }

  // Try parsing as date
  try {
    const parsed = parse(expr, 'MM/dd/yyyy', now);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}

  // Default to now
  return now;
}

function extractTimeAndLocation(expr: string): { date: Date; location?: string; duration?: number } {
  const parts = expr.split(' at ');
  const result: any = {};

  if (parts.length > 1) {
    // Has location
    result.location = parts[1].trim();
    result.date = parseTimeExpression(parts[0]);
  } else {
    // Just time
    result.date = parseTimeExpression(expr);
  }

  // Extract duration if mentioned
  const durationMatch = expr.match(/for (\d+)\s*(hours?|minutes?|hrs?|mins?)/i);
  if (durationMatch) {
    const amount = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    result.duration = unit.startsWith('h') ? amount * 60 : amount;
  }

  return result;
}

function getNextDayOfWeek(dayName: string): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());
  
  const today = new Date();
  const todayDay = today.getDay();
  
  let daysUntil = targetDay - todayDay;
  if (daysUntil <= 0) daysUntil += 7;
  
  return startOfDay(addDays(today, daysUntil));
}

function calculateConfidence(match: RegExpMatchArray, text: string): number {
  // Simple confidence calculation
  const matchedLength = match[0].length;
  const totalLength = text.length;
  const coverage = matchedLength / totalLength;
  
  // Boost confidence for exact matches
  if (match[0] === text) return 1.0;
  
  // Base confidence on coverage
  return Math.min(0.95, coverage + 0.3);
}

// Voice response helpers
export function getSchedulingIntentResponse(intent: SchedulingIntent): string {
  switch (intent.type) {
    case SchedulingIntentType.CREATE_SCHEDULE:
      return 'Creating your schedule';
    case SchedulingIntentType.VIEW_SCHEDULE:
      return 'Loading your schedule';
    case SchedulingIntentType.ADD_JOB:
      return 'Adding job to schedule';
    case SchedulingIntentType.OPTIMIZE_ROUTE:
      return 'Optimizing your route';
    case SchedulingIntentType.ADD_BREAK:
      return 'Scheduling break time';
    case SchedulingIntentType.RESCHEDULE:
      return 'Rescheduling the job';
    case SchedulingIntentType.CHECK_CONFLICTS:
      return 'Checking for conflicts';
    case SchedulingIntentType.TIME_TO_NEXT:
      return 'Checking time to next job';
    case SchedulingIntentType.DAILY_SUMMARY:
      return 'Preparing daily summary';
    default:
      return 'Processing scheduling request';
  }
}
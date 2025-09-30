#!/usr/bin/env tsx
/**
 * Voice + LLM Integration Test for Scheduling
 *
 * Tests the full pipeline:
 * 1. User says something (simulated text input)
 * 2. LLM processes intent and extracts parameters
 * 3. Scheduling operations execute
 * 4. LLM generates natural language response
 *
 * Run with: npx tsx scripts/test-scheduling-voice-llm.ts
 */

// Load environment FIRST
require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import Anthropic from '@anthropic-ai/sdk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

if (!anthropicKey) {
  console.error('❌ Missing ANTHROPIC_API_KEY - required for LLM integration');
  console.log('\nSet it in .env.local:');
  console.log('ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

const TEST_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_TECHNICIAN_NAME = 'Mike';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${question}${colors.reset} `, resolve);
  });
}

// Conversation context
interface ConversationContext {
  currentDayPlanId?: string;
  lastJobLocation?: { lat: number; lng: number };
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const context: ConversationContext = {
  conversationHistory: []
};

/**
 * Call Claude API to process voice input and determine intent
 */
async function processVoiceInput(userInput: string): Promise<{
  intent: string;
  parameters: any;
  response: string;
  tool_calls?: any[];
}> {
  log('\n🤖 Processing with Claude API...', 'blue');

  const systemPrompt = `You are a voice assistant for JobEye, a field service management system.
Your job is to help technicians manage their daily schedule using natural conversation.

Current Context:
- Technician: ${TEST_TECHNICIAN_NAME}
- User ID: ${TEST_USER_ID}
- Company ID: ${TEST_COMPANY_ID}
${context.currentDayPlanId ? `- Active Day Plan: ${context.currentDayPlanId}` : '- No active day plan'}

Available Tools:
1. create_day_plan(date: string) - Create a new day plan
2. add_job_to_schedule(job_address: string, duration_minutes: number, time?: string) - Add job to schedule
3. query_schedule(date?: string) - Get today's or specified date schedule
4. check_conflicts() - Check for scheduling conflicts
5. suggest_optimal_time(duration_minutes: number) - Find best time slot

Business Rules:
- Maximum 6 jobs per technician per day
- Jobs need adequate travel time between locations
- Must have breaks after 4 hours of work

Respond naturally and conversationally. Extract intent and parameters from what the user says.
If you need to perform an action, indicate the tool to use and parameters.
Keep responses concise and voice-friendly.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022', // Latest stable model
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...context.conversationHistory,
        {
          role: 'user',
          content: userInput
        }
      ]
    });

    const assistantMessage = response.content[0];
    const responseText = assistantMessage.type === 'text' ? assistantMessage.text : '';

    // Parse intent and parameters from response
    // In production, this would use tool_use blocks
    const intent = parseIntent(responseText);
    const parameters = parseParameters(responseText, intent);

    context.conversationHistory.push(
      { role: 'user', content: userInput },
      { role: 'assistant', content: responseText }
    );

    return {
      intent,
      parameters,
      response: responseText,
    };
  } catch (error: any) {
    log(`❌ Claude API Error: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Simple intent parsing (in production, use tool_use)
 */
function parseIntent(response: string): string {
  const lower = response.toLowerCase();

  if (lower.includes('create') && (lower.includes('plan') || lower.includes('schedule'))) {
    return 'create_day_plan';
  }
  if (lower.includes('add') && lower.includes('job')) {
    return 'add_job';
  }
  if (lower.includes('what') && (lower.includes('schedule') || lower.includes('today'))) {
    return 'query_schedule';
  }
  if (lower.includes('conflict') || lower.includes('problem')) {
    return 'check_conflicts';
  }
  if (lower.includes('when') && (lower.includes('fit') || lower.includes('add'))) {
    return 'suggest_time';
  }

  return 'general_response';
}

/**
 * Extract parameters from LLM response
 */
function parseParameters(response: string, intent: string): any {
  const params: any = {};

  switch (intent) {
    case 'create_day_plan':
      // Extract date mentions (tomorrow, today, specific date)
      if (response.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        params.date = tomorrow.toISOString().split('T')[0];
      } else {
        params.date = new Date().toISOString().split('T')[0];
      }
      break;

    case 'add_job':
      // Extract address and duration
      const addressMatch = response.match(/(?:at|to)\s+([^,.\n]+)/i);
      if (addressMatch) {
        params.address = addressMatch[1].trim();
      }

      const durationMatch = response.match(/(\d+)\s*(?:minute|min|hour)/i);
      if (durationMatch) {
        params.duration_minutes = parseInt(durationMatch[1]);
        if (response.toLowerCase().includes('hour')) {
          params.duration_minutes *= 60;
        }
      }
      break;

    case 'query_schedule':
      // Date extraction
      if (response.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        params.date = tomorrow.toISOString().split('T')[0];
      }
      break;
  }

  return params;
}

/**
 * Execute scheduling operations based on intent
 */
async function executeSchedulingOperation(intent: string, parameters: any): Promise<any> {
  log('\n⚙️  Executing scheduling operation...', 'blue');

  switch (intent) {
    case 'create_day_plan':
      return await createDayPlan(parameters.date);

    case 'add_job':
      if (!context.currentDayPlanId) {
        // Auto-create day plan for today
        const today = new Date().toISOString().split('T')[0];
        await createDayPlan(today);
      }
      return await addJobToSchedule(
        parameters.address || '123 Main St',
        parameters.duration_minutes || 60
      );

    case 'query_schedule':
      return await querySchedule(parameters.date);

    case 'check_conflicts':
      return await checkConflicts();

    case 'suggest_time':
      return await suggestOptimalTime(parameters.duration_minutes || 60);

    default:
      return { message: 'No action needed' };
  }
}

/**
 * Create a day plan
 */
async function createDayPlan(date: string) {
  log(`Creating day plan for ${date}...`, 'yellow');

  try {
    const { data, error } = await supabase
      .from('day_plans')
      .insert({
        company_id: TEST_COMPANY_ID,
        user_id: TEST_USER_ID,
        plan_date: date,
        status: 'draft',
        route_data: {},
        total_distance_miles: 0,
        estimated_duration_minutes: 0
      })
      .select()
      .single();

    if (error) throw error;

    context.currentDayPlanId = data.id;
    log(`✅ Day plan created: ${data.id}`, 'green');

    return { success: true, dayPlan: data };
  } catch (error: any) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Add job to schedule
 */
async function addJobToSchedule(address: string, durationMinutes: number) {
  if (!context.currentDayPlanId) {
    return { success: false, error: 'No active day plan' };
  }

  log(`Adding job: ${address} (${durationMinutes} min)...`, 'yellow');

  try {
    // Check current job count
    const { count } = await supabase
      .from('schedule_events')
      .select('id', { count: 'exact', head: true })
      .eq('day_plan_id', context.currentDayPlanId)
      .eq('event_type', 'job')
      .neq('status', 'cancelled');

    if (count && count >= 6) {
      log('⚠️  6-job limit reached!', 'yellow');
      return { success: false, error: '6-job limit reached' };
    }

    // Get next sequence order
    const { data: existingEvents } = await supabase
      .from('schedule_events')
      .select('sequence_order')
      .eq('day_plan_id', context.currentDayPlanId)
      .order('sequence_order', { ascending: false })
      .limit(1);

    const nextOrder = existingEvents && existingEvents[0]
      ? existingEvents[0].sequence_order + 1
      : 1;

    // Generate location (mock)
    const location = {
      lat: 40.7128 + (Math.random() - 0.5) * 0.1,
      lng: -74.0060 + (Math.random() - 0.5) * 0.1
    };

    // Calculate start time (after last job or 8 AM)
    let startTime = new Date();
    startTime.setHours(8, 0, 0, 0);

    if (existingEvents && existingEvents.length > 0) {
      // Start after last job + travel time
      startTime = new Date(startTime.getTime() + (nextOrder - 1) * 90 * 60 * 1000);
    }

    const { data, error } = await supabase
      .from('schedule_events')
      .insert({
        company_id: TEST_COMPANY_ID,
        day_plan_id: context.currentDayPlanId,
        event_type: 'job',
        job_id: `job-${Date.now()}`,
        sequence_order: nextOrder,
        scheduled_start: startTime.toISOString(),
        scheduled_duration_minutes: durationMinutes,
        status: 'pending',
        address,
        location_data: `POINT(${location.lng} ${location.lat})`
      })
      .select()
      .single();

    if (error) throw error;

    context.lastJobLocation = location;
    log(`✅ Job added: ${address} at ${startTime.toLocaleTimeString()}`, 'green');

    return { success: true, event: data, count: (count || 0) + 1 };
  } catch (error: any) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Query schedule
 */
async function querySchedule(date?: string) {
  const queryDate = date || new Date().toISOString().split('T')[0];
  log(`Querying schedule for ${queryDate}...`, 'yellow');

  try {
    const { data: dayPlans } = await supabase
      .from('day_plans')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('plan_date', queryDate)
      .single();

    if (!dayPlans) {
      return { success: true, jobs: [], message: 'No schedule for this date' };
    }

    const { data: events } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', dayPlans.id)
      .eq('event_type', 'job')
      .order('sequence_order', { ascending: true });

    log(`✅ Found ${events?.length || 0} jobs`, 'green');

    return { success: true, jobs: events || [], dayPlan: dayPlans };
  } catch (error: any) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Check for conflicts
 */
async function checkConflicts() {
  if (!context.currentDayPlanId) {
    return { success: false, error: 'No active day plan' };
  }

  log('Checking for conflicts...', 'yellow');

  try {
    const { data: events } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', context.currentDayPlanId)
      .order('scheduled_start', { ascending: true });

    if (!events || events.length === 0) {
      return { success: true, conflicts: [], message: 'No events to check' };
    }

    const conflicts = [];

    // Check time overlaps
    for (let i = 0; i < events.length - 1; i++) {
      const event1 = events[i];
      const event2 = events[i + 1];

      const end1 = new Date(new Date(event1.scheduled_start).getTime() + event1.scheduled_duration_minutes * 60 * 1000);
      const start2 = new Date(event2.scheduled_start);

      if (end1 > start2) {
        conflicts.push({
          type: 'time_overlap',
          events: [event1.id, event2.id],
          message: `Job ${i + 1} overlaps with Job ${i + 2}`
        });
      }
    }

    log(`✅ Found ${conflicts.length} conflicts`, conflicts.length > 0 ? 'yellow' : 'green');

    return { success: true, conflicts };
  } catch (error: any) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Suggest optimal time slot
 */
async function suggestOptimalTime(durationMinutes: number) {
  if (!context.currentDayPlanId) {
    return { success: false, error: 'No active day plan' };
  }

  log(`Finding optimal ${durationMinutes} minute slot...`, 'yellow');

  try {
    const { data: events } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', context.currentDayPlanId)
      .order('scheduled_start', { ascending: true });

    // Simple algorithm: find gap between events
    if (!events || events.length === 0) {
      const slot = new Date();
      slot.setHours(8, 0, 0, 0);
      return { success: true, suggestedTime: slot.toISOString() };
    }

    // Find first gap that fits
    const dayStart = new Date();
    dayStart.setHours(8, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(17, 0, 0, 0);

    for (let i = 0; i < events.length - 1; i++) {
      const event1End = new Date(new Date(events[i].scheduled_start).getTime() + events[i].scheduled_duration_minutes * 60 * 1000);
      const event2Start = new Date(events[i + 1].scheduled_start);

      const gapMinutes = (event2Start.getTime() - event1End.getTime()) / 1000 / 60;

      if (gapMinutes >= durationMinutes + 15) { // 15 min buffer
        log(`✅ Found slot after Job ${i + 1}`, 'green');
        return { success: true, suggestedTime: event1End.toISOString() };
      }
    }

    // Try after last event
    const lastEvent = events[events.length - 1];
    const afterLast = new Date(new Date(lastEvent.scheduled_start).getTime() + lastEvent.scheduled_duration_minutes * 60 * 1000);

    if (afterLast < dayEnd) {
      log(`✅ Found slot after last job`, 'green');
      return { success: true, suggestedTime: afterLast.toISOString() };
    }

    log(`⚠️  No suitable slot found`, 'yellow');
    return { success: false, error: 'No suitable slot available' };
  } catch (error: any) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Generate voice response using LLM
 */
async function generateVoiceResponse(operationResult: any, userInput: string): Promise<string> {
  log('\n🎤 Generating voice response...', 'blue');

  const systemPrompt = `You are a voice assistant responding to a field technician.
Generate a natural, concise voice response based on the operation result.
Keep it brief and conversational - this will be spoken aloud.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 256,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `User said: "${userInput}"

Operation result: ${JSON.stringify(operationResult, null, 2)}

Generate a brief, natural voice response (1-2 sentences).`
        }
      ]
    });

    const voiceResponse = response.content[0];
    return voiceResponse.type === 'text' ? voiceResponse.text : 'Operation completed.';
  } catch (error: any) {
    return 'Operation completed successfully.';
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  log('\n🧹 Cleaning up test data...', 'yellow');

  await supabase
    .from('schedule_events')
    .delete()
    .eq('company_id', TEST_COMPANY_ID);

  await supabase
    .from('day_plans')
    .delete()
    .eq('company_id', TEST_COMPANY_ID);

  log('✅ Cleanup complete', 'green');
}

/**
 * Main conversation loop
 */
async function main() {
  log('\n🎙️  VOICE + LLM SCHEDULING TEST\n', 'cyan');
  log('This tests the full voice pipeline with real Claude API calls.\n', 'cyan');
  log('Example commands:', 'blue');
  log('  - "Create a schedule for tomorrow"', 'reset');
  log('  - "Add a job at 456 Oak Street for 90 minutes"', 'reset');
  log('  - "What\'s on my schedule today?"', 'reset');
  log('  - "Check for any conflicts"', 'reset');
  log('  - "When can I fit in a 2 hour job?"', 'reset');
  log('\nType "quit" to exit and cleanup\n', 'yellow');

  // Handle piped input (non-interactive mode)
  let isInteractive = process.stdin.isTTY;

  while (true) {
    let userInput: string;

    try {
      userInput = await ask('\n🎤 You:');
    } catch (error) {
      // readline closed (piped input ended)
      await cleanup();
      log('\n👋 Input ended, cleaning up...', 'cyan');
      process.exit(0);
    }

    if (userInput.toLowerCase() === 'quit' || userInput.toLowerCase() === 'exit') {
      await cleanup();
      log('\n👋 Goodbye!', 'cyan');
      rl.close();
      process.exit(0);
    }

    if (!userInput.trim()) continue;

    try {
      // Step 1: Process with LLM
      const llmResult = await processVoiceInput(userInput);
      log(`\n📋 Intent: ${llmResult.intent}`, 'magenta');
      log(`📋 Parameters: ${JSON.stringify(llmResult.parameters)}`, 'magenta');

      // Step 2: Execute operation
      const operationResult = await executeSchedulingOperation(
        llmResult.intent,
        llmResult.parameters
      );

      // Step 3: Generate voice response
      const voiceResponse = await generateVoiceResponse(operationResult, userInput);
      log(`\n🤖 Assistant: ${voiceResponse}`, 'green');

      // Show operation details
      if (operationResult.success) {
        if (operationResult.count !== undefined) {
          log(`   📊 Jobs on schedule: ${operationResult.count}/6`, 'blue');
        }
        if (operationResult.jobs) {
          log(`   📊 Total jobs: ${operationResult.jobs.length}`, 'blue');
        }
        if (operationResult.conflicts && operationResult.conflicts.length > 0) {
          log(`   ⚠️  Conflicts: ${operationResult.conflicts.length}`, 'yellow');
        }
      }
    } catch (error: any) {
      log(`\n❌ Error: ${error.message}`, 'red');
    }
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});